import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"
import type {
  CampoSpring,
  EntidadSpring,
  ModeloProyectoSpring,
} from "./ModeloProyectoSpring.js"

export const VERSION_SPRING_BOOT = "3.5.16"

const tiposJava: Readonly<Record<string, string>> = {
  String: "String",
  Integer: "Integer",
  int: "Integer",
  Long: "Long",
  long: "Long",
  Decimal: "BigDecimal",
  BigDecimal: "BigDecimal",
  Double: "Double",
  double: "Double",
  Float: "Float",
  float: "Float",
  Boolean: "Boolean",
  boolean: "Boolean",
  Date: "LocalDate",
  LocalDate: "LocalDate",
  DateTime: "LocalDateTime",
  LocalDateTime: "LocalDateTime",
  UUID: "UUID",
}

const importacionesPorTipo: Readonly<Record<string, string>> = {
  BigDecimal: "java.math.BigDecimal",
  LocalDate: "java.time.LocalDate",
  LocalDateTime: "java.time.LocalDateTime",
  UUID: "java.util.UUID",
}

const identificadorClase = /^[A-Z][A-Za-z0-9]*$/
const identificadorCampo = /^[a-z][A-Za-z0-9]*$/
const nombresEntidadEnConflicto = new Set([
  "String", "Integer", "Long", "Double", "Float", "Boolean",
  "BigDecimal", "LocalDate", "LocalDateTime", "UUID",
])
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

export function convertirASnakeCase(nombre: string): string {
  return nombre.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

export function convertirAVariable(nombreClase: string): string {
  return nombreClase.charAt(0).toLowerCase() + nombreClase.slice(1)
}

export function mapearTipoJava(tipoCanonico: string): string {
  const tipo = tiposJava[tipoCanonico]
  if (!tipo) {
    throw new Error(`Tipo canónico no soportado para generación: ${tipoCanonico}`)
  }
  return tipo
}

function validarEntrada(modelo: ModeloUMLCanonicoEntrada): string[] {
  const errores: string[] = []
  if (modelo.clases.length === 0) errores.push("El modelo no contiene clases.")
  if (modelo.relaciones.length > 0) {
    errores.push("La generación de relaciones está diferida en Iteración 04.")
  }

  const clasesVistas = new Set<string>()
  for (const clase of modelo.clases) {
    if (!identificadorClase.test(clase.nombre)) {
      errores.push(`Nombre de clase no soportado: ${clase.nombre || "(vacío)"}.`)
    }
    if (nombresEntidadEnConflicto.has(clase.nombre)) {
      errores.push(`Nombre de clase en conflicto con un tipo Java: ${clase.nombre}.`)
    }
    const claveClase = clase.nombre.toLowerCase()
    if (clasesVistas.has(claveClase)) {
      errores.push(`Nombre de clase duplicado: ${clase.nombre}.`)
    }
    clasesVistas.add(claveClase)
    if (clase.abstracta) {
      errores.push(`La clase abstracta ${clase.nombre} no se genera en esta iteración.`)
    }

    const camposVistos = new Set<string>()
    for (const atributo of clase.atributos) {
      if (
        !identificadorCampo.test(atributo.nombre) ||
        palabrasReservadasJava.has(atributo.nombre) ||
        atributo.nombre === "id"
      ) {
        errores.push(`Nombre de atributo no soportado: ${atributo.nombre || "(vacío)"}.`)
      }
      const claveCampo = atributo.nombre.toLowerCase()
      if (camposVistos.has(claveCampo)) {
        errores.push(`Atributo duplicado en ${clase.nombre}: ${atributo.nombre}.`)
      }
      camposVistos.add(claveCampo)
      if (!atributo.tipo || !tiposJava[atributo.tipo]) {
        errores.push(
          `Tipo no soportado para ${clase.nombre}.${atributo.nombre}: ${atributo.tipo ?? "(ausente)"}.`
        )
      }
    }
  }
  return errores
}

export class ErrorModeloNoGenerable extends Error {
  constructor(public readonly errores: string[]) {
    super(`Modelo no apto para generación:\n- ${errores.join("\n- ")}`)
    this.name = "ErrorModeloNoGenerable"
  }
}

function prepararCampo(nombre: string, tipoCanonico: string): CampoSpring {
  return {
    nombreCampo: nombre,
    nombreColumna: convertirASnakeCase(nombre),
    tipoJava: mapearTipoJava(tipoCanonico),
  }
}

function prepararEntidad(
  clase: ModeloUMLCanonicoEntrada["clases"][number]
): EntidadSpring {
  const campos = clase.atributos.map((atributo) =>
    prepararCampo(atributo.nombre, atributo.tipo as string)
  )
  const importaciones = Array.from(
    new Set(
      campos
        .map((campo) => importacionesPorTipo[campo.tipoJava])
        .filter((valor): valor is string => Boolean(valor))
    )
  ).sort()

  return {
    nombreClase: clase.nombre,
    nombreVariable: convertirAVariable(clase.nombre),
    nombreTabla: convertirASnakeCase(clase.nombre),
    campos,
    importaciones,
  }
}

export function prepararProyectoSpring(
  modelo: ModeloUMLCanonicoEntrada
): ModeloProyectoSpring {
  const errores = validarEntrada(modelo)
  if (errores.length > 0) {
    throw new ErrorModeloNoGenerable(errores)
  }

  return {
    groupId: "com.sw1.generated",
    artifactId: "backend-generado",
    packageName: "com.sw1.generated",
    javaVersion: 21,
    springBootVersion: VERSION_SPRING_BOOT,
    entidades: modelo.clases.map(prepararEntidad),
  }
}
