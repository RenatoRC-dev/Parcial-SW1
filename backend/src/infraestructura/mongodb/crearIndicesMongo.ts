import { MongoServerError, type Db } from "mongodb"
import { ErrorConexionMongo } from "./ConexionMongo.js"

export const COLECCION_PROYECTOS = "projects"
export const COLECCION_PARTICIPANTES = "participants"

/**
 * Solo crea los índices requeridos por los patrones de acceso implementados.
 */
export async function crearIndicesMongo(baseDatos: Db): Promise<void> {
  try {
    await baseDatos.createCollection(COLECCION_PROYECTOS)
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 48)) {
      throw new ErrorConexionMongo("No se pudo preparar la colección projects.")
    }
  }

  try {
    await baseDatos.createCollection(COLECCION_PARTICIPANTES)
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 48)) {
      throw new ErrorConexionMongo("No se pudo preparar la colección participants.")
    }
  }

  try {
    await baseDatos.collection(COLECCION_PROYECTOS).createIndex(
      { codigoAccesoDigest: 1 },
      {
        name: "codigo_acceso_digest_unique",
        unique: true,
        partialFilterExpression: { codigoAccesoDigest: { $type: "string" } },
      },
    )
    await baseDatos.collection(COLECCION_PARTICIPANTES).createIndex(
      { credencialDigest: 1 },
      { name: "credencial_digest_unique", unique: true },
    )
    await baseDatos.collection(COLECCION_PARTICIPANTES).createIndex(
      { projectId: 1, nombreNormalizado: 1 },
      { name: "project_nombre_normalizado" },
    )
  } catch {
    throw new ErrorConexionMongo("No se pudieron preparar los índices de acceso a proyectos.")
  }
}
