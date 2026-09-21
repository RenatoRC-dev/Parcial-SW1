import 'dart:convert';

import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';

abstract interface class RepositorioOutbox {
  Future<void> encolar(
    OperacionPendiente operacion, {
    AccesoDatosLocal? acceso,
  });
  Future<List<OperacionPendiente>> listar();
  Future<List<OperacionPendiente>> listarElegibles();
  Future<int> contarPendientes();
  Future<int> contarPorEstado(EstadoOperacionOutbox estado);
  Future<void> registrarResultado(
    OperacionPendiente operacion,
    EstadoOperacionOutbox estado, {
    String? error,
    AccesoDatosLocal? acceso,
  });
}

final class OutboxRepository implements RepositorioOutbox {
  const OutboxRepository(this._baseDatos);
  final BaseDatosLocal _baseDatos;

  @override
  Future<void> encolar(
    OperacionPendiente operacion, {
    AccesoDatosLocal? acceso,
  }) => (acceso ?? _baseDatos).insertar('operaciones_pendientes', {
    'id': operacion.id,
    'tipo': operacion.tipo,
    'entidad': operacion.entidad,
    'entidad_id_local': operacion.entidadIdLocal,
    'payload': jsonEncode(operacion.payload),
    'estado': operacion.estado.name,
    'intentos': operacion.intentos,
    'ultimo_error': operacion.ultimoError,
    'creado_en': operacion.creadoEn.toUtc().toIso8601String(),
  });

  @override
  Future<List<OperacionPendiente>> listar() async {
    final filas = await _baseDatos.consultar(
      'operaciones_pendientes',
      ordenarPor: 'creado_en ASC',
    );
    return filas.map(_desdeFila).toList(growable: false);
  }

  @override
  Future<List<OperacionPendiente>> listarElegibles() async {
    final filas = await _baseDatos.consultar(
      'operaciones_pendientes',
      donde: 'estado IN (?, ?)',
      argumentos: [
        EstadoOperacionOutbox.pendiente.name,
        EstadoOperacionOutbox.error.name,
      ],
      ordenarPor: 'creado_en ASC, id ASC',
    );
    return filas.map(_desdeFila).toList(growable: false);
  }

  @override
  Future<int> contarPendientes() => _baseDatos.contar(
    'operaciones_pendientes',
    donde: 'estado = ?',
    argumentos: [EstadoOperacionOutbox.pendiente.name],
  );

  @override
  Future<int> contarPorEstado(EstadoOperacionOutbox estado) =>
      _baseDatos.contar(
        'operaciones_pendientes',
        donde: 'estado = ?',
        argumentos: [estado.name],
      );

  @override
  Future<void> registrarResultado(
    OperacionPendiente operacion,
    EstadoOperacionOutbox estado, {
    String? error,
    AccesoDatosLocal? acceso,
  }) => (acceso ?? _baseDatos).actualizar(
    'operaciones_pendientes',
    {
      'estado': estado.name,
      'intentos': estado == EstadoOperacionOutbox.error
          ? operacion.intentos + 1
          : operacion.intentos,
      'ultimo_error': error,
    },
    donde: 'id = ?',
    argumentos: [operacion.id],
  );

  OperacionPendiente _desdeFila(Map<String, Object?> fila) =>
      OperacionPendiente(
        id: fila['id']! as String,
        tipo: fila['tipo']! as String,
        entidad: fila['entidad']! as String,
        entidadIdLocal: fila['entidad_id_local']! as String,
        payload:
            (jsonDecode(fila['payload']! as String) as Map<String, dynamic>)
                .cast<String, Object>(),
        estado: EstadoOperacionOutbox.values.byName(fila['estado']! as String),
        intentos: fila['intentos']! as int,
        ultimoError: fila['ultimo_error'] as String?,
        creadoEn: DateTime.parse(fila['creado_en']! as String),
      );
}
