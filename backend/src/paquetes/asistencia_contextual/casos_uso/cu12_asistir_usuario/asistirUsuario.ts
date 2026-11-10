import { esRespuestaAsistenteContextual, motivoRespuestaContextualInvalida, type RespuestaAsistenteContextual, type SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { diagnosticarRespuestaCU12, ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { responderAyudaProductoDeterminista } from "./responderAyudaProductoDeterminista.js"

export async function asistirUsuario(solicitud: SolicitudAsistenteContextual, proveedor: ProveedorAsistenteContextual): Promise<RespuestaAsistenteContextual> {
  const determinista = responderAyudaProductoDeterminista(solicitud)
  if (determinista) return determinista
  return validarRespuestaContextual(await proveedor.responder(solicitud), solicitud)
}

/** Única política local para el adaptador Groq y los proveedores inyectados. */
export function validarRespuestaContextual(valor: unknown, solicitud: SolicitudAsistenteContextual): RespuestaAsistenteContextual {
  const idsPermitidos = new Set([
    ...solicitud.contexto.modeloActual.clases.map((clase) => clase.id),
    ...solicitud.contexto.modeloActual.relaciones.map((relacion) => relacion.id),
    ...solicitud.contexto.elementosRelevantes.map((elemento) => elemento.id),
    ...(solicitud.contexto.elementoSeleccionado ? [solicitud.contexto.elementoSeleccionado.id] : []),
  ])
  const rechazar = (stage: "schema" | "semantic", reason: string): never => {
    diagnosticarRespuestaCU12(solicitud.requestId, stage, reason)
    throw new ErrorAsistenteContextual("respuesta_invalida", "La respuesta contextual no cumple el contrato permitido.")
  }
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return rechazar("schema", "LOCAL_SCHEMA_OBJECT")
  const candidata = { ...valor } as Record<string, unknown>
  const descartes: Array<["schema" | "semantic", string]> = []
  // El ID relacionado es prescindible solo en una respuesta sin acción de interfaz.
  if (candidata.accionSugerida === "NINGUNA" && candidata.elementoRelacionadoId !== null
    && (typeof candidata.elementoRelacionadoId !== "string" || !idsPermitidos.has(candidata.elementoRelacionadoId))) {
    candidata.elementoRelacionadoId = null
    descartes.push(["semantic", "OPTIONAL_ELEMENT_REFERENCE_INVALID"])
  }
  const nucleo = { ...candidata, recomendacion: null }
  const motivo = motivoRespuestaContextualInvalida(nucleo)
  if (motivo) return rechazar("schema", motivo)
  if (!esRespuestaAsistenteContextual(candidata)) {
    candidata.recomendacion = null
    descartes.push(["schema", "OPTIONAL_RECOMMENDATION_SCHEMA_INVALID"])
  }
  if (!esRespuestaAsistenteContextual(candidata)) return rechazar("schema", "LOCAL_SCHEMA_CONTRACT")
  const respuesta = candidata
  if (respuesta.elementoRelacionadoId !== null && !idsPermitidos.has(respuesta.elementoRelacionadoId)) {
    return rechazar("semantic", "LOCAL_ELEMENT_REFERENCE_INVALID")
  }
  if (respuesta.recomendacion && (!respuesta.recomendacion.resumen.trim() || !respuesta.recomendacion.normalizedInstruction.trim()
    || respuesta.recomendacion.targetElementIds.some((id) => !idsPermitidos.has(id)))) {
    respuesta.recomendacion = null
    descartes.push(["semantic", "OPTIONAL_RECOMMENDATION_TARGET_OR_INSTRUCTION_INVALID"])
  }
  if (respuesta.accionSugerida === "ENFOCAR_ELEMENTO" && respuesta.elementoRelacionadoId === null) {
    return rechazar("semantic", "LOCAL_FOCUS_WITHOUT_ELEMENT")
  }
  if (respuesta.accionSugerida !== "NINGUNA" && !solicitud.contexto.accionesDisponibles.includes(respuesta.accionSugerida)) {
    if (!["IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI", "MOSTRAR_IMAGEN_CANDIDATA", "ENFOCAR_ELEMENTO"].includes(respuesta.accionSugerida)) return rechazar("semantic", "LOCAL_ACTION_UNAVAILABLE")
    respuesta.accionSugerida = "NINGUNA"
    descartes.push(["semantic", "OPTIONAL_UI_ACTION_UNAVAILABLE"])
  }
  for (const [stage, reason] of descartes) diagnosticarRespuestaCU12(solicitud.requestId, stage, reason, "metadata_discarded")
  return { respuesta: respuesta.respuesta, accionSugerida: respuesta.accionSugerida, elementoRelacionadoId: respuesta.elementoRelacionadoId,
    nivel: respuesta.nivel, categoriaRecomendacion: respuesta.categoriaRecomendacion, recomendacion: respuesta.recomendacion ?? null, origen: "groq" }
}
