import 'package:sw1_local_ai_spike/dominio/cliente_local.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';

abstract interface class RepositorioClienteLocal {
  Future<void> guardar(ClienteLocal cliente, {AccesoDatosLocal? acceso});
  Future<List<ClienteLocal>> listar();
  Future<void> marcarSincronizado(
    String idLocal,
    String? idRemoto, {
    AccesoDatosLocal? acceso,
  });
}

final class ClienteLocalRepository implements RepositorioClienteLocal {
  const ClienteLocalRepository(this._baseDatos);
  final BaseDatosLocal _baseDatos;

  @override
  Future<void> guardar(ClienteLocal cliente, {AccesoDatosLocal? acceso}) =>
      (acceso ?? _baseDatos).insertar('clientes_locales', {
        'id_local': cliente.idLocal,
        'nombre': cliente.nombre,
        'correo': cliente.correo,
        'estado_sync': cliente.estadoSync,
        'id_remoto': cliente.idRemoto,
        'creado_en': cliente.creadoEn.toUtc().toIso8601String(),
      });

  @override
  Future<List<ClienteLocal>> listar() async {
    final filas = await _baseDatos.consultar(
      'clientes_locales',
      ordenarPor: 'creado_en ASC',
    );
    return filas
        .map(
          (fila) => ClienteLocal(
            idLocal: fila['id_local']! as String,
            nombre: fila['nombre']! as String,
            correo: fila['correo']! as String,
            estadoSync: fila['estado_sync']! as String,
            idRemoto: fila['id_remoto'] as String?,
            creadoEn: DateTime.parse(fila['creado_en']! as String),
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<void> marcarSincronizado(
    String idLocal,
    String? idRemoto, {
    AccesoDatosLocal? acceso,
  }) => (acceso ?? _baseDatos).actualizar(
    'clientes_locales',
    {'estado_sync': 'sincronizada', 'id_remoto': idRemoto},
    donde: 'id_local = ?',
    argumentos: [idLocal],
  );
}
