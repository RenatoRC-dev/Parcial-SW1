import type { ConsultaMensajes, MensajeProyecto, PaginaMensajes } from "./MensajeProyecto.js"

export interface RepositorioMensajes {
  crear(mensaje: MensajeProyecto): Promise<MensajeProyecto>
  listarPorProyecto(consulta: ConsultaMensajes): Promise<PaginaMensajes>
  obtenerPorId(projectId: string, id: string): Promise<MensajeProyecto | null>
}

export class ErrorDatosMensajeCorruptos extends Error {}
export class ErrorPersistenciaMensaje extends Error {}
