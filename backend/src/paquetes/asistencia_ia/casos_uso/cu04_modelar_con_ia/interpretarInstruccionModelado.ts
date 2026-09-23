import type { ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import type { SolicitudInterpretacionUML, RespuestaInterpretacionUMLHttp } from "../../compartido/contrato/PlanCambiosUML.js"
import { construirContextoModelo } from "./construirContextoModelo.js"
import { ErrorPlanCambiosUML } from "./EjecutorComandosUML.js"
import { validarPlanCambiosUML } from "./validarPlanCambiosUML.js"
import { normalizarComandosAsistidos } from "./normalizarSemanticaAsistida.js"

export async function interpretarInstruccionModelado(
  solicitud: SolicitudInterpretacionUML,
  proveedor: ProveedorModeloLenguaje,
): Promise<RespuestaInterpretacionUMLHttp> {
  const interpretacion = await proveedor.interpretarCambiosUML({
    instruccion: solicitud.instruccion,
    modelo: solicitud.modelo,
    contexto: construirContextoModelo(solicitud.modelo),
  })
  console.info(`[CU04][AI] interpretation_received result=${interpretacion.resultado} commands=${interpretacion.comandos.length}`)
  if (interpretacion.resultado !== "aplicar") {
    return { ...interpretacion, comandos: [], revision: solicitud.revision }
  }
  try {
    const comandos = normalizarComandosAsistidos(solicitud.modelo, interpretacion.comandos)
    const destructivo = comandos.some((comando) => comando.tipo.startsWith("eliminar_"))
    if (destructivo && !/\b(elimina|eliminar|borra|borrar|quita|quitar)\b/i.test(solicitud.instruccion)) {
      return {
        resultado: "aclarar",
        mensaje: "La eliminación debe solicitarse de forma explícita.",
        comandos: [],
        revision: solicitud.revision,
      }
    }
    validarPlanCambiosUML(solicitud.modelo, comandos)
    console.info(`[CU04][UML] validation_success commands=${comandos.length}`)
    return { ...interpretacion, comandos, revision: solicitud.revision }
  } catch (error) {
    console.warn(`[CU04][UML] validation_error type=${error instanceof ErrorPlanCambiosUML ? "plan_invalido" : "internal"}`)
    const detalle = error instanceof ErrorPlanCambiosUML ? ` ${error.message}` : ""
    return {
      resultado: "rechazar",
      mensaje: `La instrucción no produjo un cambio UML válido.${detalle} Revisa la solicitud e intenta nuevamente. El modelo no fue modificado.`,
      comandos: [],
      revision: solicitud.revision,
    }
  }
}
