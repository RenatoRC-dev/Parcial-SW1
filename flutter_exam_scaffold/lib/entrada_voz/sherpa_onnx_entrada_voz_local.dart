import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:record/record.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa;
import 'package:sw1_local_ai_spike/entrada_voz/entrada_voz_local.dart';

/// STT completamente local: el micrófono produce WAV y sherpa-onnx ejecuta
/// Whisper en el dispositivo. No contiene cliente HTTP ni descarga modelos.
final class SherpaOnnxEntradaVozLocal implements EntradaVozLocal {
  SherpaOnnxEntradaVozLocal({
    required this.directorioModelo,
    required this.rutaAudioTemporal,
    AudioRecorder? grabador,
  }) : _grabador = grabador ?? AudioRecorder();

  static const nombreDirectorioModelo = 'sherpa-onnx-whisper-tiny';
  static const nombreEncoder = 'tiny-encoder.int8.onnx';
  static const nombreDecoder = 'tiny-decoder.int8.onnx';
  static const nombreTokens = 'tiny-tokens.txt';
  static const maxDuracionGrabacion = Duration(seconds: 20);

  final String directorioModelo;
  final String rutaAudioTemporal;
  final AudioRecorder _grabador;
  final _cambios = StreamController<EstadoEntradaVozLocal>.broadcast();
  final _transcripcionesAutomaticas = StreamController<String>.broadcast();
  EstadoEntradaVozLocal _estado = EstadoEntradaVozLocal.inactiva;
  sherpa.OfflineRecognizer? _reconocedor;
  bool _bindingsInicializados = false;
  final _limiteGrabacion = LimiteGrabacionVoz();
  Future<String>? _detencionEnCurso;
  Stopwatch? _duracionGrabacion;

  String get _encoder => '$directorioModelo/$nombreEncoder';
  String get _decoder => '$directorioModelo/$nombreDecoder';
  String get _tokens => '$directorioModelo/$nombreTokens';

  static bool modeloDisponible(String directorio) =>
      File('$directorio/$nombreEncoder').existsSync() &&
      File('$directorio/$nombreDecoder').existsSync() &&
      File('$directorio/$nombreTokens').existsSync();

  @override
  bool get disponible => modeloDisponible(directorioModelo);

  @override
  EstadoEntradaVozLocal get estado => _estado;

  @override
  Stream<EstadoEntradaVozLocal> get cambiosEstado => _cambios.stream;

  @override
  Stream<String> get transcripcionesAutomaticas =>
      _transcripcionesAutomaticas.stream;

  void _cambiar(EstadoEntradaVozLocal estado) {
    _estado = estado;
    if (!_cambios.isClosed) _cambios.add(estado);
  }

  Future<void> _prepararReconocedor() async {
    if (!disponible) {
      throw StateError('Falta el modelo de voz local en $directorioModelo.');
    }
    if (_reconocedor != null) return;
    if (!_bindingsInicializados) {
      sherpa.initBindings();
      _bindingsInicializados = true;
    }
    _reconocedor = sherpa.OfflineRecognizer(
      sherpa.OfflineRecognizerConfig(
        model: sherpa.OfflineModelConfig(
          whisper: sherpa.OfflineWhisperModelConfig(
            encoder: _encoder,
            decoder: _decoder,
            language: 'es',
            task: 'transcribe',
          ),
          tokens: _tokens,
          modelType: 'whisper',
          numThreads: 4,
          debug: false,
        ),
      ),
    );
  }

