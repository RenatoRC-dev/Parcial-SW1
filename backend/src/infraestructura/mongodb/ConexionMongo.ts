import { MongoClient, type Db, type MongoClientOptions } from "mongodb"

export interface ConfiguracionMongo {
  uri: string
  nombreBaseDatos: string
}

export class ErrorConfiguracionMongo extends Error {}
export class ErrorConexionMongo extends Error {}

export function obtenerConfiguracionMongo(
  entorno: NodeJS.ProcessEnv = process.env,
): ConfiguracionMongo {
  const uri = entorno.MONGODB_URI?.trim()
  const nombreBaseDatos = entorno.MONGODB_DB_NAME?.trim() || "nexocase"
  if (!uri) throw new ErrorConfiguracionMongo("MONGODB_URI es obligatoria para iniciar el backend.")
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(nombreBaseDatos)) {
    throw new ErrorConfiguracionMongo("MONGODB_DB_NAME no tiene un formato válido.")
  }
  return { uri, nombreBaseDatos }
}

export class ConexionMongo {
  private readonly cliente: MongoClient
  private baseDatos: Db | null = null

  constructor(
    private readonly configuracion: ConfiguracionMongo,
    opciones: MongoClientOptions = {},
  ) {
    this.cliente = new MongoClient(configuracion.uri, opciones)
  }

  async conectar(): Promise<Db> {
    if (this.baseDatos) return this.baseDatos
    try {
      await this.cliente.connect()
      const baseDatos = this.cliente.db(this.configuracion.nombreBaseDatos)
      await baseDatos.command({ ping: 1 })
      this.baseDatos = baseDatos
      return baseDatos
    } catch {
      await this.cliente.close().catch(() => undefined)
      throw new ErrorConexionMongo("No se pudo establecer una conexión válida con MongoDB.")
    }
  }

  obtenerBaseDatos(): Db {
    if (!this.baseDatos) throw new ErrorConexionMongo("MongoDB todavía no está conectado.")
    return this.baseDatos
  }

  async cerrar(): Promise<void> {
    this.baseDatos = null
    await this.cliente.close()
  }
}
