import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';
import 'package:sw1_local_ai_spike/persistencia/cliente_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/outbox_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/producto_local_repository.dart';
import 'package:sw1_local_ai_spike/sincronizacion/backend_api.dart';

final class ResultadoSincronizacion {
  const ResultadoSincronizacion({
    required this.sincronizadas,
    required this.errores,
  });

  final int sincronizadas;
  final int errores;
}

final class ServicioSincronizacion {
  const ServicioSincronizacion({
    required BaseDatosLocal baseDatos,
    required RepositorioClienteLocal clientes,
    required RepositorioProductoLocal productos,
    required RepositorioOutbox outbox,
    required BackendApi backend,
  }) : _baseDatos = baseDatos,
       _clientes = clientes,
       _productos = productos,
       _outbox = outbox,
       _backend = backend;

  final BaseDatosLocal _baseDatos;
  final RepositorioClienteLocal _clientes;
  final RepositorioProductoLocal _productos;
  final RepositorioOutbox _outbox;
  final BackendApi _backend;

  Future<ResultadoSincronizacion> sincronizar() async {
    final operaciones = await _outbox.listarElegibles();
    var sincronizadas = 0;
    var errores = 0;

    for (final operacion in operaciones) {
      try {
        final respuesta = await _enviar(operacion);
        await _baseDatos.transaccion((acceso) async {
          await _marcarEntidad(operacion, respuesta.idRemoto, acceso: acceso);
          await _outbox.registrarResultado(
            operacion,
            EstadoOperacionOutbox.sincronizada,
            acceso: acceso,
          );
        });
        sincronizadas++;
      } catch (error) {
        await _outbox.registrarResultado(
          operacion,
          EstadoOperacionOutbox.error,
          error: _mensajeSeguro(error),
        );
        errores++;
      }
    }

    return ResultadoSincronizacion(
      sincronizadas: sincronizadas,
      errores: errores,
    );
  }

  Future<ResultadoCreacionRemota> _enviar(OperacionPendiente operacion) =>
      switch (operacion.tipo) {
        ConfiguracionDominioExamen.accionCrearCliente => _backend.crearCliente(
          nombre: operacion.payload['nombre']! as String,
          correo: operacion.payload['correo']! as String,
        ),
        ConfiguracionDominioExamen.accionCrearProducto =>
          _backend.crearProducto(
            nombre: operacion.payload['nombre']! as String,
            precio: operacion.payload['precio']! as num,
          ),
        _ => throw ErrorBackendApi(
          'Operación de sincronización no soportada: ${operacion.tipo}.',
        ),
      };

  Future<void> _marcarEntidad(
    OperacionPendiente operacion,
    String idRemoto, {
    required AccesoDatosLocal acceso,
  }) => switch (operacion.entidad) {
    ConfiguracionDominioExamen.entidadCliente => _clientes.marcarSincronizado(
      operacion.entidadIdLocal,
      idRemoto,
      acceso: acceso,
    ),
    ConfiguracionDominioExamen.entidadProducto => _productos.marcarSincronizado(
      operacion.entidadIdLocal,
      idRemoto,
      acceso: acceso,
    ),
    _ => throw StateError('Entidad local no soportada: ${operacion.entidad}.'),
  };

  String _mensajeSeguro(Object error) {
    final mensaje = error.toString().trim();
    return mensaje.length <= 500 ? mensaje : mensaje.substring(0, 500);
  }
}
