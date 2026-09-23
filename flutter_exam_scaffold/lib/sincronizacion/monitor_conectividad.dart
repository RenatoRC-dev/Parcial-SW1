import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

abstract interface class MonitorConectividad {
  Stream<bool> get cambiosDisponibilidad;
  Future<bool> estaDisponible();
  Future<void> dispose();
}

/// Solo detecta que existe una red potencial. La disponibilidad real del
/// backend se verifica mediante el intento HTTP seguro de sincronización.
final class MonitorConectividadPlus implements MonitorConectividad {
  MonitorConectividadPlus({Connectivity? connectivity})
    : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Stream<bool> get cambiosDisponibilidad => _connectivity.onConnectivityChanged
      .map((resultados) => resultados.any((r) => r != ConnectivityResult.none))
      .distinct();

  @override
  Future<bool> estaDisponible() async =>
      (await _connectivity.checkConnectivity()).any(
        (r) => r != ConnectivityResult.none,
      );

  @override
  Future<void> dispose() async {}
}

final class CoordinadorSincronizacionReconectada {
  CoordinadorSincronizacionReconectada({
    required MonitorConectividad monitor,
    required Future<void> Function(bool automatica) sincronizar,
    void Function(bool disponible)? alCambiarDisponibilidad,
  }) : _monitor = monitor,
       _sincronizar = sincronizar,
       _alCambiarDisponibilidad = alCambiarDisponibilidad;

  final MonitorConectividad _monitor;
  final Future<void> Function(bool automatica) _sincronizar;
  final void Function(bool disponible)? _alCambiarDisponibilidad;
  StreamSubscription<bool>? _suscripcion;
  bool _enCurso = false;
  bool? _disponibleAnterior;

  bool get enCurso => _enCurso;

  Future<void> iniciar() async {
    _disponibleAnterior = await _monitor.estaDisponible();
    _alCambiarDisponibilidad?.call(_disponibleAnterior!);
    _suscripcion = _monitor.cambiosDisponibilidad.listen((disponible) {
      unawaited(notificarDisponibilidad(disponible));
    });
    if (_disponibleAnterior!) await _ejecutar(automatica: true);
  }

  Future<bool> notificarDisponibilidad(bool disponible) async {
    _alCambiarDisponibilidad?.call(disponible);
    final recuperada = _disponibleAnterior == false && disponible;
    _disponibleAnterior = disponible;
    return recuperada ? _ejecutar(automatica: true) : false;
  }

  Future<bool> alReanudar() async {
    final disponible = await _monitor.estaDisponible();
    _alCambiarDisponibilidad?.call(disponible);
    _disponibleAnterior = disponible;
    return disponible ? _ejecutar(automatica: true) : false;
  }

  Future<bool> ejecutarManual() => _ejecutar(automatica: false);

  Future<bool> _ejecutar({required bool automatica}) async {
    if (_enCurso) return false;
    _enCurso = true;
    try {
      await _sincronizar(automatica);
      return true;
    } finally {
      _enCurso = false;
    }
  }

  Future<void> dispose() async {
    await _suscripcion?.cancel();
    await _monitor.dispose();
  }
}
