import 'package:sw1_local_ai_spike/dominio/cliente_local.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/dominio/producto_local.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';
import 'package:sw1_local_ai_spike/persistencia/cliente_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/outbox_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/producto_local_repository.dart';
import 'package:uuid/uuid.dart';

final class ResultadoEjecucionLocal {
  const ResultadoEjecucionLocal({
    required this.mensaje,
    required this.pendientes,
    this.clientes = const [],
  });

  final String mensaje;
  final int pendientes;
  final List<ClienteLocal> clientes;
}

final class EjecutorComandoLocal {
  EjecutorComandoLocal({
    required BaseDatosLocal baseDatos,
    required RepositorioClienteLocal clientes,
    required RepositorioProductoLocal productos,
    required RepositorioOutbox outbox,
    String Function()? generarId,
    DateTime Function()? ahora,
  }) : _baseDatos = baseDatos,
       _clientes = clientes,
       _productos = productos,
       _outbox = outbox,
       _generarId = generarId ?? const Uuid().v4,
       _ahora = ahora ?? DateTime.now;

  final BaseDatosLocal _baseDatos;
  final RepositorioClienteLocal _clientes;
  final RepositorioProductoLocal _productos;
  final RepositorioOutbox _outbox;
  final String Function() _generarId;
  final DateTime Function() _ahora;

  Future<ResultadoEjecucionLocal> ejecutar(ComandoLocal comando) =>
      switch (comando.accion) {
        TipoAccionLocal.crearCliente => _crearCliente(comando.parametros),
        TipoAccionLocal.crearProducto => _crearProducto(comando.parametros),
        TipoAccionLocal.consultarClientes => _consultarClientes(),
      };

  Future<ResultadoEjecucionLocal> _crearCliente(
    Map<String, Object> parametros,
  ) async {
    final id = _generarId();
    final fecha = _ahora().toUtc();
    final payload = {
      'nombre': parametros['nombre']! as String,
      'correo': parametros['correo']! as String,
    };
    await _baseDatos.transaccion((acceso) async {
      await _clientes.guardar(
        ClienteLocal(
          idLocal: id,
          nombre: payload['nombre']!,
          correo: payload['correo']!,
          estadoSync: EstadoOperacionOutbox.pendiente.name,
          creadoEn: fecha,
        ),
        acceso: acceso,
      );
      await _outbox.encolar(
        _operacion(
          tipo: 'crear_cliente',
          entidad: 'cliente',
          entidadId: id,
          payload: payload,
          fecha: fecha,
        ),
        acceso: acceso,
      );
    });
    return ResultadoEjecucionLocal(
      mensaje: 'Cliente guardado localmente. Pendiente de sincronización.',
      pendientes: await _outbox.contarPendientes(),
    );
  }

  Future<ResultadoEjecucionLocal> _crearProducto(
    Map<String, Object> parametros,
  ) async {
    final id = _generarId();
    final fecha = _ahora().toUtc();
    final payload = {
      'nombre': parametros['nombre']! as String,
      'precio': parametros['precio']! as num,
    };
    await _baseDatos.transaccion((acceso) async {
      await _productos.guardar(
        ProductoLocal(
          idLocal: id,
          nombre: payload['nombre']! as String,
          precio: (payload['precio']! as num).toDouble(),
          estadoSync: EstadoOperacionOutbox.pendiente.name,
          creadoEn: fecha,
        ),
        acceso: acceso,
      );
      await _outbox.encolar(
        _operacion(
          tipo: 'crear_producto',
          entidad: 'producto',
          entidadId: id,
          payload: payload,
          fecha: fecha,
        ),
        acceso: acceso,
      );
    });
    return ResultadoEjecucionLocal(
      mensaje: 'Producto guardado localmente. Pendiente de sincronización.',
      pendientes: await _outbox.contarPendientes(),
    );
  }

  Future<ResultadoEjecucionLocal> _consultarClientes() async {
    final clientes = await _clientes.listar();
    return ResultadoEjecucionLocal(
      mensaje: clientes.isEmpty
          ? 'No hay clientes guardados localmente.'
          : 'Clientes locales: ${clientes.length}.',
      pendientes: await _outbox.contarPendientes(),
      clientes: clientes,
    );
  }

  OperacionPendiente _operacion({
    required String tipo,
    required String entidad,
    required String entidadId,
    required Map<String, Object> payload,
    required DateTime fecha,
  }) => OperacionPendiente(
    id: _generarId(),
    tipo: tipo,
    entidad: entidad,
    entidadIdLocal: entidadId,
    payload: payload,
    estado: EstadoOperacionOutbox.pendiente,
    intentos: 0,
    creadoEn: fecha,
  );
}
