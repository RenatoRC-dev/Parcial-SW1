import type { RespuestaInterpretacionUML, SolicitudInterpretacionUML } from "./ComandoModeloUML"
import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"

export async function solicitarCambioIA(solicitud: SolicitudInterpretacionUML): Promise<RespuestaInterpretacionUML> {
  const respuesta = await fetch(construirUrlBackend("/api/ia/modelado/interpretar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(solicitud),
  })
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error
      : "No se pudo procesar la instrucción con IA."
    throw new Error(mensaje)
  }
  return cuerpo as RespuestaInterpretacionUML
}
