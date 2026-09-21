/// Punto breve de adaptación para los identificadores compartidos del dominio.
///
/// No describe el esquema ni reemplaza las reglas de negocio: entidades,
/// validadores, repositorios y ejecutores continúan siendo código Dart explícito.
abstract final class ConfiguracionDominioExamen {
  static const nombreAplicacion = 'SW1 — Demo Cliente y Producto';

  static const accionCrearCliente = 'crear_cliente';
  static const accionCrearProducto = 'crear_producto';
  static const accionConsultarClientes = 'consultar_clientes';
  static const accionNoSoportada = 'no_soportada';

  static const entidadCliente = 'cliente';
  static const entidadProducto = 'producto';

  static const rutaCliente = '/api/cliente';
  static const rutaProducto = '/api/producto';
}
