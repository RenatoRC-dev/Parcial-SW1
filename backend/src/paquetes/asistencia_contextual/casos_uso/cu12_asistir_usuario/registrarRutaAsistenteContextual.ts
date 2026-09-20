import type { Express } from "express"
import { esSolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { asistirUsuario } from "./asistirUsuario.js"

export function registrarRutaAsistenteContextual(aplicacion: Express, proveedor: ProveedorAsistenteContextual): void {
  aplicacion.post("/api/ia/contextual/preguntar", async (solicitud, respuesta) => {
    if (!esSolicitudAsistenteContextual(solicitud.body)) {
      respuesta.status(400).json({ error: "La solicitud del asistente contextual es inválida." })
      return
    }
    try {
      respuesta.status(200).json(await asistirUsuario(solicitud.body, proveedor))
    } catch (error) {
      if (error instanceof ErrorAsistenteContextual) {
        respuesta.status(error.tipo === "limite" ? 429 : error.tipo === "respuesta_invalida" ? 502 : 503).json({
          error: error.tipo === "limite"
            ? "El asistente alcanzó temporalmente su límite de uso."
            : "El asistente IA no está disponible temporalmente. La orientación del sistema continúa disponible.",
        })
        return
      }
      console.error(error)
      respuesta.status(500).json({ error: "No se pudo obtener orientación contextual." })
    }
  })
}
