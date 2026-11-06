import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"
import type { ContextoAsistente } from "./ContextoAsistente"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { RespuestaInterpretacionUML } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ComandoModeloUML"

export interface MensajeColaborativo {
  id: string
  projectId: string
  tipoRemitente: "human" | "ai" | "system"
  participantId: string | null
  nombreVisibleSnapshot: string | null
  contenido: string
  requestId: string | null
  replyToMessageId: string | null
  elementosRelacionadosIds: string[]
  revisionModeloObservada: number
  creadoEn: string
}

export interface PaginaMensajesColaborativos { items: MensajeColaborativo[]; siguienteCursor: string | null }
export interface RespuestaPreguntaColaborativa { mensajeHumano: MensajeColaborativo; mensajeIA: MensajeColaborativo }
export type RespuestaInteraccionColaborativa =
  | ({ kind: "advisory" | "clarification" } & RespuestaPreguntaColaborativa)
  | { kind: "action"; mensajeHumano: MensajeColaborativo; actionId: string; sourceMessageId: string; normalizedInstruction: string; baseEditorRevision: number; plan: RespuestaInterpretacionUML }
  | { kind: "action_already_applied" | "action_already_finished"; mensajeHumano: MensajeColaborativo; actionId: string; mensajeIA: MensajeColaborativo | null }
export type TipoErrorConsultaContextual = "no_disponible" | "limite" | "respuesta_invalida" | "solicitud_invalida" | "conflicto" | "interno"

export class ErrorConsultaContextual extends Error {
  constructor(readonly tipo: TipoErrorConsultaContextual, mensaje: string) { super(mensaje) }
}

async function leer<T>(respuesta: Response): Promise<T> {
  const cuerpo = await respuesta.json().catch(() => null) as Record<string, unknown> | null
  if (!respuesta.ok) {
    const tipo: TipoErrorConsultaContextual = respuesta.status === 409 ? "conflicto" : respuesta.status === 429 ? "limite"
      : respuesta.status === 502 ? "respuesta_invalida" : respuesta.status === 503 ? "no_disponible"
        : respuesta.status === 400 ? "solicitud_invalida" : "interno"
    throw new ErrorConsultaContextual(tipo, typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo completar la consulta colaborativa.")
  }
  return cuerpo as T
}

export async function cargarMensajesColaborativos(projectId: string, credencial: string, cursor?: string): Promise<PaginaMensajesColaborativos> {
  const parametros = new URLSearchParams({ limite: "30" })
  if (cursor) parametros.set("cursor", cursor)
  return leer(await fetch(construirUrlBackend(`/api/proyectos/${projectId}/mensajes?${parametros}`), { headers: { Authorization: `Bearer ${credencial}` } }))
}

export async function consultarAsistenteContextual(
  projectId: string,
  credencial: string,
  requestId: string,
  pregunta: string,
  contexto: ContextoAsistente,
  modeloEjecucion?: ModeloUMLCanonico,
  revisionEditor = 0,
): Promise<RespuestaInteraccionColaborativa> {
  const vistaActual = {
    idioma: contexto.idioma, modeloActual: contexto.modeloActual, estadoUml: contexto.estadoUml,
    generacion: contexto.generacion, cambiosSinGuardar: contexto.cambiosSinGuardar,
    candidatoImagenPendiente: contexto.candidatoImagenPendiente,
  }
  const elementoId = contexto.elementoSeleccionado?.id
  return leer(await fetch(construirUrlBackend(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credencial}` },
    body: JSON.stringify({ requestId, contenido: pregunta, ...(elementoId ? { foco: { elementoId } } : {}), vistaActual, ...(modeloEjecucion ? { modeloEjecucion, revisionEditor } : {}) }),
  }))
}

export function combinarMensajes(...grupos: MensajeColaborativo[][]): MensajeColaborativo[] {
  const unicos = new Map<string, MensajeColaborativo>()
  for (const mensaje of grupos.flat()) unicos.set(mensaje.id, mensaje)
  return [...unicos.values()].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id))
}
