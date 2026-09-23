import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:sw1_local_ai_spike/aplicacion/ejecutor_comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';
import 'package:sw1_local_ai_spike/persistencia/cliente_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/configuracion_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/outbox_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/producto_local_repository.dart';
import 'package:sw1_local_ai_spike/sincronizacion/backend_api.dart';
import 'package:sw1_local_ai_spike/sincronizacion/servicio_sincronizacion.dart';

void main() {
  sqfliteFfiInit();
  late Directory temporal;
  late _ContextoSync contexto;

  setUp(() async {
    temporal = await Directory.systemTemp.createTemp('sw1_sync_test_');
    contexto = _ContextoSync(
      '${temporal.path}${Platform.pathSeparator}offline.db',
    );
    await contexto.baseDatos.abrir();
  });

  tearDown(() async {
    await contexto.baseDatos.cerrar();
    await temporal.delete(recursive: true);
  });

  test('sincroniza cliente y producto FIFO y persiste IDs remotos', () async {
    await contexto.crearCliente();
    await contexto.crearProducto();

    final resultado = await contexto.servicio.sincronizar();

    expect(resultado.sincronizadas, 2);
    expect(resultado.errores, 0);
    expect(contexto.backend.llamadas, ['cliente:Ana', 'producto:Laptop']);
    final cliente = (await contexto.clientes.listar()).single;
    final producto = (await contexto.productos.listar()).single;
    expect(cliente.estadoSync, 'sincronizada');
    expect(cliente.idRemoto, '101');
    expect(producto.estadoSync, 'sincronizada');
    expect(producto.idRemoto, '202');
    final operaciones = await contexto.outbox.listar();
    expect(
      operaciones.map((operacion) => operacion.estado),
      everyElement(EstadoOperacionOutbox.sincronizada),
    );
    expect(operaciones.map((operacion) => operacion.intentos), everyElement(0));
  });

  test('no reenvía operaciones ya sincronizadas', () async {
    await contexto.crearCliente();
    await contexto.servicio.sincronizar();
    final llamadas = contexto.backend.llamadas.length;

    final segundo = await contexto.servicio.sincronizar();

    expect(segundo.sincronizadas, 0);
    expect(contexto.backend.llamadas, hasLength(llamadas));
  });

  test(
    'fallo conserva datos, incrementa intentos y permite reintento',
    () async {
      await contexto.crearCliente();
      contexto.backend.fallarCliente = true;

      final fallido = await contexto.servicio.sincronizar();

      expect(fallido.errores, 1);
      expect((await contexto.clientes.listar()).single.nombre, 'Ana');
      var operacion = (await contexto.outbox.listar()).single;
      expect(operacion.estado, EstadoOperacionOutbox.error);
      expect(operacion.intentos, 1);
      expect(operacion.ultimoError, contains('red simulado'));

      contexto.backend.fallarCliente = false;
      final reintento = await contexto.servicio.sincronizar();
      expect(reintento.sincronizadas, 1);
      operacion = (await contexto.outbox.listar()).single;
      expect(operacion.estado, EstadoOperacionOutbox.sincronizada);
      expect(operacion.intentos, 1);
      expect(operacion.ultimoError, isNull);
    },
  );

  test('un fallo no impide sincronizar operaciones posteriores', () async {
    await contexto.crearCliente();
    await contexto.crearProducto();
    contexto.backend.fallarCliente = true;

    final resultado = await contexto.servicio.sincronizar();

    expect(resultado.errores, 1);
    expect(resultado.sincronizadas, 1);
    expect(
      (await contexto.productos.listar()).single.estadoSync,
      'sincronizada',
    );
    expect((await contexto.clientes.listar()).single.estadoSync, 'pendiente');
  });

  test('URL del backend se valida y persiste', () async {
    final configuracion = ConfiguracionLocalRepository(contexto.baseDatos);
    await configuracion.guardarBackendUrl('http://192.168.1.50:8080/');
    expect(await configuracion.obtenerBackendUrl(), 'http://192.168.1.50:8080');
    expect(
      () => configuracion.guardarBackendUrl('sin-host'),
      throwsA(isA<FormatException>()),
    );
    expect(
      () => configuracion.guardarBackendUrl('http://192.168.0.8.8080'),
      throwsA(isA<FormatException>()),
    );
  });

  test('migración v1 conserva datos y agrega identidad remota', () async {
    await contexto.baseDatos.cerrar();
    final ruta = contexto.ruta;
    await File(ruta).delete();
    final antigua = await databaseFactoryFfi.openDatabase(
      ruta,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, version) async {
          await db.execute(
            'CREATE TABLE clientes_locales (id_local TEXT PRIMARY KEY, nombre TEXT NOT NULL, correo TEXT NOT NULL, estado_sync TEXT NOT NULL, creado_en TEXT NOT NULL)',
          );
          await db.execute(
            'CREATE TABLE productos_locales (id_local TEXT PRIMARY KEY, nombre TEXT NOT NULL, precio REAL NOT NULL, estado_sync TEXT NOT NULL, creado_en TEXT NOT NULL)',
          );
          await db.execute(
            "CREATE TABLE operaciones_pendientes (id TEXT PRIMARY KEY, tipo TEXT NOT NULL, entidad TEXT NOT NULL, entidad_id_local TEXT NOT NULL, payload TEXT NOT NULL, estado TEXT NOT NULL, intentos INTEGER NOT NULL DEFAULT 0, ultimo_error TEXT, creado_en TEXT NOT NULL)",
          );
          await db.insert('clientes_locales', {
            'id_local': 'legacy-ana',
            'nombre': 'Ana',
            'correo': 'ana@correo.com',
            'estado_sync': 'pendiente',
            'creado_en': '2026-09-20T12:00:00.000Z',
          });
        },
      ),
    );
    await antigua.close();

    contexto = _ContextoSync(ruta);
    await contexto.baseDatos.abrir();

    final cliente = (await contexto.clientes.listar()).single;
    expect(cliente.nombre, 'Ana');
    expect(cliente.idRemoto, isNull);
    await ConfiguracionLocalRepository(
      contexto.baseDatos,
    ).guardarBackendUrl('http://10.0.2.2:8080');
  });
}

