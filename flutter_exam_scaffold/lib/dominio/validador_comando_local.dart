import 'dart:convert';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';

ComandoLocal validarRespuestaLocal(String respuestaCruda) {
  final inicio = respuestaCruda.indexOf('{');
  final fin = respuestaCruda.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) {
    throw const ErrorComandoLocal('La IA local no devolvió un objeto JSON.');
  }
  final dynamic decodificado;
  try {
    decodificado = jsonDecode(respuestaCruda.substring(inicio, fin + 1));
  } on FormatException {
    throw const ErrorComandoLocal(
      'La respuesta JSON de la IA local está mal formada.',
    );
  }
  if (decodificado is! Map<String, dynamic> ||
      !_clavesExactas(decodificado, {'accion', 'parametros'})) {
    throw const ErrorComandoLocal(
      'La respuesta no cumple el contrato de comando local.',
    );
  }
  final accion = decodificado['accion'];
  final parametros = decodificado['parametros'];
  if (accion is! String || parametros is! Map<String, dynamic>) {
    throw const ErrorComandoLocal(
      'La acción o sus parámetros tienen un tipo inválido.',
    );
  }
  try {
    return validarComandoEstructurado(accion, parametros);
  } on ErrorAccionNoSoportadaLocal {
    rethrow;
  } on ErrorComandoLocal catch (error) {
    throw ErrorParametrosComandoLocal(
      borrador: crearBorradorComandoEstructurado(accion, parametros),
      mensaje: error.mensaje,
    );
  }
}

ComandoLocal validarComandoEstructurado(
  String accion,
  Map<String, dynamic> parametros,
) {
  return switch (accion) {
    ConfiguracionDominioExamen.accionCrearCliente => _crearCliente(parametros),
    ConfiguracionDominioExamen.accionCrearProducto => _crearProducto(
      parametros,
    ),
    ConfiguracionDominioExamen.accionConsultarClientes => _consultarClientes(
      parametros,
    ),
    _ => throw const ErrorAccionNoSoportadaLocal(
      'La acción solicitada no está soportada.',
    ),
  };
}

BorradorComandoLocal crearBorradorComandoEstructurado(
  String accion,
  Map<String, dynamic> parametros,
) {
  switch (accion) {
    case ConfiguracionDominioExamen.accionCrearCliente:
      final nombre = parametros['nombre'];
      final correo = parametros['correo'];
      return BorradorComandoLocal(
        accion: TipoAccionLocal.crearCliente,
        parametros: {
          'nombre': nombre is String ? nombre.trim() : '',
          'correo': correo is String ? correo.trim() : '',
        },
        errores: {
          if (nombre is! String || nombre.trim().isEmpty)
            'nombre': 'Revisa el nombre antes de continuar.',
          if (correo is! String ||
              correo.trim().isEmpty ||
              !_correoValido(correo))
            'correo': 'Revisa el correo antes de continuar.',
          if (!_clavesExactas(parametros, {'nombre', 'correo'}))
            '_comando': 'Faltan datos requeridos o existen datos inesperados.',
        },
      );
    case ConfiguracionDominioExamen.accionCrearProducto:
      final nombre = parametros['nombre'];
      final precio = parametros['precio'];
      return BorradorComandoLocal(
        accion: TipoAccionLocal.crearProducto,
        parametros: {
          'nombre': nombre is String ? nombre.trim() : '',
          'precio': precio,
        },
        errores: {
          if (nombre is! String || nombre.trim().isEmpty)
            'nombre': 'Revisa el nombre antes de continuar.',
          if (precio is! num || !precio.isFinite || precio < 0)
            'precio': 'Revisa el precio antes de continuar.',
          if (!_clavesExactas(parametros, {'nombre', 'precio'}))
            '_comando': 'Faltan datos requeridos o existen datos inesperados.',
        },
      );
    case ConfiguracionDominioExamen.accionConsultarClientes:
      return BorradorComandoLocal(
        accion: TipoAccionLocal.consultarClientes,
        parametros: const {},
        errores: const {'_comando': 'La consulta no admite datos adicionales.'},
      );
    default:
      throw const ErrorAccionNoSoportadaLocal(
        'La acción solicitada no está soportada.',
      );
  }
}

ComandoLocal _crearCliente(Map<String, dynamic> parametros) {
  if (!_clavesExactas(parametros, {'nombre', 'correo'}) ||
      parametros['nombre'] is! String ||
      parametros['correo'] is! String) {
    throw const ErrorComandoLocal(
      '${ConfiguracionDominioExamen.accionCrearCliente} requiere nombre y correo de tipo texto.',
    );
  }
  final nombre = (parametros['nombre'] as String).trim();
  final correo = (parametros['correo'] as String).trim();
  if (nombre.isEmpty || !_correoValido(correo)) {
    throw const ErrorComandoLocal(
      '${ConfiguracionDominioExamen.accionCrearCliente} contiene datos vacíos o un correo inválido.',
    );
  }
  return ComandoLocal(
    accion: TipoAccionLocal.crearCliente,
    parametros: {'nombre': nombre, 'correo': correo},
  );
}

ComandoLocal _crearProducto(Map<String, dynamic> parametros) {
  if (!_clavesExactas(parametros, {'nombre', 'precio'}) ||
      parametros['nombre'] is! String ||
      parametros['precio'] is! num) {
    throw const ErrorComandoLocal(
      '${ConfiguracionDominioExamen.accionCrearProducto} requiere nombre de texto y precio numérico.',
    );
  }
  final nombre = (parametros['nombre'] as String).trim();
  final precio = parametros['precio'] as num;
  if (nombre.isEmpty || !precio.isFinite || precio < 0) {
    throw const ErrorComandoLocal(
      '${ConfiguracionDominioExamen.accionCrearProducto} contiene un nombre o precio inválido.',
    );
  }
  return ComandoLocal(
    accion: TipoAccionLocal.crearProducto,
    parametros: {'nombre': nombre, 'precio': precio},
  );
}

ComandoLocal _consultarClientes(Map<String, dynamic> parametros) {
  if (parametros.isNotEmpty) {
    throw const ErrorComandoLocal(
      '${ConfiguracionDominioExamen.accionConsultarClientes} no admite parámetros.',
    );
  }
  return const ComandoLocal(
    accion: TipoAccionLocal.consultarClientes,
    parametros: {},
  );
}

bool _clavesExactas(Map<String, dynamic> mapa, Set<String> esperadas) =>
    mapa.keys.toSet().containsAll(esperadas) &&
    esperadas.containsAll(mapa.keys);

bool _correoValido(String correo) =>
    RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(correo.trim());
