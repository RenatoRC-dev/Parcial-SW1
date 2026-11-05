export const TIPOS_EVENTO_PROYECTO = [
  "PROJECT_CREATED", "PARTICIPANT_JOINED", "MODEL_SAVED",
  "UML_ELEMENT_CREATED", "UML_ELEMENT_UPDATED", "UML_ELEMENT_DELETED", "XMI_IMPORTED",
] as const
export type TipoEventoProyecto = typeof TIPOS_EVENTO_PROYECTO[number]

export const MECANISMOS_EVENTO = ["manual", "ai_cu04", "image_cu05", "xmi", "system"] as const
export type MecanismoEvento = typeof MECANISMOS_EVENTO[number]

export const TIPOS_ELEMENTO_UML = ["class", "attribute", "method", "parameter", "relationship"] as const
export type TipoElementoUML = typeof TIPOS_ELEMENTO_UML[number]

export interface ReferenciaElementoEvento {
  id: string
  tipo: TipoElementoUML
  nombreSnapshot: string
}

export interface EventoProyecto {
  id: string
  projectId: string
  tipo: TipoEventoProyecto
  solicitadoPorParticipantId: string
  nombreParticipanteSnapshot: string
  mecanismo: MecanismoEvento
  elemento: ReferenciaElementoEvento | null
  detalle: Record<string, string>
  revisionModeloObservada: number
  clientChangeId: string | null
  sourceMessageId: string | null
  creadoEn: string
}

export interface CursorEventos { creadoEn: string; id: string }
export interface ConsultaEventos {
  projectId: string
  limite: number
  cursor?: CursorEventos
  elementoId?: string
  participantId?: string
  tipo?: TipoEventoProyecto
}
export interface PaginaEventos { items: EventoProyecto[]; siguienteCursor: CursorEventos | null }
