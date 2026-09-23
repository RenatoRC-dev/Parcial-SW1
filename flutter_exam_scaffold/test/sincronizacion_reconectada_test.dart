import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:sw1_local_ai_spike/sincronizacion/monitor_conectividad.dart';

void main() {
  test('inicio con red intenta sincronizar una sola vez', () async {
    final monitor = _MonitorFalso(true);
    var ejecuciones = 0;
    final coordinador = CoordinadorSincronizacionReconectada(
      monitor: monitor,
      sincronizar: (_) async => ejecuciones++,
    );
    addTearDown(coordinador.dispose);

    await coordinador.iniciar();

    expect(ejecuciones, 1);
  });

  test(
    'reconexión dispara una sincronización y no repite eventos online',
    () async {
      final monitor = _MonitorFalso(false);
      var ejecuciones = 0;
      final coordinador = CoordinadorSincronizacionReconectada(
        monitor: monitor,
        sincronizar: (automatica) async {
          expect(automatica, isTrue);
          ejecuciones++;
        },
      );
      addTearDown(coordinador.dispose);
      await coordinador.iniciar();

      await coordinador.notificarDisponibilidad(true);
      await coordinador.notificarDisponibilidad(true);

      expect(ejecuciones, 1);
    },
  );

  test('evita sincronizaciones concurrentes y mantiene la manual', () async {
    final monitor = _MonitorFalso(false);
    final bloqueo = Completer<void>();
    var ejecuciones = 0;
    final coordinador = CoordinadorSincronizacionReconectada(
      monitor: monitor,
      sincronizar: (_) async {
        ejecuciones++;
        await bloqueo.future;
      },
    );
    addTearDown(coordinador.dispose);
    await coordinador.iniciar();

    final automatica = coordinador.notificarDisponibilidad(true);
    await Future<void>.delayed(Duration.zero);
    expect(await coordinador.ejecutarManual(), isFalse);
    bloqueo.complete();
    expect(await automatica, isTrue);
    expect(await coordinador.ejecutarManual(), isTrue);
    expect(ejecuciones, 2);
  });
}

final class _MonitorFalso implements MonitorConectividad {
  _MonitorFalso(this.disponible);
  bool disponible;
  final _cambios = StreamController<bool>.broadcast();

  @override
  Stream<bool> get cambiosDisponibilidad => _cambios.stream;
  @override
  Future<bool> estaDisponible() async => disponible;
  @override
  Future<void> dispose() => _cambios.close();
}
