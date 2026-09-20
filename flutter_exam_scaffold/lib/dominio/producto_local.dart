final class ProductoLocal {
  const ProductoLocal({
    required this.idLocal,
    required this.nombre,
    required this.precio,
    required this.estadoSync,
    required this.creadoEn,
  });

  final String idLocal;
  final String nombre;
  final double precio;
  final String estadoSync;
  final DateTime creadoEn;
}
