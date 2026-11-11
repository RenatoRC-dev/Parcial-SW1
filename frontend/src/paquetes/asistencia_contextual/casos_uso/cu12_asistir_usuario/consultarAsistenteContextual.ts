import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"
import type { ContextoAsistente } from "./ContextoAsistente"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { RespuestaInterpretacionUML } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ComandoModeloUML"
import type { VistaFlujoAsistente, RespuestaFlujoAsistente, AplicacionFlujoAsistente } from "../../../../../../backend/src/paquetes/asistencia_contextual/compartido/FlujoAsistente.js"
export type { VistaFlujoAsistente }

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
  recomendacion?: { resumen: string; targetElementIds: string[]; normalizedInstruction: string } | null
}

export interface PaginaMensajesColaborativos { items: MensajeColaborativo[]; siguienteCursor: string | null }
export interface RespuestaPreguntaColaborativa { mensajeHumano: MensajeColaborativo; mensajeIA: MensajeColaborativo }
export type RespuestaInteraccionColaborativa =
  | RespuestaFlujoAsistente
  | ({ kind: "tool"; operacion: "validar_uml" | "exportar_xmi"; baseEditorRevision: number; artifact?: { nombre: "modelo.xmi"; mime: "application/xml"; contenido: string } } & RespuestaPreguntaColaborativa)
  | ({ kind: "advisory" | "clarification" } & RespuestaPreguntaColaborativa)
  | { kind: "action"; mensajeHumano: MensajeColaborativo; actionId: string; sourceMessageId: string; normalizedInstruction: string; baseEditorRevision: number; plan: RespuestaInterpretacionUML }
  | { kind: "action_already_applied" | "action_already_finished"; mensajeHumano: MensajeColaborativo; actionId: string; mensajeIA: MensajeColaborativo | null }
export type TipoErrorConsultaContextual = "no_disponible" | "limite" | "respuesta_invalida" | "solicitud_invalida" | "conflicto" | "interno"

export class ErrorConsultaContextual extends Error {
  constructor(readonly tipo: TipoErrorConsultaContextual, mensaje: string, readonly retryAfterSeconds?: number) { super(mensaje) }
}

async function leer<T>(respuesta: Response): Promise<T> {
  const cuerpo = await respuesta.json().catch(() => null) as Record<string, unknown> | null
  if (!respuesta.ok) {
    const tipo: TipoErrorConsultaContextual = respuesta.status === 409 ? "conflicto" : respuesta.status === 429 ? "limite"
      : respuesta.status === 502 ? "respuesta_invalida" : respuesta.status === 503 || respuesta.status === 504 ? "no_disponible"
        : respuesta.status === 400 ? "solicitud_invalida" : "interno"
    const espera = Number(respuesta.headers.get("Retry-After") ?? cuerpo?.retryAfterSeconds ?? 30)
    throw new ErrorConsultaContextual(tipo, typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo completar la consulta colaborativa.", tipo === "limite" ? Math.min(300, Math.max(1, Number.isFinite(espera) ? espera : 30)) : undefined)
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
  archivo?: File,
): Promise<RespuestaInteraccionColaborativa> {
  const vistaActual = {
    idioma: contexto.idioma, modeloActual: contexto.modeloActual, estadoUml: contexto.estadoUml,
    generacion: contexto.generacion, cambiosSinGuardar: contexto.cambiosSinGuardar,
    candidatoImagenPendiente: contexto.candidatoImagenPendiente,
  }
  const elementoId = contexto.elementoSeleccionado?.id
  const turno = JSON.stringify({ requestId, contenido: pregunta, ...(elementoId ? { foco: { elementoId } } : {}), vistaActual, ...(modeloEjecucion ? { modeloEjecucion, revisionEditor } : {}) })
  const datos = archivo ? new FormData() : null
  if (archivo && datos) { datos.append("turno", turno); datos.append("archivo", archivo) }
  return leer(await fetch(construirUrlBackend(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`), {
    method: "POST", headers: { ...(!archivo ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${credencial}` },
    body: datos ?? turno,
  }))
}

const rutaFlujo = (projectId: string, requestId?: string) => construirUrlBackend(`/api/proyectos/${encodeURIComponent(projectId)}/asistente-colaborativo/turnos${requestId ? `/${encodeURIComponent(requestId)}` : ""}`)
export async function recuperarFlujosAsistente(projectId: string, credencial: string, requestIds?: string[]): Promise<VistaFlujoAsistente[]> {
  const consulta = requestIds ? `?${new URLSearchParams({ requestIds: requestIds.join(",") })}` : ""
  return leer(await fetch(`${rutaFlujo(projectId)}${consulta}`, { headers: { Authorization: `Bearer ${credencial}` } }))
}
export async function confirmarFlujoAsistente(projectId: string, credencial: string, requestId: string, decision: "confirmar" | "rechazar", modeloEjecucion: ModeloUMLCanonico, revisionEditor: number): Promise<AplicacionFlujoAsistente> {
  return leer(await fetch(`${rutaFlujo(projectId, requestId)}/confirmar`, { method: "POST", headers: { Authorization: `Bearer ${credencial}`, "Content-Type": "application/json" }, body: JSON.stringify({ decision, modeloEjecucion, revisionEditor }) }))
}
export async function completarFlujoAsistente(projectId: string, credencial: string, requestId: string, resultado: "applied" | "failed", modeloEjecucion?: ModeloUMLCanonico): Promise<RespuestaFlujoAsistente> {
  return leer(await fetch(`${rutaFlujo(projectId, requestId)}/completar`, { method: "POST", headers: { Authorization: `Bearer ${credencial}`, "Content-Type": "application/json" }, body: JSON.stringify({ resultado, modeloEjecucion }) }))
}
export async function descargarArchivoFlujo(projectId: string, credencial: string, flujo: VistaFlujoAsistente): Promise<void> {
  if (!flujo.archivo || flujo.estado !== "ready") throw new Error("No hay un archivo generado para descargar.")
  const respuesta = await fetch(`${rutaFlujo(projectId, flujo.requestId)}/archivo`, { headers: { Authorization: `Bearer ${credencial}` } })
  if (!respuesta.ok) { await leer(respuesta); return }
  if (!respuesta.headers.get("Content-Type")?.startsWith(flujo.archivo.mime)) throw new Error("El servidor no devolvió el formato de archivo esperado.")
  const blob = await respuesta.blob()
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a"); enlace.href = url; enlace.download = flujo.archivo.nombre; enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function combinarMensajes(...grupos: MensajeColaborativo[][]): MensajeColaborativo[] {
  const unicos = new Map<string, MensajeColaborativo>()
  for (const mensaje of grupos.flat()) unicos.set(mensaje.id, mensaje)
  return [...unicos.values()].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id))
}
