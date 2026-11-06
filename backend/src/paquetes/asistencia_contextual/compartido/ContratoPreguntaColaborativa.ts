import type { ContextoAsistente } from "./ContratoAsistenteContextual.js"
import type { ModeloUMLCanonicoIA } from "../../asistencia_ia/compartido/contrato/ComandoModeloUML.js"
import { validarSolicitudInterpretacion } from "../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ValidarSolicitudInterpretacion.js"

export interface VistaActualColaborativa {
  idioma: "es" | "en"
  modeloActual: ContextoAsistente["modeloActual"]
  estadoUml: ContextoAsistente["estadoUml"]
  generacion: ContextoAsistente["generacion"]
  cambiosSinGuardar: boolean
  candidatoImagenPendiente: boolean
}

export interface PreguntaAsistenteColaborativo {
  requestId: string
  contenido: string
  foco?: { elementoId: string }
  vistaActual?: VistaActualColaborativa
  modeloEjecucion?: ModeloUMLCanonicoIA
  revisionEditor?: number
}

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const esObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === "object" && valor !== null && !Array.isArray(valor)
const cadenasAcotadas = (valor: unknown) => Array.isArray(valor) && valor.length <= 8 && valor.every((item) => typeof item === "string" && item.length <= 500)
const cadena = (valor: unknown, maximo = 200) => typeof valor === "string" && valor.length > 0 && valor.length <= maximo
const cadenaOpcional = (valor: unknown, maximo = 200) => valor === null || (typeof valor === "string" && valor.length <= maximo)

function esAtributo(valor: unknown): boolean {
  return esObjeto(valor) && cadena(valor.nombre) && cadenaOpcional(valor.tipo) && cadenaOpcional(valor.visibilidad, 40)
}

function esOperacion(valor: unknown): boolean {
  return esObjeto(valor) && cadena(valor.nombre) && cadenaOpcional(valor.tipoRetorno)
    && Array.isArray(valor.parametros) && valor.parametros.length <= 12
    && valor.parametros.every((parametro) => esObjeto(parametro) && cadena(parametro.nombre) && cadenaOpcional(parametro.tipo))
}

function esExtremo(valor: unknown): boolean {
  return esObjeto(valor) && cadena(valor.id, 160) && cadena(valor.nombre) && cadenaOpcional(valor.multiplicidad, 40) && cadenaOpcional(valor.rol)
}

function esModeloAcotado(valor: unknown): valor is ContextoAsistente["modeloActual"] {
  if (!esObjeto(valor) || typeof valor.id !== "string" || typeof valor.nombre !== "string" || typeof valor.version !== "string" || typeof valor.truncado !== "boolean") return false
  if (!Array.isArray(valor.clases) || valor.clases.length > 50 || !valor.clases.every((clase) => esObjeto(clase)
    && cadena(clase.id, 160) && cadena(clase.nombre) && (clase.tipoClase === "normal" || clase.tipoClase === "asociativa")
    && typeof clase.abstracta === "boolean" && Array.isArray(clase.atributos) && clase.atributos.length <= 30 && clase.atributos.every(esAtributo)
    && Array.isArray(clase.operaciones) && clase.operaciones.length <= 20 && clase.operaciones.every(esOperacion))) return false
  if (!Array.isArray(valor.relaciones) || valor.relaciones.length > 80 || !valor.relaciones.every((relacion) => esObjeto(relacion)
    && cadena(relacion.id, 160) && cadenaOpcional(relacion.nombre) && cadena(relacion.tipoRelacion, 80)
    && esExtremo(relacion.origen) && esExtremo(relacion.destino))) return false
  return JSON.stringify(valor).length <= 80_000
}

