final class ClienteLocal {
  const ClienteLocal({
    required this.idLocal,
    required this.nombre,
    required this.correo,
    required this.estadoSync,
    required this.creadoEn,
  });

  final String idLocal;
  final String nombre;
  final String correo;
  final String estadoSync;
  final DateTime creadoEn;
}
