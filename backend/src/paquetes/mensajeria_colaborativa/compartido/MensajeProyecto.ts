export type NombrePasoIA = "ollama" | "groq_cu04" | "groq_cu05" | "groq_cu12" | "determinista" | "cu08" | "cu06" | "cu07" | "spring"
export interface PasoIA { nombre: NombrePasoIA; estado: "completed" | "failed" }
export type TipoRemitenteMensaje = "human" | "ai" | "system"

export interface RecomendacionMensajeIA {
  fuente?: "asesoria_local"
  revisionEditor?: number
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
  procedencia?: PasoIA[]
  recomendacion?: RecomendacionMensajeIA | null
  revisionModeloObservada: number
  creadoEn: string
}

export interface CursorMensajes { creadoEn: string; id: string }
export interface ConsultaMensajes { projectId: string; limite: number; cursor?: CursorMensajes }
export interface PaginaMensajes { items: MensajeProyecto[]; siguienteCursor: CursorMensajes | null }
