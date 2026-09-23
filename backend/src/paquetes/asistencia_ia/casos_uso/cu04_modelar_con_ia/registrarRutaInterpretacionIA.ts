import type { Express } from "express"
import { ErrorProveedorIA, type ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import { interpretarInstruccionModelado } from "./interpretarInstruccionModelado.js"
import { validarSolicitudInterpretacion } from "./ValidarSolicitudInterpretacion.js"

export function registrarRutaInterpretacionIA(aplicacion: Express, proveedor: ProveedorModeloLenguaje): void {
  aplicacion.post("/api/ia/modelado/interpretar", async (solicitud, respuesta) => {
    const entrada = validarSolicitudInterpretacion(solicitud.body)
    if (!entrada) {
      respuesta.status(400).json({ error: "La solicitud de modelado con IA es inválida." })
      return
    }
    try {
      respuesta.status(200).json(await interpretarInstruccionModelado(entrada, proveedor))
    } catch (error) {
      if (error instanceof ErrorProveedorIA) {
        const respuestas = {
          limite: { estado: 429, mensaje: "El servicio de IA está temporalmente limitado. Espera unos segundos e intenta nuevamente. El modelo no fue modificado." },
          timeout: { estado: 504, mensaje: "La IA tardó demasiado en responder. Intenta nuevamente. El modelo no fue modificado." },
          respuesta_invalida: { estado: 502, mensaje: "La IA respondió en un formato que no pudo procesarse. El modelo no fue modificado." },
          configuracion: { estado: 503, mensaje: "No se pudo acceder al servicio de IA por un problema de configuración. El modelo no fue modificado." },
          autenticacion: { estado: 503, mensaje: "No se pudo acceder al servicio de IA por un problema de configuración. El modelo no fue modificado." },
          no_disponible: { estado: 503, mensaje: "El servicio de IA no está disponible en este momento. Intenta nuevamente. El modelo no fue modificado." },
        } as const
        const salida = respuestas[error.tipo]
        respuesta.status(salida.estado).json({ error: salida.mensaje, tipo: error.tipo })
        return
      }
      console.error("[CU04][AI] internal_error", error)
      respuesta.status(500).json({ error: "No se pudo completar la operación. El modelo no fue modificado.", tipo: "interno" })
    }
  })
}
