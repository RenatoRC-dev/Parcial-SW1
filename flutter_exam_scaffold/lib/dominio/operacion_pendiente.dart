enum EstadoOperacionOutbox { pendiente, sincronizando, sincronizada, error }

final class OperacionPendiente {
  const OperacionPendiente({
    required this.id,
    required this.tipo,
    required this.entidad,
    required this.entidadIdLocal,
    required this.payload,
    required this.estado,
    required this.intentos,
    required this.creadoEn,
    this.ultimoError,
  });

  final String id;
  final String tipo;
  final String entidad;
  final String entidadIdLocal;
  final Map<String, Object> payload;
  final EstadoOperacionOutbox estado;
  final int intentos;
  final String? ultimoError;
  final DateTime creadoEn;
}
