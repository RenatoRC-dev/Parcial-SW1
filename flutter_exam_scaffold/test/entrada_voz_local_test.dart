import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sw1_local_ai_spike/aplicacion/coordinador_entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/interpretador_comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/entrada_voz/entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/entrada_voz/sherpa_onnx_entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/local_ai/local_ai_engine.dart';

void main() {
  test(
    'el adaptador local detecta los archivos obligatorios del modelo',
    () async {
      final temporal = await Directory.systemTemp.createTemp('sw1_stt_test_');
      addTearDown(() => temporal.delete(recursive: true));

      expect(
        SherpaOnnxEntradaVozLocal.modeloDisponible(temporal.path),
        isFalse,
      );
      for (final nombre in [
        SherpaOnnxEntradaVozLocal.nombreEncoder,
        SherpaOnnxEntradaVozLocal.nombreDecoder,
        SherpaOnnxEntradaVozLocal.nombreTokens,
      ]) {
        await File('${temporal.path}/$nombre').writeAsString('fixture');
      }
      expect(SherpaOnnxEntradaVozLocal.modeloDisponible(temporal.path), isTrue);
    },
  );

  test('la transcripción usa el mismo InterpretadorComandoLocal', () async {
    final voz = _EntradaVozFalsa('Registra a Ana con correo ana@correo.com');
    final engine = _EngineFalso();
    final interpretador = InterpretadorComandoLocal(engine);
    ResultadoInterpretacionLocal? resultado;

    await CoordinadorEntradaVozLocal(voz).finalizar(
      alTranscribir: (texto) async {
        resultado = await interpretador.interpretar(texto);
      },
    );

    expect(
      engine.ultimaInstruccion,
      'Registra a Ana con correo ana@correo.com',
    );
    expect(resultado?.comando.accion, TipoAccionLocal.crearCliente);
    expect(engine.ultimaSolicitud?.maxOutputTokens, 64);
  });

  test('el coordinador solo entrega texto al flujo compartido', () async {
    final voz = _EntradaVozFalsa('texto reconocido');
    var textoVisible = '';
    await CoordinadorEntradaVozLocal(
      voz,
    ).finalizar(alTranscribir: (texto) async => textoVisible = texto);

    expect(textoVisible, 'texto reconocido');
  });

  test('el límite de grabación protege el máximo de Whisper', () {
    expect(
      SherpaOnnxEntradaVozLocal.maxDuracionGrabacion,
      lessThan(const Duration(seconds: 30)),
    );
  });

  test('el límite detiene automáticamente al vencer', () async {
    final vencio = Completer<void>();
    final limite = LimiteGrabacionVoz();
    limite.iniciar(const Duration(milliseconds: 5), () async {
      vencio.complete();
    });
    await vencio.future.timeout(const Duration(seconds: 1));
    expect(vencio.isCompleted, isTrue);
  });
}

final class _EntradaVozFalsa implements EntradaVozLocal {
  _EntradaVozFalsa(this.texto);
  final String texto;

  @override
  bool get disponible => true;
  @override
  EstadoEntradaVozLocal get estado => EstadoEntradaVozLocal.completada;
  @override
  Stream<EstadoEntradaVozLocal> get cambiosEstado => const Stream.empty();
  @override
  Stream<String> get transcripcionesAutomaticas => const Stream.empty();
  @override
  Future<void> iniciarEscucha() async {}
  @override
  Future<String> detenerEscucha() async => texto;
  @override
  Future<void> cancelar() async {}
  @override
  Future<void> dispose() async {}
}

final class _EngineFalso implements LocalAiEngine {
  String? ultimaInstruccion;
  LocalAiRequest? ultimaSolicitud;

  @override
  Future<void> loadModel(String path) async {}

  @override
  Stream<String> generate(LocalAiRequest request) async* {
    ultimaSolicitud = request;
    ultimaInstruccion = request.userPrompt;
    yield '{"accion":"crear_cliente","parametros":{"nombre":"Ana","correo":"ana@correo.com"}}';
  }

  @override
  Future<void> dispose() async {}
}