export function esPreguntaAsistenteColaborativo(valor: unknown): valor is PreguntaAsistenteColaborativo {
  if (!esObjeto(valor) || typeof valor.requestId !== "string" || !PATRON_UUID.test(valor.requestId)
    || typeof valor.contenido !== "string" || !valor.contenido.trim() || valor.contenido.length > 2_000) return false
  if (valor.foco !== undefined && (!esObjeto(valor.foco) || typeof valor.foco.elementoId !== "string" || !valor.foco.elementoId || valor.foco.elementoId.length > 160)) return false
  if ((valor.modeloEjecucion === undefined) !== (valor.revisionEditor === undefined)) return false
  if (valor.modeloEjecucion !== undefined && !validarSolicitudInterpretacion({ instruccion: "validar", modelo: valor.modeloEjecucion, revision: valor.revisionEditor })) return false
  if (valor.vistaActual === undefined) return true
  const vista = valor.vistaActual
  if (!esObjeto(vista) || (vista.idioma !== "es" && vista.idioma !== "en") || !esModeloAcotado(vista.modeloActual)
    || typeof vista.cambiosSinGuardar !== "boolean" || typeof vista.candidatoImagenPendiente !== "boolean") return false
  if (!esObjeto(vista.estadoUml) || !["valido", "invalido", "incompleto"].includes(String(vista.estadoUml.estado))
    || !cadenasAcotadas(vista.estadoUml.problemas) || !cadenasAcotadas(vista.estadoUml.errores) || !cadenasAcotadas(vista.estadoUml.advertencias)) return false
  if (!esObjeto(vista.generacion) || !["apto", "no_apto"].includes(String(vista.generacion.estado))
    || !cadenasAcotadas(vista.generacion.bloqueos) || !cadenasAcotadas(vista.generacion.advertencias)) return false
  return true
}

/** Valida y copia únicamente los campos consultivos permitidos; nunca conserva autoridad adicional del cliente. */
export function leerPreguntaAsistenteColaborativo(valor: unknown): PreguntaAsistenteColaborativo | null {
  if (!esPreguntaAsistenteColaborativo(valor)) return null
  const pregunta: PreguntaAsistenteColaborativo = {
    requestId: valor.requestId,
    contenido: valor.contenido,
    ...(valor.foco ? { foco: { elementoId: valor.foco.elementoId } } : {}),
    ...(valor.modeloEjecucion && typeof valor.revisionEditor === "number" ? { modeloEjecucion: structuredClone(valor.modeloEjecucion), revisionEditor: valor.revisionEditor } : {}),
  }
  if (!valor.vistaActual) return pregunta
  const vista = valor.vistaActual
  pregunta.vistaActual = {
    idioma: vista.idioma,
    modeloActual: {
      id: vista.modeloActual.id, nombre: vista.modeloActual.nombre, version: vista.modeloActual.version, truncado: vista.modeloActual.truncado,
      clases: vista.modeloActual.clases.map((clase) => ({
        id: clase.id, nombre: clase.nombre, tipoClase: clase.tipoClase, abstracta: clase.abstracta,
        atributos: clase.atributos.map((atributo) => ({ nombre: atributo.nombre, tipo: atributo.tipo, visibilidad: atributo.visibilidad })),
        operaciones: clase.operaciones.map((operacion) => ({ nombre: operacion.nombre, tipoRetorno: operacion.tipoRetorno,
          parametros: operacion.parametros.map((parametro) => ({ nombre: parametro.nombre, tipo: parametro.tipo })) })),
      })),
      relaciones: vista.modeloActual.relaciones.map((relacion) => ({
        id: relacion.id, nombre: relacion.nombre, tipoRelacion: relacion.tipoRelacion,
        origen: { id: relacion.origen.id, nombre: relacion.origen.nombre, multiplicidad: relacion.origen.multiplicidad, rol: relacion.origen.rol },
        destino: { id: relacion.destino.id, nombre: relacion.destino.nombre, multiplicidad: relacion.destino.multiplicidad, rol: relacion.destino.rol },
      })),
    },
    estadoUml: { estado: vista.estadoUml.estado, problemas: [...vista.estadoUml.problemas], errores: [...vista.estadoUml.errores], advertencias: [...vista.estadoUml.advertencias] },
    generacion: { estado: vista.generacion.estado, bloqueos: [...vista.generacion.bloqueos], advertencias: [...vista.generacion.advertencias] },
    cambiosSinGuardar: vista.cambiosSinGuardar,
    candidatoImagenPendiente: vista.candidatoImagenPendiente,
  }
  return pregunta
}
