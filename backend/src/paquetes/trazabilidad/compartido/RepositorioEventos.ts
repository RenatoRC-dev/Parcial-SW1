import type { ConsultaEventos, EventoProyecto, PaginaEventos } from "./EventoProyecto.js"

export interface RepositorioEventos {
  crear(evento: EventoProyecto): Promise<EventoProyecto>
  obtenerPorClientChangeId(projectId: string, clientChangeId: string): Promise<EventoProyecto | null>
  listarPorProyecto(consulta: ConsultaEventos): Promise<PaginaEventos>
}

export class ErrorDatosEventoCorruptos extends Error {}
export class ErrorPersistenciaEvento extends Error {}
export class ErrorClientChangeIdDuplicado extends Error {}
