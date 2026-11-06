import { MongoServerError, type Db } from "mongodb"
import { ErrorConexionMongo } from "./ConexionMongo.js"

export const COLECCION_PROYECTOS = "projects"
export const COLECCION_PARTICIPANTES = "participants"
export const COLECCION_EVENTOS = "events"
export const COLECCION_MENSAJES = "messages"

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

  for (const [coleccion, etiqueta] of [[COLECCION_EVENTOS, "events"], [COLECCION_MENSAJES, "messages"]] as const) {
    try { await baseDatos.createCollection(coleccion) }
    catch (error) {
      if (!(error instanceof MongoServerError && error.code === 48)) throw new ErrorConexionMongo(`No se pudo preparar la colección ${etiqueta}.`)
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
    await baseDatos.collection(COLECCION_EVENTOS).createIndex(
      { projectId: 1, creadoEn: -1, _id: -1 }, { name: "project_fecha_evento" },
    )
    await baseDatos.collection(COLECCION_EVENTOS).createIndex(
      { projectId: 1, "elemento.id": 1, creadoEn: -1 }, { name: "project_elemento_fecha" },
    )
    await baseDatos.collection(COLECCION_EVENTOS).createIndex(
      { projectId: 1, solicitadoPorParticipantId: 1, creadoEn: -1 }, { name: "project_participante_fecha" },
    )
    await baseDatos.collection(COLECCION_EVENTOS).createIndex(
      { projectId: 1, clientChangeId: 1 },
      { name: "project_client_change_unique", unique: true, partialFilterExpression: { clientChangeId: { $type: "string" } } },
    )
    await baseDatos.collection(COLECCION_MENSAJES).createIndex(
      { projectId: 1, creadoEn: -1, _id: -1 }, { name: "project_fecha_mensaje" },
    )
    await baseDatos.collection(COLECCION_MENSAJES).createIndex(
      { projectId: 1, requestId: 1, tipoRemitente: 1 },
      { name: "project_request_remitente_unique", unique: true, partialFilterExpression: { requestId: { $type: "string" } } },
    )
    await baseDatos.collection(COLECCION_MENSAJES).createIndex(
      { projectId: 1, "accionIA.actionId": 1 },
      { name: "project_ai_action_unique", unique: true, partialFilterExpression: { "accionIA.actionId": { $type: "string" } } },
    )
    await baseDatos.collection(COLECCION_PARTICIPANTES).createIndex(
      { projectId: 1, nombreNormalizado: 1 },
      { name: "project_nombre_normalizado" },
    )
  } catch {
    throw new ErrorConexionMongo("No se pudieron preparar los índices de acceso a proyectos.")
  }
}
