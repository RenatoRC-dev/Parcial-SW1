import { MongoServerError, type Collection, type Db, type Filter } from "mongodb"
import { COLECCION_MENSAJES } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import type { ConsultaMensajes, MensajeProyecto, PaginaMensajes } from "../compartido/MensajeProyecto.js"
import { ErrorDatosMensajeCorruptos, ErrorPersistenciaMensaje, ErrorRequestMensajeDuplicado, type AccionIAModeladoPersistida, type RepositorioMensajes } from "../compartido/RepositorioMensajes.js"

interface DocumentoAccionIA extends Omit<AccionIAModeladoPersistida, "creadoEn" | "completadoEn"> { creadoEn: Date; completadoEn: Date | null }
interface DocumentoMensaje extends Omit<MensajeProyecto, "id" | "creadoEn"> { _id: string; creadoEn: Date; accionIA?: DocumentoAccionIA }
const esFecha = (valor: unknown): valor is Date => valor instanceof Date && !Number.isNaN(valor.getTime())

function validar(documento: DocumentoMensaje): void {
  const recomendacion = documento.recomendacion
  if (!documento._id || !documento.projectId || !["human", "ai", "system"].includes(documento.tipoRemitente)
    || !(documento.participantId === null || typeof documento.participantId === "string")
    || !(documento.nombreVisibleSnapshot === null || typeof documento.nombreVisibleSnapshot === "string")
    || (documento.tipoRemitente === "human" && (!documento.participantId || !documento.nombreVisibleSnapshot))
    || (documento.tipoRemitente !== "human" && documento.participantId !== null)
    || typeof documento.contenido !== "string" || !documento.contenido || documento.contenido.length > 8_000
    || !(documento.requestId === null || typeof documento.requestId === "string")
    || !(documento.replyToMessageId === null || typeof documento.replyToMessageId === "string")
    || !Array.isArray(documento.elementosRelacionadosIds) || documento.elementosRelacionadosIds.some((id) => typeof id !== "string")
    || !Number.isInteger(documento.revisionModeloObservada) || documento.revisionModeloObservada < 0 || !esFecha(documento.creadoEn)
    || !(recomendacion === undefined || recomendacion === null || (typeof recomendacion.resumen === "string" && recomendacion.resumen.length <= 500
      && typeof recomendacion.normalizedInstruction === "string" && recomendacion.normalizedInstruction.length <= 2_000
      && Array.isArray(recomendacion.targetElementIds) && recomendacion.targetElementIds.length <= 8
      && recomendacion.targetElementIds.every((id) => typeof id === "string" && id.length <= 160)))) {
    throw new ErrorDatosMensajeCorruptos("El documento de mensaje no es válido.")
  }
}
function aDominio(documento: DocumentoMensaje): MensajeProyecto {
  validar(documento); const { _id, creadoEn, accionIA: _accionIA, ...resto } = documento
  return { id: _id, ...structuredClone(resto), creadoEn: creadoEn.toISOString() }
}
function aDocumento(mensaje: MensajeProyecto): DocumentoMensaje {
  const { id, ...resto } = mensaje; const documento = { _id: id, ...structuredClone(resto), creadoEn: new Date(mensaje.creadoEn) }
  validar(documento); return documento
}