final class _ContextoSync {
  _ContextoSync(this.ruta)
    : baseDatos = BaseDatosLocal(factory: databaseFactoryFfi, ruta: ruta) {
    clientes = ClienteLocalRepository(baseDatos);
    productos = ProductoLocalRepository(baseDatos);
    outbox = OutboxRepository(baseDatos);
    ejecutor = EjecutorComandoLocal(
      baseDatos: baseDatos,
      clientes: clientes,
      productos: productos,
      outbox: outbox,
      generarId: () => 'id-${_secuencia++}',
      ahora: () => DateTime.utc(2026, 9, 20, 12, 0, _secuencia),
    );
    servicio = ServicioSincronizacion(
      baseDatos: baseDatos,
      clientes: clientes,
      productos: productos,
      outbox: outbox,
      backend: backend,
    );
  }

  final String ruta;
  final BaseDatosLocal baseDatos;
  final backend = _BackendFalso();
  late final ClienteLocalRepository clientes;
  late final ProductoLocalRepository productos;
  late final OutboxRepository outbox;
  late final EjecutorComandoLocal ejecutor;
  late final ServicioSincronizacion servicio;
  int _secuencia = 0;

  Future<void> crearCliente() => ejecutor.ejecutar(
    const ComandoLocal(
      accion: TipoAccionLocal.crearCliente,
      parametros: {'nombre': 'Ana', 'correo': 'ana@correo.com'},
    ),
  );

  Future<void> crearProducto() => ejecutor.ejecutar(
    const ComandoLocal(
      accion: TipoAccionLocal.crearProducto,
      parametros: {'nombre': 'Laptop', 'precio': 3500},
    ),
  );
}

final class _BackendFalso implements BackendApi {
  final llamadas = <String>[];
  bool fallarCliente = false;

  @override
  Future<ResultadoCreacionRemota> crearCliente({
    required String nombre,
    required String correo,
  }) async {
    llamadas.add('cliente:$nombre');
    if (fallarCliente) {
      throw const ErrorBackendApi('fallo de red simulado');
    }
    return const ResultadoCreacionRemota(idRemoto: '101');
  }

  @override
  Future<ResultadoCreacionRemota> crearProducto({
    required String nombre,
    required num precio,
  }) async {
    llamadas.add('producto:$nombre');
    return const ResultadoCreacionRemota(idRemoto: '202');
  }
}
