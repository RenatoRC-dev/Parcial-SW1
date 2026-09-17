import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "./ComandoModeloUML.js"

export interface SolicitudInterpretacionUML {
  instruccion: string
  modelo: ModeloUMLCanonicoIA
  revision: number
}

export interface RespuestaInterpretacionUML {
  resultado: "aplicar" | "aclarar" | "rechazar"
  mensaje: string
  comandos: ComandoModeloUML[]
}

export interface RespuestaInterpretacionUMLHttp extends RespuestaInterpretacionUML {
  revision: number
}
