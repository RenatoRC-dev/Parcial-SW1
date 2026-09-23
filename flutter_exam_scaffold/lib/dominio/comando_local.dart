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

final class ErrorAccionNoSoportadaLocal extends ErrorComandoLocal {
  const ErrorAccionNoSoportadaLocal(super.mensaje);
}

final class BorradorComandoLocal {
  const BorradorComandoLocal({
    required this.accion,
    required this.parametros,
    required this.errores,
  });

  final TipoAccionLocal accion;
  final Map<String, Object?> parametros;
  final Map<String, String> errores;
}

final class ErrorParametrosComandoLocal extends ErrorComandoLocal {
  const ErrorParametrosComandoLocal({
    required this.borrador,
    required String mensaje,
  }) : super(mensaje);

  final BorradorComandoLocal borrador;
}
