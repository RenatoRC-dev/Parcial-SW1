import 'package:sw1_local_ai_spike/dominio/producto_local.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';

abstract interface class RepositorioProductoLocal {
  Future<void> guardar(ProductoLocal producto, {AccesoDatosLocal? acceso});
  Future<List<ProductoLocal>> listar();
}

final class ProductoLocalRepository implements RepositorioProductoLocal {
  const ProductoLocalRepository(this._baseDatos);
  final BaseDatosLocal _baseDatos;

  @override
  Future<void> guardar(ProductoLocal producto, {AccesoDatosLocal? acceso}) =>
      (acceso ?? _baseDatos).insertar('productos_locales', {
        'id_local': producto.idLocal,
        'nombre': producto.nombre,
        'precio': producto.precio,
        'estado_sync': producto.estadoSync,
        'creado_en': producto.creadoEn.toUtc().toIso8601String(),
      });

  @override
  Future<List<ProductoLocal>> listar() async {
    final filas = await _baseDatos.consultar(
      'productos_locales',
      ordenarPor: 'creado_en ASC',
    );
    return filas
        .map(
          (fila) => ProductoLocal(
            idLocal: fila['id_local']! as String,
            nombre: fila['nombre']! as String,
            precio: (fila['precio']! as num).toDouble(),
            estadoSync: fila['estado_sync']! as String,
            creadoEn: DateTime.parse(fila['creado_en']! as String),
          ),
        )
        .toList(growable: false);
  }
}
