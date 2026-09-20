import { esRespuestaAsistenteContextual, type RespuestaAsistenteContextual, type SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"

export async function asistirUsuario(solicitud: SolicitudAsistenteContextual, proveedor: ProveedorAsistenteContextual): Promise<RespuestaAsistenteContextual> {
  const respuesta = await proveedor.responder(solicitud)
  if (!esRespuestaAsistenteContextual(respuesta)) {
    throw new ErrorAsistenteContextual("respuesta_invalida", "La respuesta contextual no cumple el contrato permitido.")
  }
  const idsPermitidos = new Set([
    ...solicitud.contexto.elementosRelevantes.map((elemento) => elemento.id),
    ...(solicitud.contexto.elementoSeleccionado ? [solicitud.contexto.elementoSeleccionado.id] : []),
  ])
  if (respuesta.elementoRelacionadoId !== null && !idsPermitidos.has(respuesta.elementoRelacionadoId)) {
    throw new ErrorAsistenteContextual("respuesta_invalida", "La respuesta contextual referencia un elemento inexistente en el contexto.")
  }
  if (respuesta.accionSugerida === "ENFOCAR_ELEMENTO" && respuesta.elementoRelacionadoId === null) {
    throw new ErrorAsistenteContextual("respuesta_invalida", "La acción de enfoque requiere un elemento del contexto.")
  }
  if (respuesta.accionSugerida !== "NINGUNA" && !solicitud.contexto.accionesDisponibles.includes(respuesta.accionSugerida)) {
    throw new ErrorAsistenteContextual("respuesta_invalida", "La respuesta contextual sugiere una acción no disponible en el estado actual.")
  }
  return respuesta
}
