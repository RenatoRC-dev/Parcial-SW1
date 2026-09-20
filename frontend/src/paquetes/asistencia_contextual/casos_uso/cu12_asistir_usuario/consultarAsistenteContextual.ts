import type { ContextoAsistente, MensajeConversacionContextual, RespuestaAsistenteContextual } from "./ContextoAsistente"

export async function consultarAsistenteContextual(pregunta: string, contexto: ContextoAsistente, conversacion: MensajeConversacionContextual[]): Promise<RespuestaAsistenteContextual> {
  const respuesta = await fetch("/api/ia/contextual/preguntar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pregunta, contexto, conversacion: conversacion.slice(-8) }),
  })
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error
      : "El asistente IA no está disponible temporalmente. La orientación del sistema continúa disponible."
    throw new Error(mensaje)
  }
  return cuerpo as RespuestaAsistenteContextual
}
