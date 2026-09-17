import type { ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import type { SolicitudInterpretacionUML, RespuestaInterpretacionUMLHttp } from "../../compartido/contrato/PlanCambiosUML.js"
import { construirContextoModelo } from "./construirContextoModelo.js"
import { ErrorPlanCambiosUML } from "./EjecutorComandosUML.js"
import { validarPlanCambiosUML } from "./validarPlanCambiosUML.js"

export async function interpretarInstruccionModelado(
  solicitud: SolicitudInterpretacionUML,
  proveedor: ProveedorModeloLenguaje,
): Promise<RespuestaInterpretacionUMLHttp> {
  const interpretacion = await proveedor.interpretarCambiosUML({
    instruccion: solicitud.instruccion,
    modelo: solicitud.modelo,
    contexto: construirContextoModelo(solicitud.modelo),
  })
  if (interpretacion.resultado !== "aplicar") {
    return { ...interpretacion, comandos: [], revision: solicitud.revision }
  }
  try {
    const destructivo = interpretacion.comandos.some((comando) => comando.tipo.startsWith("eliminar_"))
    if (destructivo && !/\b(elimina|eliminar|borra|borrar|quita|quitar)\b/i.test(solicitud.instruccion)) {
      return {
        resultado: "aclarar",
        mensaje: "La eliminación debe solicitarse de forma explícita.",
        comandos: [],
        revision: solicitud.revision,
      }
    }
    validarPlanCambiosUML(solicitud.modelo, interpretacion.comandos)
    return { ...interpretacion, revision: solicitud.revision }
  } catch (error) {
    const mensaje = error instanceof ErrorPlanCambiosUML ? error.message : "El plan no supera la validación determinista."
    return { resultado: "rechazar", mensaje, comandos: [], revision: solicitud.revision }
  }
}
