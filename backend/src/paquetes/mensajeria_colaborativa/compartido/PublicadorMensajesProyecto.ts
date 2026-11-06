import type { MensajeProyecto } from "./MensajeProyecto.js"

export interface PublicadorMensajesProyecto {
  publicar(mensaje: MensajeProyecto): void
}

export const PUBLICADOR_MENSAJES_NULO: PublicadorMensajesProyecto = { publicar: () => undefined }
