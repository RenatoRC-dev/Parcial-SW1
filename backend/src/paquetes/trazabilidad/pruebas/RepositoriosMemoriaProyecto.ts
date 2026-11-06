import type { ConsultaMensajes, MensajeProyecto, PaginaMensajes } from "../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import { ErrorRequestMensajeDuplicado, type RepositorioMensajes } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import type { ConsultaEventos, EventoProyecto, PaginaEventos } from "../compartido/EventoProyecto.js"
import { ErrorClientChangeIdDuplicado, type RepositorioEventos } from "../compartido/RepositorioEventos.js"

function despuesDeCursor<T extends { creadoEn: string; id: string }>(items: T[], cursor?: { creadoEn: string; id: string }): T[] {
  if (!cursor) return items
  return items.filter((item) => item.creadoEn < cursor.creadoEn || (item.creadoEn === cursor.creadoEn && item.id < cursor.id))
}

export class RepositorioEventosMemoria implements RepositorioEventos {
  private readonly datos: EventoProyecto[] = []
  async crear(evento: EventoProyecto): Promise<EventoProyecto> {
    if (evento.clientChangeId && this.datos.some((item) => item.projectId === evento.projectId && item.clientChangeId === evento.clientChangeId)) {
      throw new ErrorClientChangeIdDuplicado("La actividad ya existe.")
    }
    this.datos.push(structuredClone(evento)); return structuredClone(evento)
  }
  async obtenerPorClientChangeId(projectId: string, clientChangeId: string): Promise<EventoProyecto | null> {
    const item = this.datos.find((evento) => evento.projectId === projectId && evento.clientChangeId === clientChangeId)
    return item ? structuredClone(item) : null
  }
  async listarPorProyecto(consulta: ConsultaEventos): Promise<PaginaEventos> {
    let items = this.datos.filter((evento) => evento.projectId === consulta.projectId
      && (!consulta.elementoId || evento.elemento?.id === consulta.elementoId)
      && (!consulta.participantId || evento.solicitadoPorParticipantId === consulta.participantId)
      && (!consulta.tipo || evento.tipo === consulta.tipo))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id))
    items = despuesDeCursor(items, consulta.cursor)
    const pagina = items.slice(0, consulta.limite)
    const ultimo = pagina.at(-1)
    return { items: structuredClone(pagina), siguienteCursor: items.length > consulta.limite && ultimo ? { creadoEn: ultimo.creadoEn, id: ultimo.id } : null }
  }
}

export class RepositorioMensajesMemoria implements RepositorioMensajes {
  private readonly datos: MensajeProyecto[] = []
  async crear(mensaje: MensajeProyecto): Promise<MensajeProyecto> {
    if (mensaje.requestId && this.datos.some((item) => item.projectId === mensaje.projectId && item.requestId === mensaje.requestId && item.tipoRemitente === mensaje.tipoRemitente)) {
      throw new ErrorRequestMensajeDuplicado("El mensaje de la solicitud ya existe.")
    }
    this.datos.push(structuredClone(mensaje)); return structuredClone(mensaje)
  }
  async obtenerPorId(projectId: string, id: string): Promise<MensajeProyecto | null> {
    const item = this.datos.find((mensaje) => mensaje.projectId === projectId && mensaje.id === id)
    return item ? structuredClone(item) : null
  }
  async obtenerPorRequestId(projectId: string, requestId: string, tipoRemitente: "human" | "ai"): Promise<MensajeProyecto | null> {
    const item = this.datos.find((mensaje) => mensaje.projectId === projectId && mensaje.requestId === requestId && mensaje.tipoRemitente === tipoRemitente)
    return item ? structuredClone(item) : null
  }
  async listarPorProyecto(consulta: ConsultaMensajes): Promise<PaginaMensajes> {
    let items = this.datos.filter((mensaje) => mensaje.projectId === consulta.projectId)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id))
    items = despuesDeCursor(items, consulta.cursor)
    const pagina = items.slice(0, consulta.limite)
    const ultimo = pagina.at(-1)
    return { items: structuredClone(pagina), siguienteCursor: items.length > consulta.limite && ultimo ? { creadoEn: ultimo.creadoEn, id: ultimo.id } : null }
  }
}
