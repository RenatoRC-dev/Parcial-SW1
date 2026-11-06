export type TipoRemitenteMensaje = "human" | "ai" | "system"

export interface RecomendacionMensajeIA {
  resumen: string
  targetElementIds: string[]
  normalizedInstruction: string
}

export interface MensajeProyecto {
  id: string
  projectId: string
  tipoRemitente: TipoRemitenteMensaje
  participantId: string | null
  nombreVisibleSnapshot: string | null
  contenido: string
  requestId: string | null
  replyToMessageId: string | null
  elementosRelacionadosIds: string[]
  recomendacion?: RecomendacionMensajeIA | null
  revisionModeloObservada: number
  creadoEn: string
}

export interface CursorMensajes { creadoEn: string; id: string }
export interface ConsultaMensajes { projectId: string; limite: number; cursor?: CursorMensajes }
export interface PaginaMensajes { items: MensajeProyecto[]; siguienteCursor: CursorMensajes | null }
