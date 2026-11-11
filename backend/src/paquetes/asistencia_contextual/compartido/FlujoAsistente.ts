import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { CandidatoModeloUMLImagen } from "../../asistencia_ia/compartido/contrato/CandidatoModeloUMLImagen.js"
import type { MensajeProyecto } from "../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import type { PasoIA } from "../../mensajeria_colaborativa/compartido/MensajeProyecto.js"

export type OperacionFlujo = "analizar_imagen" | "importar_xmi" | "exportar_xmi" | "generar_spring" | "automatizar_ea" | "importar_desde_ea"
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
  resumenModelo?: { clases: number; atributos: number; relaciones: number }
  procedencia?: PasoIA[]
  vistaPrevia?: {
    clases: Array<{ nombre: string; atributos: Array<{ nombre: string; tipo: string | null }> }>
    relaciones: Array<{ nombre: string; tipo: string; origen: string; destino: string; multiplicidadOrigen: string | null; multiplicidadDestino: string | null; rolOrigen: string; rolDestino: string }>
    truncado: boolean
  }
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
  ea?: { deviceId: string; targetId: string; expires: number; sha256: string; packageGuid?: string; direction?: "nexo_to_ea" | "ea_to_nexo" }
}
export interface RespuestaFlujoAsistente { kind: "workflow"; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto | null; flujo: VistaFlujoAsistente }
export interface AplicacionFlujoAsistente { flujo: VistaFlujoAsistente; modeloResultado?: ModeloUMLCanonicoIntercambio }
export interface EstadoConectorEA {
  estado: "not_configured" | "disconnected" | "connected" | "expired" | "in_progress" | "verified" | "failed"
  expires?: number
  lastSeen?: number
  trabajo?: { requestId: string; estado: EstadoFlujo }
}

export function vistaFlujo(flujo: FlujoAsistentePersistido): VistaFlujoAsistente {
  const { projectId: _p, huella: _h, modeloBase: _b, modeloResultado: _r, completionRequestId: _c, ea: _ea, archivo, ...vista } = flujo
  const modelo = flujo.modeloResultado
  const nombres = new Map(modelo?.clases.map((c) => [c.id, c.nombre]) ?? [])
  const vistaPrevia = modelo && ["review", "issued"].includes(flujo.estado) ? {
    clases: modelo.clases.slice(0, 50).map((c) => ({ nombre: c.nombre, atributos: c.atributos.slice(0, 30).map((a) => ({ nombre: a.nombre, tipo: a.tipo })) })),
    relaciones: modelo.relaciones.slice(0, 80).map((r) => ({ nombre: r.nombre ?? "", tipo: r.tipo, origen: nombres.get(r.claseOrigenId) ?? r.claseOrigenId, destino: nombres.get(r.claseDestinoId) ?? r.claseDestinoId, multiplicidadOrigen: r.multiplicidadOrigen, multiplicidadDestino: r.multiplicidadDestino, rolOrigen: r.rolOrigen ?? "", rolDestino: r.rolDestino ?? "" })),
    truncado: modelo.clases.length > 50 || modelo.relaciones.length > 80 || modelo.clases.some((c) => c.atributos.length > 30),
  } : undefined
  return { ...vista, ...(vistaPrevia ? { vistaPrevia } : {}), ...(archivo ? { archivo: { nombre: archivo.nombre, mime: archivo.mime } } : {}) }
}
