import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';

final class ConfiguracionLocalRepository {
  const ConfiguracionLocalRepository(this._baseDatos);
  final BaseDatosLocal _baseDatos;

  static const _claveBackendUrl = 'backend_url';

  Future<String?> obtenerBackendUrl() async {
    final filas = await _baseDatos.consultar(
      'configuracion_local',
      donde: 'clave = ?',
      argumentos: [_claveBackendUrl],
    );
    return filas.isEmpty ? null : filas.single['valor']! as String;
  }

  Future<void> guardarBackendUrl(String valor) async {
    final normalizado = valor.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(normalizado);
    if (uri == null ||
        !{'http', 'https'}.contains(uri.scheme) ||
        uri.host.isEmpty) {
      throw const FormatException('La URL del backend no es válida.');
    }
    final existente = await obtenerBackendUrl();
    if (existente == null) {
      await _baseDatos.insertar('configuracion_local', {
        'clave': _claveBackendUrl,
        'valor': normalizado,
      });
    } else {
      await _baseDatos.actualizar(
        'configuracion_local',
        {'valor': normalizado},
        donde: 'clave = ?',
        argumentos: [_claveBackendUrl],
      );
    }
  }
}
