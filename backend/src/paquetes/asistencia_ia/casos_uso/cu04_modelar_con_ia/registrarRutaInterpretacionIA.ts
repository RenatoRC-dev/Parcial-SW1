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
        const estado = error.tipo === "limite" ? 429 : 503
        const mensaje = error.tipo === "limite"
          ? "El servicio de IA alcanzó temporalmente su límite de uso."
          : "El servicio de IA no está disponible temporalmente."
        respuesta.status(estado).json({ error: mensaje })
        return
      }
      console.error(error)
      respuesta.status(500).json({ error: "No se pudo interpretar la instrucción de modelado." })
    }
  })
}