  @override
  Future<void> iniciarEscucha() async {
    if (_estado == EstadoEntradaVozLocal.escuchando ||
        _estado == EstadoEntradaVozLocal.procesando) {
      return;
    }
    try {
      await _prepararReconocedor();
      if (!await _grabador.hasPermission()) {
        throw StateError('El permiso de micrófono no fue concedido.');
      }
      final audio = File(rutaAudioTemporal);
      await audio.parent.create(recursive: true);
      if (await audio.exists()) await audio.delete();
      await _grabador.start(
        const RecordConfig(
          encoder: AudioEncoder.wav,
          sampleRate: 16000,
          numChannels: 1,
          autoGain: true,
          noiseSuppress: true,
        ),
        path: rutaAudioTemporal,
      );
      _cambiar(EstadoEntradaVozLocal.escuchando);
      _duracionGrabacion = Stopwatch()..start();
      if (kDebugMode) debugPrint('[VOICE] recording_started');
      _limiteGrabacion.iniciar(maxDuracionGrabacion, () async {
        try {
          final texto = await detenerEscucha();
          if (texto.isNotEmpty && !_transcripcionesAutomaticas.isClosed) {
            _transcripcionesAutomaticas.add(texto);
          }
        } catch (error, stackTrace) {
          if (!_transcripcionesAutomaticas.isClosed) {
            _transcripcionesAutomaticas.addError(error, stackTrace);
          }
        }
      });
    } catch (_) {
      _cambiar(EstadoEntradaVozLocal.error);
      rethrow;
    }
  }

  @override
  Future<String> detenerEscucha() async {
    if (_estado != EstadoEntradaVozLocal.escuchando) return '';
    final enCurso = _detencionEnCurso;
    if (enCurso != null) return enCurso;
    _limiteGrabacion.cancelar();
    final operacion = _detenerYTranscribir();
    _detencionEnCurso = operacion;
    try {
      return await operacion;
    } finally {
      _detencionEnCurso = null;
    }
  }

  Future<String> _detenerYTranscribir() async {
    try {
      final ruta = await _grabador.stop();
      _duracionGrabacion?.stop();
      if (kDebugMode) {
        debugPrint(
          '[VOICE] recording_stopped durationMs=${_duracionGrabacion?.elapsedMilliseconds ?? 0}',
        );
      }
      _cambiar(EstadoEntradaVozLocal.procesando);
      if (ruta == null || !await File(ruta).exists()) {
        throw StateError('No se obtuvo audio para transcribir.');
      }
      final tiempoStt = Stopwatch()..start();
      final wave = sherpa.readWave(ruta);
      if (wave.samples.isEmpty || wave.sampleRate <= 0) {
        throw StateError('La grabación no contiene audio reconocible.');
      }
      final flujo = _reconocedor!.createStream();
      try {
        flujo.acceptWaveform(
          samples: wave.samples,
          sampleRate: wave.sampleRate,
        );
        _reconocedor!.decode(flujo);
        final texto = _reconocedor!.getResult(flujo).text.trim();
        tiempoStt.stop();
        if (texto.isEmpty) {
          throw StateError('No se reconoció ninguna instrucción.');
        }
        if (kDebugMode) {
          debugPrint(
            '[STT] completed durationMs=${tiempoStt.elapsedMilliseconds}',
          );
        }
        _cambiar(EstadoEntradaVozLocal.completada);
        return texto;
      } finally {
        flujo.free();
      }
    } catch (_) {
      _cambiar(EstadoEntradaVozLocal.error);
      rethrow;
    } finally {
      final audio = File(rutaAudioTemporal);
      if (await audio.exists()) await audio.delete();
    }
  }

  @override
  Future<void> cancelar() async {
    _limiteGrabacion.cancelar();
    if (await _grabador.isRecording()) await _grabador.cancel();
    _cambiar(EstadoEntradaVozLocal.inactiva);
    final audio = File(rutaAudioTemporal);
    if (await audio.exists()) await audio.delete();
  }

  @override
  Future<void> dispose() async {
    _limiteGrabacion.cancelar();
    if (await _grabador.isRecording()) await _grabador.cancel();
    _reconocedor?.free();
    _reconocedor = null;
    await _grabador.dispose();
    await _cambios.close();
    await _transcripcionesAutomaticas.close();
  }
}
