import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:sw1_local_ai_spike/aplicacion/control_flujo_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/ejecutor_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/interpretador_comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';

void main() {
  ResultadoInterpretacionLocal interpretacion(ComandoLocal comando) =>
      ResultadoInterpretacionLocal(
        comando: comando,
        duracion: const Duration(milliseconds: 1),
      );

  const cliente = ComandoLocal(
    accion: TipoAccionLocal.crearCliente,
    parametros: {'nombre': 'Carlos', 'correo': 'carlos@correo.com'},
  );
  const consulta = ComandoLocal(
    accion: TipoAccionLocal.consultarClientes,
    parametros: {},
  );

  test(
    'mutacion espera confirmacion y confirmar ejecuta exactamente una vez',
    () async {
      var ejecuciones = 0;
      final espera = Completer<void>();
      final control = ControlFlujoComandoLocal(
        interpretar: (_) async => interpretacion(cliente),
        ejecutar: (_) async {
          ejecuciones++;
          await espera.future;
          return const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 1);
        },
      );

      await control.interpretar('voz interna');
      expect(control.fase, FaseFlujoComandoLocal.confirmando);
      expect(ejecuciones, 0);

      final primera = control.confirmar();
      final segunda = await control.confirmar();
      expect(segunda, isFalse);
      espera.complete();
      await primera;
      expect(ejecuciones, 1);
    },
  );

  test('cancelar descarta el comando sin ejecutar', () async {
    var ejecuciones = 0;
    final control = ControlFlujoComandoLocal(
      interpretar: (_) async => interpretacion(cliente),
      ejecutar: (_) async {
        ejecuciones++;
        return const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 1);
      },
    );
    await control.interpretar('crear');
    control.cancelar();
    expect(control.fase, FaseFlujoComandoLocal.listo);
    expect(control.pendiente, isNull);
    expect(ejecuciones, 0);
  });

  test(
    'modificar revalida campos estructurados sin volver a interpretar',
    () async {
      var interpretaciones = 0;
      ComandoLocal? ejecutado;
      final control = ControlFlujoComandoLocal(
        interpretar: (_) async {
          interpretaciones++;
          return interpretacion(cliente);
        },
        ejecutar: (comando) async {
          ejecutado = comando;
          return const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 1);
        },
      );
      await control.interpretar('crear');
      expect(
        control.modificar({'nombre': 'Ana', 'correo': 'ana@correo.com'}),
        isTrue,
      );
      await control.confirmar();
      expect(interpretaciones, 1);
      expect(ejecutado?.parametros['nombre'], 'Ana');
      expect(ejecutado?.parametros['correo'], 'ana@correo.com');
    },
  );

  test('modificacion invalida conserva confirmacion y no ejecuta', () async {
    var ejecuciones = 0;
    final control = ControlFlujoComandoLocal(
      interpretar: (_) async => interpretacion(cliente),
      ejecutar: (_) async {
        ejecuciones++;
        return const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 1);
      },
    );
    await control.interpretar('crear');
    expect(
      control.modificar({'nombre': '', 'correo': 'correo-invalido'}),
      isFalse,
    );
    expect(control.fase, FaseFlujoComandoLocal.requiereCorreccion);
    expect(control.pendiente, isNotNull);
    expect(
      control.pendiente?.campos.where((campo) => campo.error != null),
      isNotEmpty,
    );
    expect(ejecuciones, 0);
  });

  test('consulta de solo lectura se ejecuta sin confirmacion', () async {
    var ejecuciones = 0;
    final control = ControlFlujoComandoLocal(
      interpretar: (_) async => interpretacion(consulta),
      ejecutar: (_) async {
        ejecuciones++;
        return const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 0);
      },
    );
    await control.interpretar('consultar');
    expect(control.fase, FaseFlujoComandoLocal.completado);
    expect(control.pendiente, isNull);
    expect(ejecuciones, 1);
  });

  test('comando no soportado nunca ejecuta', () async {
    var ejecuciones = 0;
    final control = ControlFlujoComandoLocal(
      interpretar: (_) async => throw const ErrorAccionNoSoportadaLocal(
        'La acción no está soportada.',
      ),
      ejecutar: (_) async {
        ejecuciones++;
        return const ResultadoEjecucionLocal(mensaje: 'no', pendientes: 0);
      },
    );
    await control.interpretar('correo mañana');
    expect(control.fase, FaseFlujoComandoLocal.noIdentificado);
    expect(control.error, 'No pude identificar una acción válida.');
    expect(ejecuciones, 0);
  });

  test('accion conocida con correo invalido requiere correccion', () async {
    var ejecuciones = 0;
    final control = ControlFlujoComandoLocal(
      interpretar: (_) async => throw ErrorParametrosComandoLocal(
        borrador: const BorradorComandoLocal(
          accion: TipoAccionLocal.crearCliente,
          parametros: {
            'nombre': 'Carlos',
            'correo': 'Carlos Arrova correo.com',
          },
          errores: {'correo': 'Revisa el correo antes de continuar.'},
        ),
        mensaje: 'correo inválido',
      ),
      ejecutar: (_) async {
        ejecuciones++;
        return const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 1);
      },
    );

    expect(await control.interpretar('registrar'), isTrue);
    expect(control.fase, FaseFlujoComandoLocal.requiereCorreccion);
    expect(control.pendiente?.accion, TipoAccionLocal.crearCliente);
    expect(control.pendiente?.esValido, isFalse);
    expect(await control.confirmar(), isFalse);
    expect(ejecuciones, 0);

    expect(
      control.modificar({'nombre': 'Carlos', 'correo': 'carlos@correo.com'}),
      isTrue,
    );
    expect(control.fase, FaseFlujoComandoLocal.confirmando);
    await control.confirmar();
    expect(ejecuciones, 1);
  });

  test('accion producto con precio ausente requiere correccion', () async {
    final control = ControlFlujoComandoLocal(
      interpretar: (_) async => throw ErrorParametrosComandoLocal(
        borrador: const BorradorComandoLocal(
          accion: TipoAccionLocal.crearProducto,
          parametros: {'nombre': 'Laptop', 'precio': null},
          errores: {'precio': 'Revisa el precio antes de continuar.'},
        ),
        mensaje: 'precio inválido',
      ),
      ejecutar: (_) async =>
          const ResultadoEjecucionLocal(mensaje: 'ok', pendientes: 1),
    );
    await control.interpretar('producto');
    expect(control.fase, FaseFlujoComandoLocal.requiereCorreccion);
    expect(control.pendiente?.accion, TipoAccionLocal.crearProducto);
    expect(control.pendiente?.esValido, isFalse);
  });
}
