import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:sw1_local_ai_spike/sincronizacion/backend_api.dart';

final class HttpBackendApi implements BackendApi {
  HttpBackendApi({required String baseUrl, http.Client? cliente})
    : _baseUrl = baseUrl.replaceFirst(RegExp(r'/+$'), ''),
      _cliente = cliente ?? http.Client();

  final String _baseUrl;
  final http.Client _cliente;

  @override
  Future<ResultadoCreacionRemota> crearCliente({
    required String nombre,
    required String correo,
  }) => _crear('/api/cliente', {'nombre': nombre, 'correo': correo});

  @override
  Future<ResultadoCreacionRemota> crearProducto({
    required String nombre,
    required num precio,
  }) => _crear('/api/producto', {'nombre': nombre, 'precio': precio});

  Future<ResultadoCreacionRemota> _crear(
    String ruta,
    Map<String, Object> cuerpo,
  ) async {
    final http.Response respuesta;
    try {
      respuesta = await _cliente
          .post(
            Uri.parse('$_baseUrl$ruta'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(cuerpo),
          )
          .timeout(const Duration(seconds: 20));
    } catch (error) {
      throw ErrorBackendApi('No se pudo conectar con el backend: $error');
    }
    if (respuesta.statusCode < 200 || respuesta.statusCode >= 300) {
      throw ErrorBackendApi(
        'El backend respondió HTTP ${respuesta.statusCode}.',
      );
    }
    try {
      final cuerpoRespuesta = jsonDecode(respuesta.body);
      if (cuerpoRespuesta is! Map<String, dynamic> ||
          cuerpoRespuesta['id'] is! num) {
        throw const FormatException();
      }
      return ResultadoCreacionRemota(
        idRemoto: (cuerpoRespuesta['id'] as num).toString(),
      );
    } on FormatException {
      throw const ErrorBackendApi(
        'El backend no devolvió un identificador válido.',
      );
    }
  }

  void cerrar() => _cliente.close();
}
