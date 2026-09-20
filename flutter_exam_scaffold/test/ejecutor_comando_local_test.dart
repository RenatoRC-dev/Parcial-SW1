import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:sw1_local_ai_spike/aplicacion/ejecutor_comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/dominio/validador_comando_local.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';
import 'package:sw1_local_ai_spike/persistencia/cliente_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/outbox_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/producto_local_repository.dart';

void main() {
  sqfliteFfiInit();

  late Directory temporal;
  late String ruta;
  late _ContextoPrueba contexto;

  setUp(() async {
    temporal = await Directory.systemTemp.createTemp('sw1_offline_test_');
    ruta = '${temporal.path}${Platform.pathSeparator}offline.db';
    contexto = _ContextoPrueba(ruta);
    await contexto.baseDatos.abrir();
  });

  tearDown(() async {
    await contexto.baseDatos.cerrar();
    await temporal.delete(recursive: true);
  });

  test('crear_cliente guarda cliente y exactamente una operación', () async {
    final resultado = await contexto.ejecutor.ejecutar(
      const ComandoLocal(
        accion: TipoAccionLocal.crearCliente,
        parametros: {'nombre': 'Ana', 'correo': 'ana@correo.com'},
      ),
    );

    final clientes = await contexto.clientes.listar();
    final operaciones = await contexto.outbox.listar();
    expect(clientes, hasLength(1));
    expect(clientes.single.nombre, 'Ana');
    expect(clientes.single.estadoSync, 'pendiente');
    expect(operaciones, hasLength(1));
    expect(operaciones.single.tipo, 'crear_cliente');
    expect(operaciones.single.entidadIdLocal, clientes.single.idLocal);
    expect(operaciones.single.estado, EstadoOperacionOutbox.pendiente);
    expect(operaciones.single.payload, {
      'nombre': 'Ana',
      'correo': 'ana@correo.com',
    });
    expect(resultado.pendientes, 1);
  });

  test('crear_producto guarda producto y outbox pendiente', () async {
    await contexto.ejecutor.ejecutar(
      const ComandoLocal(
        accion: TipoAccionLocal.crearProducto,
        parametros: {'nombre': 'Laptop', 'precio': 3500},
      ),
    );

    final productos = await contexto.productos.listar();
    final operaciones = await contexto.outbox.listar();
    expect(productos, hasLength(1));
    expect(productos.single.nombre, 'Laptop');
    expect(productos.single.precio, 3500);
    expect(operaciones, hasLength(1));
    expect(operaciones.single.tipo, 'crear_producto');
    expect(operaciones.single.payload['precio'], 3500);
  });

  test('consultar_clientes devuelve persistidos y no crea outbox', () async {
    await contexto.ejecutor.ejecutar(
      const ComandoLocal(
        accion: TipoAccionLocal.crearCliente,
        parametros: {'nombre': 'Ana', 'correo': 'ana@correo.com'},
      ),
    );
    final operacionesAntes = await contexto.outbox.listar();

    final resultado = await contexto.ejecutor.ejecutar(
      const ComandoLocal(
        accion: TipoAccionLocal.consultarClientes,
        parametros: {},
      ),
    );

    expect(resultado.clientes.single.nombre, 'Ana');
    expect(await contexto.outbox.listar(), hasLength(operacionesAntes.length));
  });

  test('una acción no soportada no modifica SQLite', () async {
    expect(
      () => validarRespuestaLocal('{"accion":"no_soportada","parametros":{}}'),
      throwsA(isA<ErrorComandoLocal>()),
    );

    expect(await contexto.clientes.listar(), isEmpty);
    expect(await contexto.productos.listar(), isEmpty);
    expect(await contexto.outbox.listar(), isEmpty);
  });

  test('un fallo de outbox revierte la inserción de entidad', () async {
    final ejecutor = EjecutorComandoLocal(
      baseDatos: contexto.baseDatos,
      clientes: contexto.clientes,
      productos: contexto.productos,
      outbox: _OutboxQueFalla(contexto.outbox),
      generarId: contexto.generarId,
      ahora: contexto.ahora,
    );

    await expectLater(
      ejecutor.ejecutar(
        const ComandoLocal(
          accion: TipoAccionLocal.crearCliente,
          parametros: {'nombre': 'Ana', 'correo': 'ana@correo.com'},
        ),
      ),
      throwsStateError,
    );

    expect(await contexto.clientes.listar(), isEmpty);
    expect(await contexto.outbox.listar(), isEmpty);
  });

  test('datos y outbox sobreviven reapertura de la base', () async {
    await contexto.ejecutor.ejecutar(
      const ComandoLocal(
        accion: TipoAccionLocal.crearCliente,
        parametros: {'nombre': 'Ana', 'correo': 'ana@correo.com'},
      ),
    );
    await contexto.baseDatos.cerrar();

    contexto = _ContextoPrueba(ruta);
    await contexto.baseDatos.abrir();

    expect((await contexto.clientes.listar()).single.nombre, 'Ana');
    expect(await contexto.outbox.contarPendientes(), 1);
  });
}

final class _ContextoPrueba {
  _ContextoPrueba(String ruta)
    : baseDatos = BaseDatosLocal(factory: databaseFactoryFfi, ruta: ruta) {
    clientes = ClienteLocalRepository(baseDatos);
    productos = ProductoLocalRepository(baseDatos);
    outbox = OutboxRepository(baseDatos);
    ejecutor = EjecutorComandoLocal(
      baseDatos: baseDatos,
      clientes: clientes,
      productos: productos,
      outbox: outbox,
      generarId: generarId,
      ahora: ahora,
    );
  }

  final BaseDatosLocal baseDatos;
  late final ClienteLocalRepository clientes;
  late final ProductoLocalRepository productos;
  late final OutboxRepository outbox;
  late final EjecutorComandoLocal ejecutor;
  int _secuencia = 0;

  String generarId() => 'id-${_secuencia++}';
  DateTime ahora() => DateTime.utc(2026, 9, 20, 12);
}

final class _OutboxQueFalla implements RepositorioOutbox {
  const _OutboxQueFalla(this._real);
  final RepositorioOutbox _real;

  @override
  Future<void> encolar(
    OperacionPendiente operacion, {
    AccesoDatosLocal? acceso,
  }) => throw StateError('Fallo simulado de outbox');

  @override
  Future<int> contarPendientes() => _real.contarPendientes();

  @override
  Future<List<OperacionPendiente>> listar() => _real.listar();
}
