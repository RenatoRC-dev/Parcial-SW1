import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

abstract interface class AccesoDatosLocal {
  Future<void> insertar(String tabla, Map<String, Object?> valores);
  Future<List<Map<String, Object?>>> consultar(
    String tabla, {
    String? donde,
    List<Object?>? argumentos,
    String? ordenarPor,
  });
  Future<int> contar(String tabla, {String? donde, List<Object?>? argumentos});
}

final class BaseDatosLocal implements AccesoDatosLocal {
  BaseDatosLocal({DatabaseFactory? factory, String? ruta})
    : _factory = factory ?? databaseFactory,
      _ruta = ruta;

  final DatabaseFactory _factory;
  final String? _ruta;
  Database? _database;

  Future<void> abrir() async {
    if (_database?.isOpen ?? false) return;
    final ruta =
        _ruta ?? p.join(await _factory.getDatabasesPath(), 'sw1_offline.db');
    _database = await _factory.openDatabase(
      ruta,
      options: OpenDatabaseOptions(version: 1, onCreate: _crearEsquema),
    );
  }

  Future<T> transaccion<T>(
    Future<T> Function(AccesoDatosLocal acceso) operacion,
  ) async {
    final db = await _obtener();
    return db.transaction((tx) => operacion(_AccesoTransaccional(tx)));
  }

  @override
  Future<void> insertar(String tabla, Map<String, Object?> valores) async {
    await (await _obtener()).insert(tabla, valores);
  }

  @override
  Future<List<Map<String, Object?>>> consultar(
    String tabla, {
    String? donde,
    List<Object?>? argumentos,
    String? ordenarPor,
  }) async => (await _obtener()).query(
    tabla,
    where: donde,
    whereArgs: argumentos,
    orderBy: ordenarPor,
  );

  @override
  Future<int> contar(
    String tabla, {
    String? donde,
    List<Object?>? argumentos,
  }) async {
    final resultado = await (await _obtener()).rawQuery(
      'SELECT COUNT(*) AS total FROM $tabla${donde == null ? '' : ' WHERE $donde'}',
      argumentos,
    );
    return Sqflite.firstIntValue(resultado) ?? 0;
  }

  Future<void> cerrar() async {
    final db = _database;
    _database = null;
    await db?.close();
  }

  Future<Database> _obtener() async {
    await abrir();
    return _database!;
  }

  static Future<void> _crearEsquema(Database db, int version) async {
    await db.execute('''
CREATE TABLE clientes_locales (
  id_local TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  estado_sync TEXT NOT NULL,
  creado_en TEXT NOT NULL
)
''');
    await db.execute('''
CREATE TABLE productos_locales (
  id_local TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio REAL NOT NULL,
  estado_sync TEXT NOT NULL,
  creado_en TEXT NOT NULL
)
''');
    await db.execute('''
CREATE TABLE operaciones_pendientes (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id_local TEXT NOT NULL,
  payload TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','sincronizando','sincronizada','error')),
  intentos INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  creado_en TEXT NOT NULL
)
''');
  }
}

final class _AccesoTransaccional implements AccesoDatosLocal {
  const _AccesoTransaccional(this._tx);
  final Transaction _tx;

  @override
  Future<void> insertar(String tabla, Map<String, Object?> valores) async {
    await _tx.insert(tabla, valores);
  }

  @override
  Future<List<Map<String, Object?>>> consultar(
    String tabla, {
    String? donde,
    List<Object?>? argumentos,
    String? ordenarPor,
  }) => _tx.query(
    tabla,
    where: donde,
    whereArgs: argumentos,
    orderBy: ordenarPor,
  );

  @override
  Future<int> contar(
    String tabla, {
    String? donde,
    List<Object?>? argumentos,
  }) async {
    final resultado = await _tx.rawQuery(
      'SELECT COUNT(*) AS total FROM $tabla${donde == null ? '' : ' WHERE $donde'}',
      argumentos,
    );
    return Sqflite.firstIntValue(resultado) ?? 0;
  }
}
