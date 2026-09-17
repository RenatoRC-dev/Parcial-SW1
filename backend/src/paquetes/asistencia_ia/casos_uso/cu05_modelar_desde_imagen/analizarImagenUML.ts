import type { ResultadoVisionUML } from "../../compartido/contrato/CandidatoModeloUMLImagen.js"
import { ErrorProveedorVision, type ImagenParaAnalizar, type ProveedorVisionUML } from "../../compartido/proveedores/vision/ProveedorVisionUML.js"
import { esResultadoVisionUML } from "./validarCandidatoModeloUML.js"

export async function analizarImagenUML(imagen: ImagenParaAnalizar, proveedor: ProveedorVisionUML): Promise<ResultadoVisionUML> {
  const resultado = await proveedor.analizarImagen(imagen)
  if (!esResultadoVisionUML(resultado)) {
    throw new ErrorProveedorVision("respuesta_invalida", "La respuesta visual no cumple el contrato CU05.")
  }
  return resultado
}
