import type { CambioAplicadoIA, RespuestaInterpretacionUML, SolicitudInterpretacionUML } from "./ComandoModeloUML"
import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"

export async function solicitarCambioIA(projectId: string, credential: string, solicitud: SolicitudInterpretacionUML): Promise<RespuestaInterpretacionUML> {
  const respuesta = await fetch(construirUrlBackend(`/api/proyectos/${projectId}/modelado-ia/interpretar`), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` },
    body: JSON.stringify(solicitud),
  })
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error
      : "No se pudo procesar la instrucción con IA."
    throw new Error(mensaje)
  }
  const salida = cuerpo as { kind?: string; actionId?: string; plan?: RespuestaInterpretacionUML }
  if (salida.kind === "action" && salida.plan) return { ...salida.plan, actionId: salida.actionId }
  if (salida.kind === "action_already_applied" || salida.kind === "action_already_finished") return { resultado: "rechazar", mensaje: "Esta solicitud ya fue finalizada; no se ejecutara nuevamente.", comandos: [], revision: solicitud.revision }
  if (salida.plan) return salida.plan
  if (typeof cuerpo === "object" && cuerpo !== null && "resultado" in cuerpo) return cuerpo as RespuestaInterpretacionUML
  throw new Error("La respuesta de modelado con IA no cumple el contrato esperado.")
}

export async function completarCambioIA(projectId: string, credential: string, actionId: string, resultado: "applied" | "failed", cambios: CambioAplicadoIA[] = [], mensaje?: string): Promise<{ kind: string; mensajeIA?: unknown }> {
  const respuesta = await fetch(construirUrlBackend(`/api/proyectos/${projectId}/modelado-ia/acciones/${actionId}/completar`), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` },
    body: JSON.stringify({ resultado, cambios, ...(mensaje ? { mensaje } : {}) }),
  })
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null) as { error?: string } | null
    throw new Error(cuerpo?.error ?? "No se pudo confirmar la accion de modelado con IA.")
  }
  return respuesta.json() as Promise<{ kind: string; mensajeIA?: unknown }>
}
