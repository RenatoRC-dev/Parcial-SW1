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
export type CategoriaRecomendacionContextual = "INFORMATIVO" | "OBLIGATORIO" | "RECOMENDADO" | "OPCIONAL"

export interface ContextoAsistente {
  proyecto: { id: string; nombre: string } | null
  area: "modelado_uml"
  idioma: "es" | "en"
  revisionModelo: number
  modeloActual: Record<string, unknown>
  elementoSeleccionado: Record<string, unknown> | null
  elementosRelevantes: Array<{ id: string; tipo: "clase" | "relacion"; nombre: string }>
  resumenModelo: { clases: number; relaciones: number }
  estadoUml: { estado: "valido" | "invalido" | "incompleto"; problemas: string[]; errores: string[]; advertencias: string[] }
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
  categoriaRecomendacion: CategoriaRecomendacionContextual
  origen?: "determinista" | "groq"
}

const acciones = new Set<string>(ACCIONES_ASISTENTE_CONTEXTUAL)
const estadosUml = new Set(["valido", "invalido", "incompleto"])
const niveles = new Set(["informacion", "sugerencia", "advertencia"])
const categorias = new Set(["INFORMATIVO", "OBLIGATORIO", "RECOMENDADO", "OPCIONAL"])

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function contieneIdAccionInterna(respuesta: string): boolean {
  return ACCIONES_ASISTENTE_CONTEXTUAL.some((accion) => accion !== "NINGUNA" && respuesta.includes(accion))
}

function sonCadenasAcotadas(valor: unknown, maximo: number): valor is string[] {
  return Array.isArray(valor) && valor.length <= maximo && valor.every((item) => typeof item === "string" && item.length <= 500)
}

function esResumenModeloActual(valor: unknown): valor is Record<string, unknown> {
  if (!esObjeto(valor) || typeof valor.id !== "string" || typeof valor.nombre !== "string" || typeof valor.version !== "string" || typeof valor.truncado !== "boolean") return false
  if (!Array.isArray(valor.clases) || valor.clases.length > 50 || !valor.clases.every(esObjeto)) return false
  if (!Array.isArray(valor.relaciones) || valor.relaciones.length > 80 || !valor.relaciones.every(esObjeto)) return false
  return JSON.stringify(valor).length <= 80_000
}

export function esSolicitudAsistenteContextual(valor: unknown): valor is SolicitudAsistenteContextual {
  if (!esObjeto(valor) || typeof valor.pregunta !== "string" || valor.pregunta.trim() === "" || valor.pregunta.length > 1000) return false
  if (!Array.isArray(valor.conversacion) || valor.conversacion.length > 8 || !valor.conversacion.every((mensaje) =>
    esObjeto(mensaje) && (mensaje.rol === "usuario" || mensaje.rol === "asistente") && typeof mensaje.contenido === "string" && mensaje.contenido.length <= 1000
  )) return false
  const contexto = valor.contexto
  if (!esObjeto(contexto) || contexto.area !== "modelado_uml" || (contexto.idioma !== "es" && contexto.idioma !== "en") || !Number.isInteger(contexto.revisionModelo) || !esResumenModeloActual(contexto.modeloActual) || typeof contexto.cambiosSinGuardar !== "boolean" || typeof contexto.candidatoImagenPendiente !== "boolean") return false
  if (!esObjeto(contexto.resumenModelo) || !Number.isInteger(contexto.resumenModelo.clases) || Number(contexto.resumenModelo.clases) < 0 || !Number.isInteger(contexto.resumenModelo.relaciones) || Number(contexto.resumenModelo.relaciones) < 0) return false
  if (!esObjeto(contexto.estadoUml) || typeof contexto.estadoUml.estado !== "string" || !estadosUml.has(contexto.estadoUml.estado) || !sonCadenasAcotadas(contexto.estadoUml.problemas, 8) || !sonCadenasAcotadas(contexto.estadoUml.errores, 8) || !sonCadenasAcotadas(contexto.estadoUml.advertencias, 8)) return false
  if (!esObjeto(contexto.generacion) || (contexto.generacion.estado !== "apto" && contexto.generacion.estado !== "no_apto") || !sonCadenasAcotadas(contexto.generacion.bloqueos, 8) || !sonCadenasAcotadas(contexto.generacion.advertencias, 8)) return false
  if (!Array.isArray(contexto.accionesDisponibles) || !contexto.accionesDisponibles.every((accion) => typeof accion === "string" && acciones.has(accion))) return false
  if (contexto.proyecto !== null && (!esObjeto(contexto.proyecto) || typeof contexto.proyecto.id !== "string" || typeof contexto.proyecto.nombre !== "string")) return false
  if (contexto.elementoSeleccionado !== null && (!esObjeto(contexto.elementoSeleccionado) || typeof contexto.elementoSeleccionado.id !== "string" || (contexto.elementoSeleccionado.tipo !== "clase" && contexto.elementoSeleccionado.tipo !== "relacion"))) return false
  if (!Array.isArray(contexto.elementosRelevantes) || contexto.elementosRelevantes.length > 8 || !contexto.elementosRelevantes.every((elemento) => esObjeto(elemento) && typeof elemento.id === "string" && typeof elemento.nombre === "string" && (elemento.tipo === "clase" || elemento.tipo === "relacion"))) return false
  return true
}

export function esRespuestaAsistenteContextual(valor: unknown): valor is RespuestaAsistenteContextual {
  return esObjeto(valor)
    && typeof valor.respuesta === "string"
    && valor.respuesta.trim() !== ""
    && valor.respuesta.length <= 2400
    && !contieneIdAccionInterna(valor.respuesta)
    && typeof valor.accionSugerida === "string"
    && acciones.has(valor.accionSugerida)
    && (valor.elementoRelacionadoId === null || typeof valor.elementoRelacionadoId === "string")
    && typeof valor.nivel === "string"
    && niveles.has(valor.nivel)
    && typeof valor.categoriaRecomendacion === "string"
    && categorias.has(valor.categoriaRecomendacion)
    && (valor.origen === undefined || valor.origen === "determinista" || valor.origen === "groq")
}
