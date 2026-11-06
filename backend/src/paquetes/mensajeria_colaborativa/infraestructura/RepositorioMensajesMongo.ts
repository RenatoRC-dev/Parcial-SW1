import { MongoServerError, type Collection, type Db, type Filter } from "mongodb"
import { COLECCION_MENSAJES } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import type { ConsultaMensajes, MensajeProyecto, PaginaMensajes } from "../compartido/MensajeProyecto.js"
import { ErrorDatosMensajeCorruptos, ErrorPersistenciaMensaje, ErrorRequestMensajeDuplicado, type RepositorioMensajes } from "../compartido/RepositorioMensajes.js"

interface DocumentoMensaje extends Omit<MensajeProyecto, "id" | "creadoEn"> { _id: string; creadoEn: Date }
const esFecha = (valor: unknown): valor is Date => valor instanceof Date && !Number.isNaN(valor.getTime())

function validar(documento: DocumentoMensaje): void {
  if (!documento._id || !documento.projectId || !["human", "ai", "system"].includes(documento.tipoRemitente)
    || !(documento.participantId === null || typeof documento.participantId === "string")
    || !(documento.nombreVisibleSnapshot === null || typeof documento.nombreVisibleSnapshot === "string")
    || (documento.tipoRemitente === "human" && (!documento.participantId || !documento.nombreVisibleSnapshot))
    || (documento.tipoRemitente !== "human" && documento.participantId !== null)
    || typeof documento.contenido !== "string" || !documento.contenido || documento.contenido.length > 8_000
    || !(documento.requestId === null || typeof documento.requestId === "string")
    || !(documento.replyToMessageId === null || typeof documento.replyToMessageId === "string")
    || !Array.isArray(documento.elementosRelacionadosIds) || documento.elementosRelacionadosIds.some((id) => typeof id !== "string")
    || !Number.isInteger(documento.revisionModeloObservada) || documento.revisionModeloObservada < 0 || !esFecha(documento.creadoEn)) {
    throw new ErrorDatosMensajeCorruptos("El documento de mensaje no es válido.")
  }
}
function aDominio(documento: DocumentoMensaje): MensajeProyecto {
  validar(documento); const { _id, creadoEn, ...resto } = documento
  return { id: _id, ...structuredClone(resto), creadoEn: creadoEn.toISOString() }
}
function aDocumento(mensaje: MensajeProyecto): DocumentoMensaje {
  const { id, ...resto } = mensaje; const documento = { _id: id, ...structuredClone(resto), creadoEn: new Date(mensaje.creadoEn) }
  validar(documento); return documento
}

export class RepositorioMensajesMongo implements RepositorioMensajes {
  private readonly mensajes: Collection<DocumentoMensaje>
  constructor(baseDatos: Db) { this.mensajes = baseDatos.collection<DocumentoMensaje>(COLECCION_MENSAJES) }
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
