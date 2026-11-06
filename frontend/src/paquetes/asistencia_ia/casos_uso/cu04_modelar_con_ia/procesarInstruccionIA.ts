import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { ejecutarComandosUMLConTrazabilidad } from "./EjecutorComandosUML"
import type { CambioAplicadoIA, RespuestaInterpretacionUML, SolicitudInterpretacionUML } from "./ComandoModeloUML"

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
  generarId?: (categoria: "clase" | "atributo" | "metodo" | "parametro" | "relacion") => string
  requestId?: string
}): Promise<{ resultado: "aplicado" | "aclarar" | "rechazar" | "error"; mensaje: string; actionId?: string; cambios?: CambioAplicadoIA[] }> {
  for (let intento = 0; intento < 2; intento += 1) {
    const estadoSolicitud = opciones.obtenerEstado()
    opciones.alCambiarEstado("interpretando")
    const respuesta = await opciones.solicitar({ requestId: opciones.requestId ?? crypto.randomUUID(), instruccion: opciones.instruccion, ...estadoSolicitud })
    const estadoActual = opciones.obtenerEstado()
    if (respuesta.revision !== estadoSolicitud.revision || estadoActual.revision !== estadoSolicitud.revision) {
      if (intento === 0) continue
      return { resultado: "error", mensaje: "El modelo cambió mientras se procesaba la instrucción. Inténtalo nuevamente." }
    }
    if (respuesta.resultado !== "aplicar") return { resultado: respuesta.resultado, mensaje: respuesta.mensaje }

    const ejecucion = ejecutarComandosUMLConTrazabilidad(estadoSolicitud.modelo, respuesta.comandos, opciones.generarId)
    const validacion = validarModelo(ejecucion.modelo)
    if (!validacion.valido) return { resultado: "error", mensaje: "El cambio propuesto no supera la validación UML determinista." }
    opciones.alCambiarEstado("aplicando")
    opciones.aplicar(ejecucion.modelo)
    return { resultado: "aplicado", mensaje: respuesta.mensaje, actionId: respuesta.actionId, cambios: ejecucion.cambios }
  }
  return { resultado: "error", mensaje: "No se pudo procesar la instrucción." }
}

export function aplicarPlanIA(opciones: {
  plan: RespuestaInterpretacionUML
  baseEditorRevision: number
  obtenerEstado: () => EstadoModeloRevision
  aplicar: (modelo: ModeloUMLCanonico) => void
  generarId?: (categoria: "clase" | "atributo" | "metodo" | "parametro" | "relacion") => string
}): { resultado: "aplicado" | "stale" | "error"; mensaje: string; cambios: CambioAplicadoIA[] } {
  const estado = opciones.obtenerEstado()
  if (estado.revision !== opciones.baseEditorRevision || opciones.plan.revision !== opciones.baseEditorRevision) {
    return { resultado: "stale", mensaje: "El modelo cambio mientras se preparaba la modificacion. Vuelve a solicitarla para revalidar el objetivo.", cambios: [] }
  }
  try {
    const ejecucion = ejecutarComandosUMLConTrazabilidad(estado.modelo, opciones.plan.comandos, opciones.generarId)
    if (!validarModelo(ejecucion.modelo).valido) return { resultado: "error", mensaje: "El cambio propuesto no supera la validacion UML determinista.", cambios: [] }
    opciones.aplicar(ejecucion.modelo)
    return { resultado: "aplicado", mensaje: opciones.plan.mensaje, cambios: ejecucion.cambios }
  } catch (error) {
    return { resultado: "error", mensaje: error instanceof Error ? error.message : "No se pudo aplicar el plan UML.", cambios: [] }
  }
}
