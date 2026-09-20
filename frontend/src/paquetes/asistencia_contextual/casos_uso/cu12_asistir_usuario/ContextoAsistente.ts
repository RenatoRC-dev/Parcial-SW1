import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ResultadoAptitudGeneracion } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/EvaluadorAptitudGeneracionSpring"
import type { ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"

export const ACCIONES_ASISTENTE_CONTEXTUAL = ["NINGUNA", "ENFOCAR_ELEMENTO", "IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI", "MOSTRAR_IMAGEN_CANDIDATA"] as const
export type AccionAsistenteContextual = typeof ACCIONES_ASISTENTE_CONTEXTUAL[number]

export interface ContextoAsistente {
  proyecto: { id: string; nombre: string } | null
  area: "modelado_uml"
  elementoSeleccionado: { id: string; tipo: "clase" | "relacion"; nombre: string } | null
  elementosRelevantes: Array<{ id: string; tipo: "clase" | "relacion"; nombre: string }>
  resumenModelo: { clases: number; relaciones: number }
  estadoUml: { estado: "valido" | "invalido" | "incompleto"; problemas: string[] }
  generacion: { estado: "apto" | "no_apto"; bloqueos: string[]; advertencias: string[] }
  cambiosSinGuardar: boolean
  candidatoImagenPendiente: boolean
  accionesDisponibles: AccionAsistenteContextual[]
}

export interface RespuestaAsistenteContextual {
  respuesta: string
  accionSugerida: AccionAsistenteContextual
  elementoRelacionadoId: string | null
  nivel: "informacion" | "sugerencia" | "advertencia"
}

export interface MensajeConversacionContextual { rol: "usuario" | "asistente"; contenido: string }

function nombreSemanticoPorId(modelo: ModeloUMLCanonico): Map<string, string> {
  const nombres = new Map<string, string>()
  for (const clase of modelo.clases) {
    nombres.set(clase.id, clase.nombre)
    for (const atributo of clase.atributos) nombres.set(atributo.id, `${clase.nombre}.${atributo.nombre}`)
  }
  for (const relacion of modelo.relaciones) {
    const origen = modelo.clases.find((clase) => clase.id === relacion.claseOrigenId)?.nombre ?? "origen"
    const destino = modelo.clases.find((clase) => clase.id === relacion.claseDestinoId)?.nombre ?? "destino"
    nombres.set(relacion.id, relacion.nombre?.trim() ? `«${relacion.nombre.trim()}» entre ${origen} y ${destino}` : `${origen} — ${destino}`)
  }
  return nombres
}

export function construirContextoAsistente(entrada: {
  proyectoId: string
  proyectoNombre?: string
  modelo: ModeloUMLCanonico
  validacion: ResultadoValidacion
  aptitud: ResultadoAptitudGeneracion
  cambiosSinGuardar: boolean
  candidatoImagenPendiente: boolean
}): ContextoAsistente {
  const nombres = nombreSemanticoPorId(entrada.modelo)
  const incompleto = entrada.modelo.clases.some((clase) => clase.atributos.some((atributo) => !atributo.tipo?.trim()))
  const problemas = entrada.validacion.diagnosticos.slice(0, 8).map((diagnostico) => {
    const semantico = diagnostico.elementoId ? nombres.get(diagnostico.elementoId) : undefined
    return semantico && diagnostico.mensaje.includes(diagnostico.elementoId!)
      ? diagnostico.mensaje.replaceAll(diagnostico.elementoId!, semantico)
      : semantico ? `${semantico}: ${diagnostico.mensaje}` : diagnostico.mensaje
  })
  return {
    proyecto: { id: entrada.proyectoId, nombre: entrada.proyectoNombre?.trim() || entrada.modelo.nombre },
    area: "modelado_uml",
    elementoSeleccionado: null,
    elementosRelevantes: entrada.modelo.relaciones.slice(0, 8).map((relacion) => ({ id: relacion.id, tipo: "relacion" as const, nombre: nombres.get(relacion.id) ?? "Relación UML" })),
    resumenModelo: { clases: entrada.modelo.clases.length, relaciones: entrada.modelo.relaciones.length },
    estadoUml: { estado: !entrada.validacion.valido ? "invalido" : incompleto ? "incompleto" : "valido", problemas },
    generacion: {
      estado: entrada.aptitud.apto ? "apto" : "no_apto",
      bloqueos: entrada.aptitud.motivos.slice(0, 8),
      advertencias: entrada.aptitud.advertencias.slice(0, 8).map((advertencia) => advertencia.relacion),
    },
    cambiosSinGuardar: entrada.cambiosSinGuardar,
    candidatoImagenPendiente: entrada.candidatoImagenPendiente,
    accionesDisponibles: ["NINGUNA", "IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI", "MOSTRAR_IMAGEN_CANDIDATA"],
  }
}

export type OrientacionDeterminista = "SIN_CLASES" | "UML_INVALIDO" | "IMAGEN_PENDIENTE" | "NM_DIRECTO" | "LISTO_GENERAR" | "REVISAR_GENERACION"

export function obtenerOrientacionDeterminista(contexto: ContextoAsistente): OrientacionDeterminista {
  if (contexto.resumenModelo.clases === 0) return "SIN_CLASES"
  if (contexto.estadoUml.estado === "invalido") return "UML_INVALIDO"
  if (contexto.candidatoImagenPendiente) return "IMAGEN_PENDIENTE"
  if (contexto.generacion.bloqueos.some((motivo) => motivo.includes("N:M directo"))) return "NM_DIRECTO"
  if (contexto.generacion.estado === "apto") return "LISTO_GENERAR"
  return "REVISAR_GENERACION"
}
