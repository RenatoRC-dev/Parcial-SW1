import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { CandidatoModeloUMLImagen } from "../../asistencia_ia/compartido/contrato/CandidatoModeloUMLImagen.js"
import type { MensajeProyecto } from "../../mensajeria_colaborativa/compartido/MensajeProyecto.js"

export type OperacionFlujo = "analizar_imagen" | "importar_xmi" | "exportar_xmi" | "generar_spring" | "automatizar_ea"
export type EstadoFlujo = "processing" | "review" | "ready" | "issued" | "applied" | "cancelled" | "failed" | "queued" | "importing"
export interface VistaFlujoAsistente {
  requestId: string
  sourceMessageId: string
  participantId: string
  operacion: OperacionFlujo
  estado: EstadoFlujo
  revision: number
  resumen: string
  advertencias: string[]
  candidato?: CandidatoModeloUMLImagen
  clases?: string[]
  archivo?: { nombre: "modelo.xmi" | "backend-generado.zip"; mime: "application/xml" | "application/zip" }
}
/** Interno, embebido en el mensaje humano de Mongo, nunca publicado al canal Yjs/chat. */
export interface FlujoAsistentePersistido extends Omit<VistaFlujoAsistente, "archivo"> {
  projectId: string
  huella: string
  modeloBase: ModeloUMLCanonicoIntercambio
  modeloResultado?: ModeloUMLCanonicoIntercambio
  archivo?: VistaFlujoAsistente["archivo"] & { base64: string }
  completionRequestId: string
  ea?: { deviceId: string; targetId: string; expires: number; sha256: string; packageGuid?: string }
}
export interface RespuestaFlujoAsistente { kind: "workflow"; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto | null; flujo: VistaFlujoAsistente }
export interface AplicacionFlujoAsistente { flujo: VistaFlujoAsistente; modeloResultado?: ModeloUMLCanonicoIntercambio }

export function vistaFlujo(flujo: FlujoAsistentePersistido): VistaFlujoAsistente {
  const { projectId: _p, huella: _h, modeloBase: _b, modeloResultado: _r, completionRequestId: _c, ea: _ea, archivo, ...vista } = flujo
  return { ...vista, ...(archivo ? { archivo: { nombre: archivo.nombre, mime: archivo.mime } } : {}) }
}
