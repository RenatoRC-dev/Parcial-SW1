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
    validarBackendUrl(normalizado);
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

  static Uri validarBackendUrl(String valor) {
    final uri = Uri.tryParse(valor.trim());
    final host = uri?.host ?? '';
    final pareceIpNumerica = RegExp(r'^[0-9.]+$').hasMatch(host);
    final segmentosIp = host.split('.');
    final ipValida =
        !pareceIpNumerica ||
        (segmentosIp.length == 4 &&
            segmentosIp.every((segmento) {
              final numero = int.tryParse(segmento);
              return numero != null && numero >= 0 && numero <= 255;
            }));
    if (uri == null ||
        !{'http', 'https'}.contains(uri.scheme) ||
        host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/') ||
        !ipValida) {
      throw const FormatException('La URL del backend no es válida.');
    }
    return uri;
  }
}
