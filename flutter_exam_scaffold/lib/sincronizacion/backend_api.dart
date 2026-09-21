final class ResultadoCreacionRemota {
  const ResultadoCreacionRemota({required this.idRemoto});
  final String idRemoto;
}

abstract interface class BackendApi {
  Future<ResultadoCreacionRemota> crearCliente({
    required String nombre,
    required String correo,
  });

  Future<ResultadoCreacionRemota> crearProducto({
    required String nombre,
    required num precio,
  });
}

final class ErrorBackendApi implements Exception {
  const ErrorBackendApi(this.mensaje);
  final String mensaje;

  @override
  String toString() => mensaje;
}
