import type { ModeloUMLCanonicoIA } from "../contrato/ComandoModeloUML.js"
import type { RespuestaInterpretacionUML } from "../contrato/PlanCambiosUML.js"

export interface SolicitudProveedorUML {
  instruccion: string
  modelo: ModeloUMLCanonicoIA
  contexto: unknown
}

export interface ProveedorModeloLenguaje {
  interpretarCambiosUML(solicitud: SolicitudProveedorUML): Promise<RespuestaInterpretacionUML>
}

export class ErrorProveedorIA extends Error {
  constructor(public readonly tipo: "limite" | "no_disponible" | "respuesta_invalida" | "configuracion" | "autenticacion" | "timeout", mensaje: string) {
    super(mensaje)
  }
}
