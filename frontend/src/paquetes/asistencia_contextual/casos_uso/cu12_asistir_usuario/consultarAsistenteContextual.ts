import type { ContextoAsistente, MensajeConversacionContextual, RespuestaAsistenteContextual } from "./ContextoAsistente"
import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"

export type TipoErrorConsultaContextual = "no_disponible" | "limite" | "respuesta_invalida" | "solicitud_invalida" | "interno"

export class ErrorConsultaContextual extends Error {
  constructor(readonly tipo: TipoErrorConsultaContextual, mensaje: string) {
    super(mensaje)
  }
}

export async function consultarAsistenteContextual(pregunta: string, contexto: ContextoAsistente, conversacion: MensajeConversacionContextual[]): Promise<RespuestaAsistenteContextual> {
  const respuesta = await fetch(construirUrlBackend("/api/ia/contextual/preguntar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pregunta, contexto, conversacion: conversacion.slice(-8) }),
  })
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error
      : "No se pudo obtener orientación contextual."
    const tipoRecibido = typeof cuerpo === "object" && cuerpo !== null && "tipo" in cuerpo && typeof cuerpo.tipo === "string" ? cuerpo.tipo : null
    const tipos = new Set<TipoErrorConsultaContextual>(["no_disponible", "limite", "respuesta_invalida", "solicitud_invalida", "interno"])
    const tipo = tipoRecibido && tipos.has(tipoRecibido as TipoErrorConsultaContextual)
      ? tipoRecibido as TipoErrorConsultaContextual
      : respuesta.status === 429 ? "limite" : respuesta.status === 503 ? "no_disponible" : "interno"
    throw new ErrorConsultaContextual(tipo, mensaje)
  }
  return cuerpo as RespuestaAsistenteContextual
}
