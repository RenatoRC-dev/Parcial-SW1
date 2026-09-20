import type { RespuestaAsistenteContextual, SolicitudAsistenteContextual } from "./ContratoAsistenteContextual.js"

export interface ProveedorAsistenteContextual {
  responder(solicitud: SolicitudAsistenteContextual): Promise<RespuestaAsistenteContextual>
}

export class ErrorAsistenteContextual extends Error {
  constructor(public readonly tipo: "limite" | "no_disponible" | "respuesta_invalida", mensaje: string) {
    super(mensaje)
  }
}