export class RepositorioMensajesMongo implements RepositorioMensajes {
  private readonly mensajes: Collection<DocumentoMensaje>
  constructor(baseDatos: Db) { this.mensajes = baseDatos.collection<DocumentoMensaje>(COLECCION_MENSAJES) }
  async buscarRecomendaciones(projectId: string, participantId: string, limite: number): Promise<Array<{ mensaje: MensajeProyecto; solicitud: MensajeProyecto }>> {
    try {
      const documentos = await this.mensajes.aggregate<DocumentoMensaje & { solicitud: DocumentoMensaje[] }>([
        { $match: { projectId, tipoRemitente: "ai", recomendacion: { $ne: null }, "recomendacion.normalizedInstruction": { $type: "string" } } },
        { $sort: { creadoEn: -1, _id: -1 } },
        { $lookup: { from: COLECCION_MENSAJES, localField: "replyToMessageId", foreignField: "_id", as: "solicitud",
          pipeline: [{ $match: { projectId, participantId, tipoRemitente: "human" } }] } },
        { $match: { "solicitud.0": { $exists: true } } },
        { $limit: Math.min(32, Math.max(1, limite)) },
      ]).toArray()
      return documentos.map(({ solicitud, ...mensaje }) => ({ mensaje: aDominio(mensaje), solicitud: aDominio(solicitud[0]) }))
    } catch (error) { if (error instanceof ErrorDatosMensajeCorruptos) throw error; throw new ErrorPersistenciaMensaje("No se pudieron consultar las recomendaciones.", { cause: error }) }
  }
  async crear(mensaje: MensajeProyecto): Promise<MensajeProyecto> {
    try { const documento = aDocumento(mensaje); await this.mensajes.insertOne(documento); return aDominio(documento) }
    catch (error) {
      if (error instanceof ErrorDatosMensajeCorruptos) throw error
      if (error instanceof MongoServerError && error.code === 11000) throw new ErrorRequestMensajeDuplicado("El mensaje de la solicitud ya existe.")
      throw new ErrorPersistenciaMensaje("No se pudo persistir el mensaje.", { cause: error })
    }
  }
  async obtenerPorId(projectId: string, id: string): Promise<MensajeProyecto | null> {
    try { const documento = await this.mensajes.findOne({ _id: id, projectId }); return documento ? aDominio(documento) : null }
    catch (error) { if (error instanceof ErrorDatosMensajeCorruptos) throw error; throw new ErrorPersistenciaMensaje("No se pudo consultar el mensaje.", { cause: error }) }
  }
  async obtenerPorRequestId(projectId: string, requestId: string, tipoRemitente: "human" | "ai"): Promise<MensajeProyecto | null> {
    try {
      const documento = await this.mensajes.findOne({ projectId, requestId, tipoRemitente })
      return documento ? aDominio(documento) : null
    } catch (error) {
      if (error instanceof ErrorDatosMensajeCorruptos) throw error
      throw new ErrorPersistenciaMensaje("No se pudo consultar la solicitud conversacional.", { cause: error })
    }
  }
  async reservarAccionIA(accion: AccionIAModeladoPersistida): Promise<AccionIAModeladoPersistida> {
    const documento = aDocumentoAccion(accion)
    try {
      const resultado = await this.mensajes.findOneAndUpdate(
        { _id: accion.sourceMessageId, projectId: accion.projectId, tipoRemitente: "human", accionIA: { $exists: false } },
        { $set: { accionIA: documento } }, { returnDocument: "after" },
      )
      if (resultado?.accionIA) return aDominioAccion(resultado.accionIA)
      const existente = await this.obtenerAccionIAPorMensaje(accion.projectId, accion.sourceMessageId)
      if (existente) return existente
      throw new ErrorDatosMensajeCorruptos("El mensaje fuente de la accion IA no existe o no es humano.")
    } catch (error) {
      if (error instanceof ErrorDatosMensajeCorruptos) throw error
      if (error instanceof MongoServerError && error.code === 11000) {
        const existente = await this.obtenerAccionIAPorMensaje(accion.projectId, accion.sourceMessageId)
        if (existente) return existente
      }
      throw new ErrorPersistenciaMensaje("No se pudo reservar la accion IA.", { cause: error })
    }
  }
  async obtenerAccionIAPorId(projectId: string, actionId: string): Promise<AccionIAModeladoPersistida | null> {
    try {
      const documento = await this.mensajes.findOne({ projectId, "accionIA.actionId": actionId })
      return documento?.accionIA ? aDominioAccion(documento.accionIA) : null
    } catch (error) { if (error instanceof ErrorDatosMensajeCorruptos) throw error; throw new ErrorPersistenciaMensaje("No se pudo consultar la accion IA.", { cause: error }) }
  }
  async obtenerAccionIAPorMensaje(projectId: string, sourceMessageId: string): Promise<AccionIAModeladoPersistida | null> {
    try {
      const documento = await this.mensajes.findOne({ _id: sourceMessageId, projectId })
      return documento?.accionIA ? aDominioAccion(documento.accionIA) : null
    } catch (error) { if (error instanceof ErrorDatosMensajeCorruptos) throw error; throw new ErrorPersistenciaMensaje("No se pudo consultar la accion IA del mensaje.", { cause: error }) }
  }
  async completarAccionIA(projectId: string, actionId: string, participantId: string, estado: "applied" | "failed", completadoEn: string): Promise<{ accion: AccionIAModeladoPersistida | null; transicion: boolean }> {
    try {
      const fecha = new Date(completadoEn)
      if (!esFecha(fecha)) throw new ErrorDatosMensajeCorruptos("La fecha de finalizacion de accion IA no es valida.")
      const actualizado = await this.mensajes.findOneAndUpdate(
        { projectId, "accionIA.actionId": actionId, "accionIA.requestingParticipantId": participantId, "accionIA.estado": "planned" },
        { $set: { "accionIA.estado": estado, "accionIA.completadoEn": fecha } }, { returnDocument: "after" },
      )
      if (actualizado?.accionIA) return { accion: aDominioAccion(actualizado.accionIA), transicion: true }
      return { accion: await this.obtenerAccionIAPorId(projectId, actionId), transicion: false }
    } catch (error) { if (error instanceof ErrorDatosMensajeCorruptos) throw error; throw new ErrorPersistenciaMensaje("No se pudo finalizar la accion IA.", { cause: error }) }
  }
  async listarPorProyecto(consulta: ConsultaMensajes): Promise<PaginaMensajes> {
    try {
      const filtro: Filter<DocumentoMensaje> = { projectId: consulta.projectId }
      if (consulta.cursor) {
        const fecha = new Date(consulta.cursor.creadoEn)
        if (!esFecha(fecha)) throw new ErrorDatosMensajeCorruptos("El cursor de mensajes no es válido.")
        filtro.$or = [{ creadoEn: { $lt: fecha } }, { creadoEn: fecha, _id: { $lt: consulta.cursor.id } }]
      }
      const documentos = await this.mensajes.find(filtro).sort({ creadoEn: -1, _id: -1 }).limit(consulta.limite + 1).toArray()
      const hayMas = documentos.length > consulta.limite
      const pagina = documentos.slice(0, consulta.limite).map(aDominio)
      const ultimo = pagina.at(-1)
      return { items: pagina, siguienteCursor: hayMas && ultimo ? { creadoEn: ultimo.creadoEn, id: ultimo.id } : null }
    } catch (error) { if (error instanceof ErrorDatosMensajeCorruptos) throw error; throw new ErrorPersistenciaMensaje("No se pudieron listar los mensajes.", { cause: error }) }
  }
}

function aDocumentoAccion(accion: AccionIAModeladoPersistida): DocumentoAccionIA {
  return { ...structuredClone(accion), creadoEn: new Date(accion.creadoEn), completadoEn: accion.completadoEn ? new Date(accion.completadoEn) : null }
}

function aDominioAccion(accion: DocumentoAccionIA): AccionIAModeladoPersistida {
  if (!accion.actionId || !accion.projectId || !accion.sourceMessageId || !accion.requestingParticipantId
    || !["direct", "collaborative"].includes(accion.origen) || !["planned", "applied", "failed"].includes(accion.estado)
    || !Number.isInteger(accion.baseEditorRevision) || !esFecha(accion.creadoEn)
    || !(accion.completadoEn === null || esFecha(accion.completadoEn))) throw new ErrorDatosMensajeCorruptos("El metadato de accion IA esta corrupto.")
  return { ...structuredClone(accion), creadoEn: accion.creadoEn.toISOString(), completadoEn: accion.completadoEn?.toISOString() ?? null }
}
