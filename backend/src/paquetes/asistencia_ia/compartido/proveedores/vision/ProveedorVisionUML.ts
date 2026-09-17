import type { ResultadoVisionUML } from "../../contrato/CandidatoModeloUMLImagen.js"

export interface ImagenParaAnalizar {
  datos: Buffer
  mimeType: "image/png" | "image/jpeg"
  nombreArchivo: string
}

export interface ProveedorVisionUML {
  analizarImagen(imagen: ImagenParaAnalizar): Promise<ResultadoVisionUML>
}

export class ErrorProveedorVision extends Error {
  constructor(public readonly tipo: "limite" | "modelo_no_disponible" | "no_disponible" | "respuesta_invalida", mensaje: string) {
    super(mensaje)
  }
}
