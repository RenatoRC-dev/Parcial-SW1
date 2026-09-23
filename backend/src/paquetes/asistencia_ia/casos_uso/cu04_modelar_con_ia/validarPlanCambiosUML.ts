import { TIPOS_UML_SOPORTADOS_IA, type ComandoModeloUML, type ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import type { RespuestaInterpretacionUML } from "../../compartido/contrato/PlanCambiosUML.js"
import { ErrorPlanCambiosUML, ejecutarComandosUML } from "./EjecutorComandosUML.js"

const MULTIPLICIDADES = new Set(["0..1", "1", "0..*", "1..*"])
const VISIBILIDADES_ATRIBUTO = new Set(["publica", "privada", "protegida", "paquete"])
const VISIBILIDADES_METODO = new Set(["publica", "privada"])
const TIPOS = new Set<string>(TIPOS_UML_SOPORTADOS_IA)
const TIPOS_RETORNO = new Set<string>([...TIPOS_UML_SOPORTADOS_IA, "void"])
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

function validarModeloResultado(modelo: ModeloUMLCanonicoIA): void {
  const errores: string[] = []
  if (modelo.clases.length === 0) errores.push("El modelo resultante debe contener al menos una clase.")
  const nombresClases = new Set<string>()
  const idsClases = new Set<string>()
  const idsAtributos = new Set<string>()
  const idsMetodos = new Set<string>()
  for (const clase of modelo.clases) {
    if (clase.tipoClase !== undefined && clase.tipoClase !== "normal" && clase.tipoClase !== "asociativa") errores.push(`Tipo de clase no soportado: ${String(clase.tipoClase)}.`)
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
      if (!ATRIBUTO.test(nombre)) errores.push(`Nombre de atributo inválido: ${atributo.nombre}.`)
      if (!atributo.tipo || !TIPOS.has(atributo.tipo.trim())) errores.push(`Tipo de atributo no soportado: ${atributo.tipo ?? "sin tipo"}.`)
      if (nombre === "id" && atributo.tipo?.trim() !== "Long") errores.push("El identificador explícito id debe utilizar el tipo Long.")
      if (nombresAtributos.has(claveAtributo)) errores.push(`Atributo duplicado en ${clase.nombre}: ${atributo.nombre}.`)
      nombresAtributos.add(claveAtributo)
      if (!atributo.id.trim() || idsAtributos.has(atributo.id)) errores.push(`Id de atributo inválido o duplicado: ${atributo.id}.`)
      idsAtributos.add(atributo.id)
    }
    const firmas = new Set<string>()
    for (const metodo of clase.metodos ?? []) {
      if (!metodo.id.trim() || idsMetodos.has(metodo.id)) errores.push(`Id de método inválido o duplicado: ${metodo.id}.`)
      idsMetodos.add(metodo.id)
      if (metodo.nombre.trim() === "") errores.push("El método debe tener un nombre.")
      if (!VISIBILIDADES_METODO.has(metodo.visibilidad)) errores.push(`Visibilidad de método no soportada: ${metodo.visibilidad}.`)
      if (!TIPOS_RETORNO.has(metodo.tipoRetorno.trim())) errores.push(`Tipo de retorno no soportado: ${metodo.tipoRetorno}.`)
      const firma = `${metodo.nombre.trim().toLowerCase()}(${metodo.parametros.map((parametro) => parametro.tipo.trim()).join(",")})`
      if (firmas.has(firma)) errores.push(`Firma de método duplicada en ${clase.nombre}: ${metodo.nombre}.`)
      firmas.add(firma)
      const idsParametros = new Set<string>()
      const nombresParametros = new Set<string>()
      for (const parametro of metodo.parametros) {
        const nombreParametro = parametro.nombre.trim()
        if (!parametro.id.trim() || idsParametros.has(parametro.id)) errores.push(`Id de parámetro inválido o duplicado: ${parametro.id}.`)
        idsParametros.add(parametro.id)
        if (nombreParametro === "" || nombresParametros.has(nombreParametro.toLowerCase())) errores.push(`Nombre de parámetro inválido o duplicado: ${parametro.nombre}.`)
        nombresParametros.add(nombreParametro.toLowerCase())
        if (!TIPOS.has(parametro.tipo.trim())) errores.push(`Tipo de parámetro no soportado: ${parametro.tipo}.`)
      }
    }
  }
  const idsRelaciones = new Set<string>()
  for (const relacion of modelo.relaciones) {
    if (!relacion.id.trim() || idsRelaciones.has(relacion.id)) errores.push(`Id de relación inválido o duplicado: ${relacion.id}.`)
    idsRelaciones.add(relacion.id)
    if (!idsClases.has(relacion.claseOrigenId) || !idsClases.has(relacion.claseDestinoId)) errores.push(`La relación ${relacion.id} tiene un extremo inexistente.`)
    if (relacion.claseOrigenId === relacion.claseDestinoId) errores.push(`La relación ${relacion.id} debe conectar dos clases diferentes.`)
    if (relacion.tipo === "generalizacion" && (relacion.multiplicidadOrigen !== null || relacion.multiplicidadDestino !== null || relacion.rolOrigen !== undefined || relacion.rolDestino !== undefined)) {
      errores.push(`La generalización ${relacion.id} no admite multiplicidades ni roles de asociación.`)
    }
  }
  if (errores.length > 0) throw new ErrorPlanCambiosUML(errores.join(" "))
}

export function validarPlanCambiosUML(modelo: ModeloUMLCanonicoIA, comandos: ComandoModeloUML[]): void {
  let contador = 0
  const resultado = ejecutarComandosUML(modelo, comandos, (categoria) => `validacion-${categoria}-${++contador}`)
  validarModeloResultado(resultado)
}
