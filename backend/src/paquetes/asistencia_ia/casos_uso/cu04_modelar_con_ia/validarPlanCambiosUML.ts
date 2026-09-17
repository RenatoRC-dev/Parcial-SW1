import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import type { RespuestaInterpretacionUML } from "../../compartido/contrato/PlanCambiosUML.js"
import { ErrorPlanCambiosUML, ejecutarComandosUML } from "./EjecutorComandosUML.js"

const MULTIPLICIDADES = new Set(["0..1", "1", "0..*", "1..*"])
const VISIBILIDADES = new Set(["publica", "privada"])
const TIPOS = new Set(["String", "Integer", "int", "Long", "long", "Decimal", "BigDecimal", "Double", "double", "Float", "float", "Boolean", "boolean", "Date", "LocalDate", "DateTime", "LocalDateTime", "UUID"])
const CLASE = /^[A-Z][A-Za-z0-9]*$/
const ATRIBUTO = /^[a-z][A-Za-z0-9]*$/

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

function visibilidadONull(valor: unknown): boolean {
  return valor === null || (cadena(valor) && VISIBILIDADES.has(valor))
}

export function esComandoModeloUML(valor: unknown): valor is ComandoModeloUML {
  if (!objeto(valor) || !cadena(valor.tipo)) return false
  switch (valor.tipo) {
    case "crear_clase":
      return cadena(valor.refTemporal) && cadena(valor.nombre) && typeof valor.abstracta === "boolean"
    case "renombrar_clase":
      return cadena(valor.claseId) && cadena(valor.nuevoNombre)
    case "eliminar_clase":
      return cadena(valor.claseId)
    case "agregar_atributo":
      return cadena(valor.claseRef) && cadena(valor.refTemporal) && cadena(valor.nombre) && cadena(valor.tipoDato) && visibilidadONull(valor.visibilidad)
    case "modificar_atributo":
      return cadena(valor.atributoId) && cadenaONull(valor.nuevoNombre) && cadenaONull(valor.nuevoTipo) && visibilidadONull(valor.nuevaVisibilidad)
    case "eliminar_atributo":
      return cadena(valor.atributoId)
    case "crear_relacion":
      return cadena(valor.refTemporal) && cadena(valor.claseOrigenRef) && cadena(valor.claseDestinoRef) && valor.tipoRelacion === "asociacion" && multiplicidad(valor.multiplicidadOrigen) && multiplicidad(valor.multiplicidadDestino) && cadenaONull(valor.rolOrigen) && cadenaONull(valor.rolDestino)
    case "eliminar_relacion":
      return cadena(valor.relacionId)
    case "cambiar_multiplicidad":
      return cadena(valor.relacionId) && multiplicidad(valor.multiplicidadOrigen) && multiplicidad(valor.multiplicidadDestino)
    default:
      return false
  }
}

export function esRespuestaInterpretacionUML(valor: unknown): valor is RespuestaInterpretacionUML {
  if (!objeto(valor) || !["aplicar", "aclarar", "rechazar"].includes(String(valor.resultado)) || !cadena(valor.mensaje) || !Array.isArray(valor.comandos)) return false
  if (!valor.comandos.every(esComandoModeloUML)) return false
  return valor.resultado === "aplicar" ? valor.comandos.length > 0 : valor.comandos.length === 0
}

function validarModeloResultado(modelo: ModeloUMLCanonicoIA): void {
  const errores: string[] = []
  if (modelo.clases.length === 0) errores.push("El modelo resultante debe contener al menos una clase.")
  const nombresClases = new Set<string>()
  const idsClases = new Set<string>()
  const idsAtributos = new Set<string>()
  for (const clase of modelo.clases) {
    const clave = clase.nombre.trim().toLowerCase()
    if (!CLASE.test(clase.nombre.trim())) errores.push(`Nombre de clase inválido: ${clase.nombre}.`)
    if (nombresClases.has(clave)) errores.push(`Nombre de clase duplicado: ${clase.nombre}.`)
    nombresClases.add(clave)
    if (!clase.id.trim() || idsClases.has(clase.id)) errores.push(`Id de clase inválido o duplicado: ${clase.id}.`)
    idsClases.add(clase.id)
    const nombresAtributos = new Set<string>()
    for (const atributo of clase.atributos) {
      const nombre = atributo.nombre.trim()
      const claveAtributo = nombre.toLowerCase()
      if (!ATRIBUTO.test(nombre) || nombre === "id") errores.push(`Nombre de atributo inválido: ${atributo.nombre}.`)
      if (!atributo.tipo || !TIPOS.has(atributo.tipo.trim())) errores.push(`Tipo de atributo no soportado: ${atributo.tipo ?? "sin tipo"}.`)
      if (nombresAtributos.has(claveAtributo)) errores.push(`Atributo duplicado en ${clase.nombre}: ${atributo.nombre}.`)
      nombresAtributos.add(claveAtributo)
      if (!atributo.id.trim() || idsAtributos.has(atributo.id)) errores.push(`Id de atributo inválido o duplicado: ${atributo.id}.`)
      idsAtributos.add(atributo.id)
    }
  }
  const idsRelaciones = new Set<string>()
  for (const relacion of modelo.relaciones) {
    if (!relacion.id.trim() || idsRelaciones.has(relacion.id)) errores.push(`Id de relación inválido o duplicado: ${relacion.id}.`)
    idsRelaciones.add(relacion.id)
    if (!idsClases.has(relacion.claseOrigenId) || !idsClases.has(relacion.claseDestinoId)) errores.push(`La relación ${relacion.id} tiene un extremo inexistente.`)
  }
  if (errores.length > 0) throw new ErrorPlanCambiosUML(errores.join(" "))
}

export function validarPlanCambiosUML(modelo: ModeloUMLCanonicoIA, comandos: ComandoModeloUML[]): void {
  let contador = 0
  const resultado = ejecutarComandosUML(modelo, comandos, (categoria) => `validacion-${categoria}-${++contador}`)
  validarModeloResultado(resultado)
}
