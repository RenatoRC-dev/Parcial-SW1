import type { RespuestaAsistenteContextual, SolicitudAsistenteContextual } from "./ContratoAsistenteContextual.js"

export interface ProveedorAsistenteContextual {
  responder(solicitud: SolicitudAsistenteContextual): Promise<RespuestaAsistenteContextual>
}

export class ErrorAsistenteContextual extends Error {
  constructor(public readonly tipo: "limite" | "no_disponible" | "respuesta_invalida" | "timeout", mensaje: string, public readonly retryAfterSeconds?: number) {
    super(mensaje)
  }
}

export function diagnosticarRespuestaCU12(requestId: string | undefined, stage: "provider" | "json" | "schema" | "semantic", reason: string, outcome: "rejected" | "metadata_discarded" = "rejected"): void {
  console.warn("[CU12] response_validation", { requestId, stage, reason, outcome })
}
