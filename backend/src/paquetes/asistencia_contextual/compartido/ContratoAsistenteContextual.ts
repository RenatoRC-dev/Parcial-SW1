export const ACCIONES_ASISTENTE_CONTEXTUAL = [
  "NINGUNA",
  "ENFOCAR_ELEMENTO",
  "IR_A_VALIDACION",
  "IR_A_GENERACION",
  "IR_A_XMI",
  "MOSTRAR_IMAGEN_CANDIDATA",
] as const

export type AccionAsistenteContextual = typeof ACCIONES_ASISTENTE_CONTEXTUAL[number]
export type NivelRespuestaContextual = "informacion" | "sugerencia" | "advertencia"

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

export interface MensajeConversacionContextual {
  rol: "usuario" | "asistente"
  contenido: string
}

export interface SolicitudAsistenteContextual {
  pregunta: string
  contexto: ContextoAsistente
  conversacion: MensajeConversacionContextual[]
}

export interface RespuestaAsistenteContextual {
  respuesta: string
  accionSugerida: AccionAsistenteContextual
  elementoRelacionadoId: string | null
  nivel: NivelRespuestaContextual
}

const acciones = new Set<string>(ACCIONES_ASISTENTE_CONTEXTUAL)
const estadosUml = new Set(["valido", "invalido", "incompleto"])
const niveles = new Set(["informacion", "sugerencia", "advertencia"])

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function sonCadenasAcotadas(valor: unknown, maximo: number): valor is string[] {
  return Array.isArray(valor) && valor.length <= maximo && valor.every((item) => typeof item === "string" && item.length <= 500)
}

export function esSolicitudAsistenteContextual(valor: unknown): valor is SolicitudAsistenteContextual {
  if (!esObjeto(valor) || typeof valor.pregunta !== "string" || valor.pregunta.trim() === "" || valor.pregunta.length > 1000) return false
  if (!Array.isArray(valor.conversacion) || valor.conversacion.length > 8 || !valor.conversacion.every((mensaje) =>
    esObjeto(mensaje) && (mensaje.rol === "usuario" || mensaje.rol === "asistente") && typeof mensaje.contenido === "string" && mensaje.contenido.length <= 1000
  )) return false
  const contexto = valor.contexto
  if (!esObjeto(contexto) || contexto.area !== "modelado_uml" || typeof contexto.cambiosSinGuardar !== "boolean" || typeof contexto.candidatoImagenPendiente !== "boolean") return false
  if (!esObjeto(contexto.resumenModelo) || !Number.isInteger(contexto.resumenModelo.clases) || Number(contexto.resumenModelo.clases) < 0 || !Number.isInteger(contexto.resumenModelo.relaciones) || Number(contexto.resumenModelo.relaciones) < 0) return false
  if (!esObjeto(contexto.estadoUml) || typeof contexto.estadoUml.estado !== "string" || !estadosUml.has(contexto.estadoUml.estado) || !sonCadenasAcotadas(contexto.estadoUml.problemas, 8)) return false
  if (!esObjeto(contexto.generacion) || (contexto.generacion.estado !== "apto" && contexto.generacion.estado !== "no_apto") || !sonCadenasAcotadas(contexto.generacion.bloqueos, 8) || !sonCadenasAcotadas(contexto.generacion.advertencias, 8)) return false
  if (!Array.isArray(contexto.accionesDisponibles) || !contexto.accionesDisponibles.every((accion) => typeof accion === "string" && acciones.has(accion))) return false
  if (contexto.proyecto !== null && (!esObjeto(contexto.proyecto) || typeof contexto.proyecto.id !== "string" || typeof contexto.proyecto.nombre !== "string")) return false
  if (contexto.elementoSeleccionado !== null && (!esObjeto(contexto.elementoSeleccionado) || typeof contexto.elementoSeleccionado.id !== "string" || typeof contexto.elementoSeleccionado.nombre !== "string" || (contexto.elementoSeleccionado.tipo !== "clase" && contexto.elementoSeleccionado.tipo !== "relacion"))) return false
  if (!Array.isArray(contexto.elementosRelevantes) || contexto.elementosRelevantes.length > 8 || !contexto.elementosRelevantes.every((elemento) => esObjeto(elemento) && typeof elemento.id === "string" && typeof elemento.nombre === "string" && (elemento.tipo === "clase" || elemento.tipo === "relacion"))) return false
  return true
}

export function esRespuestaAsistenteContextual(valor: unknown): valor is RespuestaAsistenteContextual {
  return esObjeto(valor)
    && typeof valor.respuesta === "string"
    && valor.respuesta.trim() !== ""
    && typeof valor.accionSugerida === "string"
    && acciones.has(valor.accionSugerida)
    && (valor.elementoRelacionadoId === null || typeof valor.elementoRelacionadoId === "string")
    && typeof valor.nivel === "string"
    && niveles.has(valor.nivel)
}
