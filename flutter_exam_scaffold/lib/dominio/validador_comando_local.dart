import 'dart:convert';
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
  return switch (accion) {
    'crear_cliente' => _crearCliente(parametros),
    'crear_producto' => _crearProducto(parametros),
    'consultar_clientes' => _consultarClientes(parametros),
    _ => throw const ErrorComandoLocal(
      'La acción solicitada no está soportada.',
    ),
  };
}

ComandoLocal _crearCliente(Map<String, dynamic> parametros) {
  if (!_clavesExactas(parametros, {'nombre', 'correo'}) ||
      parametros['nombre'] is! String ||
      parametros['correo'] is! String) {
    throw const ErrorComandoLocal(
      'crear_cliente requiere nombre y correo de tipo texto.',
    );
  }
  final nombre = (parametros['nombre'] as String).trim();
  final correo = (parametros['correo'] as String).trim();
  if (nombre.isEmpty || correo.isEmpty || !correo.contains('@')) {
    throw const ErrorComandoLocal(
      'crear_cliente contiene datos vacíos o un correo inválido.',
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
      'crear_producto requiere nombre de texto y precio numérico.',
    );
  }
  final nombre = (parametros['nombre'] as String).trim();
  final precio = parametros['precio'] as num;
  if (nombre.isEmpty || !precio.isFinite || precio < 0) {
    throw const ErrorComandoLocal(
      'crear_producto contiene un nombre o precio inválido.',
    );
  }
  return ComandoLocal(
    accion: TipoAccionLocal.crearProducto,
    parametros: {'nombre': nombre, 'precio': precio},
  );
}

ComandoLocal _consultarClientes(Map<String, dynamic> parametros) {
  if (parametros.isNotEmpty) {
    throw const ErrorComandoLocal('consultar_clientes no admite parámetros.');
  }
  return const ComandoLocal(
    accion: TipoAccionLocal.consultarClientes,
    parametros: {},
  );
}

bool _clavesExactas(Map<String, dynamic> mapa, Set<String> esperadas) =>
    mapa.keys.toSet().containsAll(esperadas) &&
    esperadas.containsAll(mapa.keys);
