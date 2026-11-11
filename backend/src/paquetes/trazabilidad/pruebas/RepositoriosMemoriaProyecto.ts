import type { ConsultaMensajes, MensajeProyecto, PaginaMensajes } from "../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import { ErrorRequestMensajeDuplicado, type AccionIAModeladoPersistida, type RepositorioMensajes } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import type { ConsultaEventos, EventoProyecto, PaginaEventos } from "../compartido/EventoProyecto.js"
import { ErrorClientChangeIdDuplicado, type RepositorioEventos } from "../compartido/RepositorioEventos.js"
import type { EstadoFlujo, FlujoAsistentePersistido } from "../../asistencia_contextual/compartido/FlujoAsistente.js"

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
  private readonly flujos = new Map<string, FlujoAsistentePersistido>()
  async reservarFlujo(flujo: FlujoAsistentePersistido): Promise<boolean> {
    const clave = `${flujo.projectId}:${flujo.requestId}`
    if (this.flujos.has(clave) || !this.datos.some((m) => m.id === flujo.sourceMessageId && m.projectId === flujo.projectId && m.participantId === flujo.participantId)) return false
    this.flujos.set(clave, structuredClone(flujo)); return true
  }
  async obtenerFlujo(projectId: string, requestId: string): Promise<FlujoAsistentePersistido | null> { return structuredClone(this.flujos.get(`${projectId}:${requestId}`) ?? null) }
  async actualizarFlujo(flujo: FlujoAsistentePersistido, esperado: EstadoFlujo): Promise<boolean> {
    const actual = this.flujos.get(`${flujo.projectId}:${flujo.requestId}`)
    if (!actual || actual.estado !== esperado || actual.participantId !== flujo.participantId || actual.huella !== flujo.huella) return false
    this.flujos.set(`${flujo.projectId}:${flujo.requestId}`, structuredClone(flujo)); return true
  }
  private readonly datos: MensajeProyecto[] = []
  private readonly acciones = new Map<string, AccionIAModeladoPersistida>()
  async buscarRecomendaciones(projectId: string, participantId: string, limite: number): Promise<Array<{ mensaje: MensajeProyecto; solicitud: MensajeProyecto }>> {
    return structuredClone(this.datos.filter((mensaje) => mensaje.projectId === projectId && mensaje.tipoRemitente === "ai" && mensaje.recomendacion)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id))
      .flatMap((mensaje) => {
        const solicitud = this.datos.find((item) => item.id === mensaje.replyToMessageId && item.projectId === projectId && item.tipoRemitente === "human" && item.participantId === participantId)
        return solicitud ? [{ mensaje, solicitud }] : []
      }).slice(0, Math.min(32, Math.max(1, limite))))
  }
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
  async reservarAccionIA(accion: AccionIAModeladoPersistida): Promise<AccionIAModeladoPersistida> {
    if ([...this.flujos.values()].some((f) => f.projectId === accion.projectId && f.sourceMessageId === accion.sourceMessageId)) throw new Error("El turno ya está reservado por un flujo del asistente.")
    const existente = [...this.acciones.values()].find((item) => item.projectId === accion.projectId && item.sourceMessageId === accion.sourceMessageId)
    if (existente) return structuredClone(existente)
    const mensaje = this.datos.find((item) => item.id === accion.sourceMessageId && item.projectId === accion.projectId && item.tipoRemitente === "human")
    if (!mensaje) throw new Error("El mensaje fuente de la accion IA no existe.")
    this.acciones.set(accion.actionId, structuredClone(accion)); return structuredClone(accion)
  }
  async obtenerAccionIAPorId(projectId: string, actionId: string): Promise<AccionIAModeladoPersistida | null> {
    const accion = this.acciones.get(actionId); return accion?.projectId === projectId ? structuredClone(accion) : null
  }
  async obtenerAccionIAPorMensaje(projectId: string, sourceMessageId: string): Promise<AccionIAModeladoPersistida | null> {
    const accion = [...this.acciones.values()].find((item) => item.projectId === projectId && item.sourceMessageId === sourceMessageId)
    return accion ? structuredClone(accion) : null
  }
  async completarAccionIA(projectId: string, actionId: string, participantId: string, estado: "applied" | "failed", completadoEn: string): Promise<{ accion: AccionIAModeladoPersistida | null; transicion: boolean }> {
    const accion = this.acciones.get(actionId)
    if (!accion || accion.projectId !== projectId) return { accion: null, transicion: false }
    if (accion.requestingParticipantId !== participantId || accion.estado !== "planned") return { accion: structuredClone(accion), transicion: false }
    accion.estado = estado; accion.completadoEn = completadoEn
    return { accion: structuredClone(accion), transicion: true }
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
