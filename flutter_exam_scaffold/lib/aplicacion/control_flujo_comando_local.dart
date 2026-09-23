import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sw1_local_ai_spike/aplicacion/ejecutor_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/interpretador_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/resumen_comando_local.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';

enum FaseFlujoComandoLocal {
  listo,
  interpretando,
  confirmando,
  requiereCorreccion,
  ejecutando,
  completado,
  noIdentificado,
  error,
}

/// Coordina interpretación, confirmación y ejecución. Es la guarda única que
/// impide persistir dos veces por pulsaciones concurrentes.
final class ControlFlujoComandoLocal {
  ControlFlujoComandoLocal({
    required Future<ResultadoInterpretacionLocal> Function(String instruccion)
    interpretar,
    required Future<ResultadoEjecucionLocal> Function(ComandoLocal comando)
    ejecutar,
  }) : _interpretar = interpretar,
       _ejecutar = ejecutar;

  final Future<ResultadoInterpretacionLocal> Function(String) _interpretar;
  final Future<ResultadoEjecucionLocal> Function(ComandoLocal) _ejecutar;
  final _cambios = StreamController<FaseFlujoComandoLocal>.broadcast();
  FaseFlujoComandoLocal _fase = FaseFlujoComandoLocal.listo;
  ResumenComandoLocal? _pendiente;
  ResultadoInterpretacionLocal? _interpretacion;
  ResultadoEjecucionLocal? _resultado;
  String? _error;
  bool _ocupado = false;

  FaseFlujoComandoLocal get fase => _fase;
  Stream<FaseFlujoComandoLocal> get cambios => _cambios.stream;
  ResumenComandoLocal? get pendiente => _pendiente;
  ResultadoInterpretacionLocal? get interpretacion => _interpretacion;
  ResultadoEjecucionLocal? get resultado => _resultado;
  String? get error => _error;

  void _cambiar(FaseFlujoComandoLocal fase) {
    _fase = fase;
    if (!_cambios.isClosed) _cambios.add(fase);
  }

  Future<bool> interpretar(String instruccion) async {
    if (_ocupado || _pendiente != null) return false;
    _ocupado = true;
    _error = null;
    _resultado = null;
    _interpretacion = null;
    _cambiar(FaseFlujoComandoLocal.interpretando);
    try {
      final interpretacion = await _interpretar(instruccion);
      final resumen = resumirComandoLocal(interpretacion.comando);
      _interpretacion = interpretacion;
      if (kDebugMode) {
        debugPrint('[COMMAND] action=${_accionWire(resumen.accion)}');
        debugPrint('[VALIDATION] valid=true errors=[]');
      }
      if (resumen.requiereConfirmacion) {
        _pendiente = resumen;
        _cambiar(FaseFlujoComandoLocal.confirmando);
        if (kDebugMode) {
          debugPrint('[FLOW] state=awaiting_confirmation');
        }
      } else {
        await _ejecutarValidado(resumen.comando!);
      }
      return true;
    } on ErrorParametrosComandoLocal catch (error) {
      _pendiente = resumirBorradorComandoLocal(error.borrador);
      _error = null;
      if (kDebugMode) {
        debugPrint('[COMMAND] action=${_accionWire(error.borrador.accion)}');
        debugPrint(
          '[VALIDATION] valid=false errors=${error.borrador.errores.keys.toList()}',
        );
        debugPrint('[FLOW] state=requires_correction');
      }
      _cambiar(FaseFlujoComandoLocal.requiereCorreccion);
      return true;
    } on ErrorAccionNoSoportadaLocal {
      _error = 'No pude identificar una acción válida.';
      _cambiar(FaseFlujoComandoLocal.noIdentificado);
      return false;
    } catch (_) {
      _error = 'No se pudo interpretar la solicitud. Intenta nuevamente.';
      _cambiar(FaseFlujoComandoLocal.error);
      return false;
    } finally {
      _ocupado = false;
    }
  }

  Future<bool> confirmar() async {
    final resumen = _pendiente;
    final comando = resumen?.comando;
    if (_ocupado || resumen == null || comando == null) return false;
    _ocupado = true;
    _pendiente = null;
    try {
      if (kDebugMode) {
        debugPrint('[EXECUTION] action=${_accionWire(resumen.accion)}');
      }
      await _ejecutarValidado(comando);
      return true;
    } finally {
      _ocupado = false;
    }
  }

  Future<void> _ejecutarValidado(ComandoLocal comando) async {
    _cambiar(FaseFlujoComandoLocal.ejecutando);
    try {
      _resultado = await _ejecutar(comando);
      if (kDebugMode) {
        debugPrint('[EXECUTION] success=true');
        if (comando.accion != TipoAccionLocal.consultarClientes) {
          debugPrint('[OUTBOX] queued=true');
        }
      }
      _error = null;
      _cambiar(FaseFlujoComandoLocal.completado);
    } catch (_) {
      _error = 'No se pudo realizar la acción. Tus datos siguen seguros.';
      _cambiar(FaseFlujoComandoLocal.error);
    }
  }

  void cancelar() {
    if (_fase != FaseFlujoComandoLocal.confirmando &&
        _fase != FaseFlujoComandoLocal.requiereCorreccion) {
      return;
    }
    _pendiente = null;
    _interpretacion = null;
    _error = null;
    _cambiar(FaseFlujoComandoLocal.listo);
  }

  bool modificar(Map<String, String> valores) {
    final resumen = _pendiente;
    if (_ocupado || resumen == null) return false;
    final modificado = modificarResumenComandoLocal(resumen, valores);
    _pendiente = modificado;
    _error = null;
    if (modificado.esValido) {
      _cambiar(FaseFlujoComandoLocal.confirmando);
      if (kDebugMode) debugPrint('[FLOW] state=awaiting_confirmation');
      return true;
    }
    _cambiar(FaseFlujoComandoLocal.requiereCorreccion);
    if (kDebugMode) debugPrint('[FLOW] state=requires_correction');
    return false;
  }

  void reiniciar() {
    if (_ocupado) return;
    _pendiente = null;
    _interpretacion = null;
    _resultado = null;
    _error = null;
    _cambiar(FaseFlujoComandoLocal.listo);
  }

  Future<void> dispose() => _cambios.close();
}

String _accionWire(TipoAccionLocal accion) => switch (accion) {
  TipoAccionLocal.crearCliente => ConfiguracionDominioExamen.accionCrearCliente,
  TipoAccionLocal.crearProducto =>
    ConfiguracionDominioExamen.accionCrearProducto,
  TipoAccionLocal.consultarClientes =>
    ConfiguracionDominioExamen.accionConsultarClientes,
};
