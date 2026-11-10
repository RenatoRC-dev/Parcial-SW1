import { TIPOS_UML_SOPORTADOS_IA, type ComandoModeloUML, type ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import type { RespuestaInterpretacionUML } from "../../compartido/contrato/PlanCambiosUML.js"
import { ErrorPlanCambiosUML, ejecutarComandosUML } from "./EjecutorComandosUML.js"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"

const MULTIPLICIDADES = new Set(["0..1", "1", "0..*", "1..*"])
const VISIBILIDADES_ATRIBUTO = new Set(["publica", "privada", "protegida", "paquete"])
const VISIBILIDADES_METODO = new Set(["publica", "privada"])
const TIPOS = new Set<string>(TIPOS_UML_SOPORTADOS_IA)

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function cadena(valor: unknown): valor is string {
  return typeof valor === "string"
}

function cadenaONull(valor: unknown): valor is string | null {
  return valor === null || cadena(valor)
}

function multiplicidad(valor: unknown): boolean {
  return cadena(valor) && MULTIPLICIDADES.has(valor)
}

function multiplicidadONull(valor: unknown): boolean {
  return valor === null || multiplicidad(valor)
}

function visibilidadAtributoONull(valor: unknown): boolean {
  return valor === null || (cadena(valor) && VISIBILIDADES_ATRIBUTO.has(valor))
}

function visibilidadMetodoONull(valor: unknown): boolean {
  return valor === null || (cadena(valor) && VISIBILIDADES_METODO.has(valor))
}

function parametroNuevo(valor: unknown): boolean {
  return objeto(valor) && cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.tipo)
}

export function esComandoModeloUML(valor: unknown): valor is ComandoModeloUML {
  if (!objeto(valor) || !cadena(valor.tipo)) return false
  switch (valor.tipo) {
    case "crear_clase":
      return cadena(valor.refTemporal) && cadena(valor.nombre) && typeof valor.abstracta === "boolean"
    case "crear_clase_asociativa":
      return cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.claseARef) && cadena(valor.claseBRef)
    case "convertir_relacion_en_clase_asociativa":
      return cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.relacionId)
    case "renombrar_clase":
      return cadena(valor.claseId) && cadena(valor.nuevoNombre)
    case "eliminar_clase":
      return cadena(valor.claseId)
    case "agregar_atributo":
      return cadena(valor.claseRef) && cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.tipoDato) && visibilidadAtributoONull(valor.visibilidad)
    case "modificar_atributo":
      return cadena(valor.atributoId) && cadenaONull(valor.nuevoNombre) && cadenaONull(valor.nuevoTipo) && visibilidadAtributoONull(valor.nuevaVisibilidad)
    case "eliminar_atributo":
      return cadena(valor.atributoId)
    case "crear_metodo":
      return cadena(valor.claseRef) && cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.tipoRetorno) && cadena(valor.visibilidad) && VISIBILIDADES_METODO.has(valor.visibilidad) && Array.isArray(valor.parametros) && valor.parametros.every(parametroNuevo)
    case "modificar_metodo":
      return cadena(valor.metodoId) && cadenaONull(valor.nuevoNombre) && cadenaONull(valor.nuevoTipoRetorno) && visibilidadMetodoONull(valor.nuevaVisibilidad)
    case "eliminar_metodo":
      return cadena(valor.metodoId)
    case "agregar_parametro":
      return cadena(valor.metodoId) && cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.tipoDato)
    case "modificar_parametro":
      return cadena(valor.parametroId) && cadenaONull(valor.nuevoNombre) && cadenaONull(valor.nuevoTipo)
    case "eliminar_parametro":
      return cadena(valor.parametroId)
    case "crear_relacion":
      if (!cadena(valor.refTemporal)) return false
      if (valor.tipoRelacion === "asociacion") {
        return cadena(valor.claseOrigenRef) && cadena(valor.claseDestinoRef) && multiplicidadONull(valor.cantidadDestinoPorOrigen) && multiplicidadONull(valor.cantidadOrigenPorDestino) && cadenaONull(valor.rolOrigen) && cadenaONull(valor.rolDestino)
      }
      if (valor.tipoRelacion === "agregacion" || valor.tipoRelacion === "composicion") {
        return cadena(valor.parteRef) && cadena(valor.todoRef) && multiplicidadONull(valor.cantidadPartesPorTodo) && multiplicidadONull(valor.cantidadTodosPorParte) && cadenaONull(valor.rolParte) && cadenaONull(valor.rolTodo)
      }
      return valor.tipoRelacion === "generalizacion" && cadena(valor.subclaseRef) && cadena(valor.superclaseRef)
    case "eliminar_relacion":
      return cadena(valor.relacionId)
    case "cambiar_multiplicidad":
      return cadena(valor.relacionId) && multiplicidad(valor.cantidadDestinoPorOrigen) && multiplicidad(valor.cantidadOrigenPorDestino)
    default:
      return false
  }
}

export function esRespuestaInterpretacionUML(valor: unknown): valor is RespuestaInterpretacionUML {
  if (!objeto(valor) || !["aplicar", "aclarar", "rechazar"].includes(String(valor.resultado)) || !cadena(valor.mensaje) || !Array.isArray(valor.comandos)) return false
  if (!valor.comandos.every(esComandoModeloUML)) return false
  return valor.resultado === "aplicar" ? valor.comandos.length > 0 : valor.comandos.length === 0
}

export function validarPlanCambiosUML(modelo: ModeloUMLCanonicoIA, comandos: ComandoModeloUML[]): void {
  // El canal IA sigue acotado; los tipos conceptuales existentes no son errores UML.
  for (const comando of comandos) {
    const tipoNuevo = comando.tipo === "agregar_atributo" ? comando.tipoDato
      : comando.tipo === "modificar_atributo" ? comando.nuevoTipo : null
    if (tipoNuevo !== null && !TIPOS.has(tipoNuevo.trim())) throw new ErrorPlanCambiosUML(`Tipo de atributo no soportado por CU04: ${tipoNuevo}.`)
  }
  let contador = 0
  const resultado = ejecutarComandosUML(modelo, comandos, (categoria) => `validacion-${categoria}-${++contador}`)
  const validacion = validarModelo(resultado)
  if (!validacion.valido) throw new ErrorPlanCambiosUML(validacion.diagnosticos.filter((item) => item.severidad === "error").map((item) => item.mensaje).join(" "))
}
