export type TipoRemitenteMensaje = "human" | "ai" | "system"

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
  revisionModeloObservada: number
  creadoEn: string
}

export interface CursorMensajes { creadoEn: string; id: string }
export interface ConsultaMensajes { projectId: string; limite: number; cursor?: CursorMensajes }
export interface PaginaMensajes { items: MensajeProyecto[]; siguienteCursor: CursorMensajes | null }
