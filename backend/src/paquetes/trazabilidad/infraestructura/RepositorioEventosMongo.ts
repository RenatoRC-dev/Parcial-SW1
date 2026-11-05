import { MongoServerError, type Collection, type Db, type Filter } from "mongodb"
import { COLECCION_EVENTOS } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import { MECANISMOS_EVENTO, TIPOS_ELEMENTO_UML, TIPOS_EVENTO_PROYECTO, type ConsultaEventos, type EventoProyecto, type PaginaEventos } from "../compartido/EventoProyecto.js"
import { ErrorClientChangeIdDuplicado, ErrorDatosEventoCorruptos, ErrorPersistenciaEvento, type RepositorioEventos } from "../compartido/RepositorioEventos.js"

interface DocumentoEvento extends Omit<EventoProyecto, "id" | "creadoEn"> { _id: string; creadoEn: Date }
const esFecha = (valor: unknown): valor is Date => valor instanceof Date && !Number.isNaN(valor.getTime())

function validar(evento: DocumentoEvento): void {
  const elemento = evento.elemento
  if (!evento._id || !evento.projectId || !TIPOS_EVENTO_PROYECTO.includes(evento.tipo)
    || !evento.solicitadoPorParticipantId || !evento.nombreParticipanteSnapshot
    || !MECANISMOS_EVENTO.includes(evento.mecanismo)
    || !Number.isInteger(evento.revisionModeloObservada) || evento.revisionModeloObservada < 0
    || !esFecha(evento.creadoEn)
    || !(evento.clientChangeId === null || typeof evento.clientChangeId === "string")
    || !(evento.sourceMessageId === null || typeof evento.sourceMessageId === "string")
    || typeof evento.detalle !== "object" || evento.detalle === null
    || Object.entries(evento.detalle).some(([clave, valor]) => !clave || typeof valor !== "string" || valor.length > 160)
    || !(elemento === null || (elemento.id && elemento.nombreSnapshot && TIPOS_ELEMENTO_UML.includes(elemento.tipo)))) {
    throw new ErrorDatosEventoCorruptos("El documento de actividad no es válido.")
  }
}

function aDominio(documento: DocumentoEvento): EventoProyecto {
  validar(documento)
  const { _id, creadoEn, ...resto } = documento
  return { id: _id, ...structuredClone(resto), creadoEn: creadoEn.toISOString() }
}

function aDocumento(evento: EventoProyecto): DocumentoEvento {
  const creadoEn = new Date(evento.creadoEn)
  const { id, ...resto } = evento
  const documento = { _id: id, ...structuredClone(resto), creadoEn }
  validar(documento)
  return documento
}

export class RepositorioEventosMongo implements RepositorioEventos {
  private readonly eventos: Collection<DocumentoEvento>
  constructor(baseDatos: Db) { this.eventos = baseDatos.collection<DocumentoEvento>(COLECCION_EVENTOS) }

  async crear(evento: EventoProyecto): Promise<EventoProyecto> {
    try {
      const documento = aDocumento(evento)
      await this.eventos.insertOne(documento)
      return aDominio(documento)
    } catch (error) {
      if (error instanceof ErrorDatosEventoCorruptos) throw error
      if (error instanceof MongoServerError && error.code === 11000) throw new ErrorClientChangeIdDuplicado("La actividad ya fue registrada.")
      throw new ErrorPersistenciaEvento("No se pudo persistir la actividad.", { cause: error })
    }
  }

  async obtenerPorClientChangeId(projectId: string, clientChangeId: string): Promise<EventoProyecto | null> {
    try {
      const documento = await this.eventos.findOne({ projectId, clientChangeId })
      return documento ? aDominio(documento) : null
    } catch (error) {
      if (error instanceof ErrorDatosEventoCorruptos) throw error
      throw new ErrorPersistenciaEvento("No se pudo consultar la actividad.", { cause: error })
    }
  }

  async listarPorProyecto(consulta: ConsultaEventos): Promise<PaginaEventos> {
    try {
      const filtro: Filter<DocumentoEvento> = { projectId: consulta.projectId }
      if (consulta.elementoId) filtro["elemento.id"] = consulta.elementoId
      if (consulta.participantId) filtro.solicitadoPorParticipantId = consulta.participantId
      if (consulta.tipo) filtro.tipo = consulta.tipo
      if (consulta.cursor) {
        const fecha = new Date(consulta.cursor.creadoEn)
        if (!esFecha(fecha)) throw new ErrorDatosEventoCorruptos("El cursor de actividad no es válido.")
        filtro.$or = [{ creadoEn: { $lt: fecha } }, { creadoEn: fecha, _id: { $lt: consulta.cursor.id } }]
      }
      const documentos = await this.eventos.find(filtro).sort({ creadoEn: -1, _id: -1 }).limit(consulta.limite + 1).toArray()
      const hayMas = documentos.length > consulta.limite
      const pagina = documentos.slice(0, consulta.limite).map(aDominio)
      const ultimo = pagina.at(-1)
      return { items: pagina, siguienteCursor: hayMas && ultimo ? { creadoEn: ultimo.creadoEn, id: ultimo.id } : null }
    } catch (error) {
      if (error instanceof ErrorDatosEventoCorruptos) throw error
      throw new ErrorPersistenciaEvento("No se pudo listar la actividad.", { cause: error })
    }
  }
}
