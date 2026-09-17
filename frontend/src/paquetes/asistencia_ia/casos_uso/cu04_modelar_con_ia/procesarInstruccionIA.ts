import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { ejecutarComandosUML } from "./EjecutorComandosUML"
import type { RespuestaInterpretacionUML, SolicitudInterpretacionUML } from "./ComandoModeloUML"

export type EstadoProcesoIA = "interpretando" | "aplicando"

export interface EstadoModeloRevision {
  modelo: ModeloUMLCanonico
  revision: number
}

export async function procesarInstruccionIA(opciones: {
  instruccion: string
  obtenerEstado: () => EstadoModeloRevision
  solicitar: (solicitud: SolicitudInterpretacionUML) => Promise<RespuestaInterpretacionUML>
  aplicar: (modelo: ModeloUMLCanonico) => void
  alCambiarEstado: (estado: EstadoProcesoIA) => void
  generarId?: (categoria: "clase" | "atributo" | "relacion") => string
}): Promise<{ resultado: "aplicado" | "aclarar" | "rechazar" | "error"; mensaje: string }> {
  for (let intento = 0; intento < 2; intento += 1) {
    const estadoSolicitud = opciones.obtenerEstado()
    opciones.alCambiarEstado("interpretando")
    const respuesta = await opciones.solicitar({ instruccion: opciones.instruccion, ...estadoSolicitud })
    const estadoActual = opciones.obtenerEstado()
    if (respuesta.revision !== estadoSolicitud.revision || estadoActual.revision !== estadoSolicitud.revision) {
      if (intento === 0) continue
      return { resultado: "error", mensaje: "El modelo cambió mientras se procesaba la instrucción. Inténtalo nuevamente." }
    }
    if (respuesta.resultado !== "aplicar") return { resultado: respuesta.resultado, mensaje: respuesta.mensaje }

    const nuevoModelo = ejecutarComandosUML(estadoSolicitud.modelo, respuesta.comandos, opciones.generarId)
    const validacion = validarModelo(nuevoModelo)
    if (!validacion.valido) return { resultado: "error", mensaje: "El cambio propuesto no supera la validación UML determinista." }
    opciones.alCambiarEstado("aplicando")
    opciones.aplicar(nuevoModelo)
    return { resultado: "aplicado", mensaje: respuesta.mensaje }
  }
  return { resultado: "error", mensaje: "No se pudo procesar la instrucción." }
}
