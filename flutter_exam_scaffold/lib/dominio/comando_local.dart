enum TipoAccionLocal { crearCliente, crearProducto, consultarClientes }

final class ComandoLocal {
  const ComandoLocal({required this.accion, required this.parametros});
  final TipoAccionLocal accion;
  final Map<String, Object> parametros;
}

final class ErrorComandoLocal implements Exception {
  const ErrorComandoLocal(this.mensaje);
  final String mensaje;
  @override
  String toString() => mensaje;
}
