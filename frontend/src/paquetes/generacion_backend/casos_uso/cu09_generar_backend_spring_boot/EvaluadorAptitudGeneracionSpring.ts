import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { TIPOS_GENERACION_SOPORTADOS, type ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"

export interface ResultadoAptitudGeneracion {
  apto: boolean
  motivos: string[]
}

const nombresEnConflicto = new Set([
  "String", "Integer", "Long", "Double", "Float", "Boolean",
  "BigDecimal", "LocalDate", "LocalDateTime", "UUID",
])
const identificadorCampo = /^[a-z][A-Za-z0-9]*$/
const palabrasReservadasJava = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch",
  "char", "class", "const", "continue", "default", "do", "double",
  "else", "enum", "extends", "final", "finally", "float", "for",
  "goto", "if", "implements", "import", "instanceof", "int", "interface",
  "long", "native", "new", "package", "private", "protected", "public",
  "return", "short", "static", "strictfp", "super", "switch",
  "synchronized", "this", "throw", "throws", "transient", "try", "void",
  "volatile", "while",
])
const tiposSoportados = new Set<string>(TIPOS_GENERACION_SOPORTADOS)

function resumir(referencias: string[]): string {
  const visibles = referencias.slice(0, 5).join(", ")
  return referencias.length > 5 ? `${visibles} y ${referencias.length - 5} más` : visibles
}

function convertirAVariable(nombreClase: string): string {
  return nombreClase.charAt(0).toLowerCase() + nombreClase.slice(1)
}

export function evaluarAptitudGeneracionSpring(
  modelo: ModeloUMLCanonico,
  validacion: ResultadoValidacion
): ResultadoAptitudGeneracion {
  const motivos: string[] = []
  if (!validacion.valido) motivos.push("El modelo contiene errores de validación UML.")

  for (const clase of modelo.clases) {
    if (clase.tipoClase === "asociativa") {
      motivos.push(`Clase asociativa detectada (${clase.nombre}); la generación de clave compuesta todavía no forma parte del perfil actual.`)
    }
    if (clase.abstracta) motivos.push(`La clase abstracta ${clase.nombre} no puede generarse todavía.`)
    if (nombresEnConflicto.has(clase.nombre.trim())) {
      motivos.push(`El nombre de entidad ${clase.nombre} entra en conflicto con un tipo Java.`)
    }
  }

  const atributosSinTipo: string[] = []
  const atributosTipoNoSoportado: string[] = []
  const identificadoresExplicitosInvalidos: string[] = []
  for (const clase of modelo.clases) {
    for (const atributo of clase.atributos) {
      const referencia = `${clase.nombre}.${atributo.nombre}`
      const tipo = atributo.tipo?.trim()
      if (!tipo) atributosSinTipo.push(referencia)
      else if (!tiposSoportados.has(tipo)) atributosTipoNoSoportado.push(`${referencia} (${tipo})`)
      if (atributo.nombre.trim() === "id" && tipo !== "Long") identificadoresExplicitosInvalidos.push(referencia)
    }
  }
  if (atributosSinTipo.length > 0) motivos.push(`${atributosSinTipo.length} atributos no tienen tipo para generar: ${resumir(atributosSinTipo)}.`)
  if (atributosTipoNoSoportado.length > 0) motivos.push(`${atributosTipoNoSoportado.length} atributos usan tipos no soportados para generar: ${resumir(atributosTipoNoSoportado)}.`)
  if (identificadoresExplicitosInvalidos.length > 0) motivos.push(`El identificador explícito id debe usar Long: ${resumir(identificadoresExplicitosInvalidos)}.`)

  const clasesPorId = new Map(modelo.clases.map((clase) => [clase.id, clase]))
  const camposPorClase = new Map(
    modelo.clases.map((clase) => [
      clase.id,
      new Set(["id", ...clase.atributos.map((atributo) => atributo.nombre.toLowerCase())]),
    ])
  )
  for (const relacion of modelo.relaciones) {
    if (relacion.tipo !== "asociacion") {
      motivos.push(`La relación ${relacion.id} de tipo ${relacion.tipo} no está soportada.`)
      continue
    }
    if (relacion.claseOrigenId === relacion.claseDestinoId) {
      motivos.push(`La relación ${relacion.id} es autorreferente y todavía no está soportada.`)
      continue
    }
    const origen = clasesPorId.get(relacion.claseOrigenId)
    const destino = clasesPorId.get(relacion.claseDestinoId)
    if (!origen || !destino) continue

    const origenEsUno = relacion.multiplicidadOrigen === "1" && relacion.multiplicidadDestino === "0..*"
    const destinoEsUno = relacion.multiplicidadOrigen === "0..*" && relacion.multiplicidadDestino === "1"
    if (!origenEsUno && !destinoEsUno) {
      motivos.push(`La relación ${relacion.id} debe ser una asociación con multiplicidades 1 y 0..*.`)
      continue
    }

    const claseUno = origenEsUno ? origen : destino
    const claseMuchos = origenEsUno ? destino : origen
    const rolUno = origenEsUno ? relacion.rolOrigen : relacion.rolDestino
    const rolMuchos = origenEsUno ? relacion.rolDestino : relacion.rolOrigen
    const campoMuchosAUno = rolUno === undefined ? convertirAVariable(claseUno.nombre) : rolUno.trim()
    const campoUnoAMuchos = rolMuchos === undefined ? `${convertirAVariable(claseMuchos.nombre)}s` : rolMuchos.trim()
    const campos = [
      { nombre: campoMuchosAUno, clase: claseMuchos },
      { nombre: campoUnoAMuchos, clase: claseUno },
    ]
    let camposValidos = true
    for (const campo of campos) {
      if (!identificadorCampo.test(campo.nombre) || palabrasReservadasJava.has(campo.nombre) || campo.nombre === "id") {
        motivos.push(`El campo de relación "${campo.nombre}" no es un identificador Java soportado.`)
        camposValidos = false
      } else if (camposPorClase.get(campo.clase.id)!.has(campo.nombre.toLowerCase())) {
        motivos.push(`El campo de relación ${campo.nombre} colisiona en ${campo.clase.nombre}.`)
        camposValidos = false
      }
    }
    if (camposValidos) {
      camposPorClase.get(claseMuchos.id)!.add(campoMuchosAUno.toLowerCase())
      camposPorClase.get(claseUno.id)!.add(campoUnoAMuchos.toLowerCase())
    }
  }

  return { apto: motivos.length === 0, motivos }
}
