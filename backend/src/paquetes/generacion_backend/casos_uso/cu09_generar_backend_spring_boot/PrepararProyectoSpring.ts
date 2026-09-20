import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"
import type {
  CampoSpring,
  EntidadSpring,
  ModeloProyectoSpring,
  RelacionMuchosAUnoSpring,
  RelacionUnoAMuchosSpring,
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

function validarIdentidades(modelo: ModeloUMLCanonicoEntrada): string[] {
  const errores: string[] = []
  if (modelo.id.trim() === "") errores.push("El id del modelo es obligatorio.")

  const idsClases = new Set<string>()
  const idsAtributos = new Set<string>()
  for (const clase of modelo.clases) {
    if (clase.id.trim() === "") {
      errores.push(`La clase ${clase.nombre || "(sin nombre)"} no tiene id.`)
    } else if (idsClases.has(clase.id)) {
      errores.push(`Id de clase duplicado: ${clase.id}.`)
    } else {
      idsClases.add(clase.id)
    }

    for (const atributo of clase.atributos) {
      if (atributo.id.trim() === "") {
        errores.push(`El atributo ${clase.nombre}.${atributo.nombre || "(sin nombre)"} no tiene id.`)
      } else if (idsAtributos.has(atributo.id)) {
        errores.push(`Id de atributo duplicado: ${atributo.id}.`)
      } else {
        idsAtributos.add(atributo.id)
      }
    }
  }

  const idsRelaciones = new Set<string>()
  for (const relacion of modelo.relaciones) {
    if (relacion.id.trim() === "") {
      errores.push("Una relación no tiene id.")
    } else if (idsRelaciones.has(relacion.id)) {
      errores.push(`Id de relación duplicado: ${relacion.id}.`)
    } else {
      idsRelaciones.add(relacion.id)
    }
  }
  return errores
}

function validarEntradaBasica(modelo: ModeloUMLCanonicoEntrada): string[] {
  const errores: string[] = []
  if (modelo.clases.length === 0) errores.push("El modelo no contiene clases.")

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
      if (atributo.nombre === "id" && atributo.tipo !== "Long") {
        errores.push("El identificador explícito `id` debe utilizar el tipo Long.")
      } else if (
        !identificadorCampo.test(atributo.nombre) ||
        palabrasReservadasJava.has(atributo.nombre)
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

interface RelacionUnoAMuchosPreparada {
  claseUnoId: string
  claseMuchosId: string
  muchosAUno: RelacionMuchosAUnoSpring
  unoAMuchos: RelacionUnoAMuchosSpring
}

function nombreDeRol(rol: string | undefined, nombrePredeterminado: string): string {
  return rol === undefined ? nombrePredeterminado : rol.trim()
}

export function prepararRelacionUnoAMuchos(
  relacion: ModeloUMLCanonicoEntrada["relaciones"][number],
  clasesPorId: ReadonlyMap<string, ModeloUMLCanonicoEntrada["clases"][number]>
): RelacionUnoAMuchosPreparada {
  if (relacion.tipo !== "asociacion") {
    throw new Error(`La relación ${relacion.id} de tipo ${relacion.tipo} no está soportada.`)
  }
  if (relacion.claseOrigenId === relacion.claseDestinoId) {
    throw new Error(`La relación ${relacion.id} es autorreferente y todavía no está soportada.`)
  }

  const claseOrigen = clasesPorId.get(relacion.claseOrigenId)
  const claseDestino = clasesPorId.get(relacion.claseDestinoId)
  if (!claseOrigen || !claseDestino) {
    throw new Error(`La relación ${relacion.id} referencia una clase inexistente.`)
  }

  const origenEsUno = relacion.multiplicidadOrigen === "1" && relacion.multiplicidadDestino === "0..*"
  const destinoEsUno = relacion.multiplicidadOrigen === "0..*" && relacion.multiplicidadDestino === "1"
  if (!origenEsUno && !destinoEsUno) {
    throw new Error(`La relación ${relacion.id} debe ser una asociación con multiplicidades 1 y 0..*.`)
  }

  const claseUno = origenEsUno ? claseOrigen : claseDestino
  const claseMuchos = origenEsUno ? claseDestino : claseOrigen
  const rolEnExtremoUno = origenEsUno ? relacion.rolOrigen : relacion.rolDestino
  const rolEnExtremoMuchos = origenEsUno ? relacion.rolDestino : relacion.rolOrigen
  const campoMuchosAUno = nombreDeRol(rolEnExtremoUno, convertirAVariable(claseUno.nombre))
  const campoUnoAMuchos = nombreDeRol(
    rolEnExtremoMuchos,
    `${convertirAVariable(claseMuchos.nombre)}s`
  )

  for (const [campo, descripcion] of [
    [campoMuchosAUno, "muchos-a-uno"],
    [campoUnoAMuchos, "uno-a-muchos"],
  ] as const) {
    if (!identificadorCampo.test(campo) || palabrasReservadasJava.has(campo) || campo === "id") {
      throw new Error(`El campo de relación ${descripcion} "${campo}" no es un identificador Java soportado.`)
    }
  }

  return {
    claseUnoId: claseUno.id,
    claseMuchosId: claseMuchos.id,
    muchosAUno: {
      nombreCampo: campoMuchosAUno,
      entidadObjetivo: claseUno.nombre,
      nombreColumna: `${convertirASnakeCase(campoMuchosAUno)}_id`,
    },
    unoAMuchos: {
      nombreCampo: campoUnoAMuchos,
      entidadObjetivo: claseMuchos.nombre,
      mappedBy: campoMuchosAUno,
    },
  }
}

function prepararRelaciones(
  modelo: ModeloUMLCanonicoEntrada,
  errores: string[]
): RelacionUnoAMuchosPreparada[] {
  const clasesPorId = new Map(modelo.clases.map((clase) => [clase.id, clase]))
  const camposPorClase = new Map(
    modelo.clases.map((clase) => [
      clase.id,
      new Set(["id", ...clase.atributos.map((atributo) => atributo.nombre.toLowerCase())]),
    ])
  )
  const preparadas: RelacionUnoAMuchosPreparada[] = []

  for (const relacion of modelo.relaciones) {
    try {
      const preparada = prepararRelacionUnoAMuchos(relacion, clasesPorId)
      const camposMuchos = camposPorClase.get(preparada.claseMuchosId)!
      const camposUno = camposPorClase.get(preparada.claseUnoId)!
      const campoMuchos = preparada.muchosAUno.nombreCampo.toLowerCase()
      const campoUno = preparada.unoAMuchos.nombreCampo.toLowerCase()
      if (camposMuchos.has(campoMuchos)) {
        errores.push(`El campo de relación ${preparada.muchosAUno.nombreCampo} colisiona en ${clasesPorId.get(preparada.claseMuchosId)!.nombre}.`)
      }
      if (camposUno.has(campoUno)) {
        errores.push(`El campo de relación ${preparada.unoAMuchos.nombreCampo} colisiona en ${clasesPorId.get(preparada.claseUnoId)!.nombre}.`)
      }
      if (!camposMuchos.has(campoMuchos) && !camposUno.has(campoUno)) {
        camposMuchos.add(campoMuchos)
        camposUno.add(campoUno)
        preparadas.push(preparada)
      }
    } catch (error) {
      errores.push(error instanceof Error ? error.message : `Relación ${relacion.id} no soportada.`)
    }
  }
  return preparadas
}

function prepararEntidad(
  clase: ModeloUMLCanonicoEntrada["clases"][number]
): EntidadSpring {
  const campos = clase.atributos.filter((atributo) => atributo.nombre !== "id").map((atributo) =>
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
    relacionesMuchosAUno: [],
    relacionesUnoAMuchos: [],
    importaciones,
  }
}

export function prepararProyectoSpring(
  modelo: ModeloUMLCanonicoEntrada
): ModeloProyectoSpring {
  const clasesAsociativas = modelo.clases.filter((clase) => clase.tipoClase === "asociativa")
  if (clasesAsociativas.length > 0) {
    throw new ErrorModeloNoGenerable(clasesAsociativas.map((clase) =>
      `Clase asociativa detectada (${clase.nombre}); la generación de clave compuesta todavía no forma parte del perfil actual.`
    ))
  }
  const erroresIdentidad = validarIdentidades(modelo)
  if (erroresIdentidad.length > 0) {
    throw new ErrorModeloNoGenerable(erroresIdentidad)
  }

  const errores = validarEntradaBasica(modelo)
  const relaciones = prepararRelaciones(modelo, errores)
  if (errores.length > 0) {
    throw new ErrorModeloNoGenerable(errores)
  }

  const entidades = modelo.clases.map(prepararEntidad)
  const entidadesPorId = new Map(
    modelo.clases.map((clase, indice) => [clase.id, entidades[indice]])
  )
  for (const relacion of relaciones) {
    const entidadUno = entidadesPorId.get(relacion.claseUnoId)!
    const entidadMuchos = entidadesPorId.get(relacion.claseMuchosId)!
    entidadMuchos.relacionesMuchosAUno.push(relacion.muchosAUno)
    entidadUno.relacionesUnoAMuchos.push(relacion.unoAMuchos)
  }
  for (const entidad of entidades) {
    if (entidad.relacionesMuchosAUno.length > 0) {
      entidad.importaciones.push("jakarta.persistence.JoinColumn", "jakarta.persistence.ManyToOne")
    }
    if (entidad.relacionesUnoAMuchos.length > 0) {
      entidad.importaciones.push(
        "com.fasterxml.jackson.annotation.JsonIgnore",
        "jakarta.persistence.OneToMany",
        "java.util.ArrayList",
        "java.util.List"
      )
    }
    entidad.importaciones = Array.from(new Set(entidad.importaciones)).sort()
  }

  return {
    groupId: "com.sw1.generated",
    artifactId: "backend-generado",
    packageName: "com.sw1.generated",
    javaVersion: 21,
    springBootVersion: VERSION_SPRING_BOOT,
    entidades,
  }
}
