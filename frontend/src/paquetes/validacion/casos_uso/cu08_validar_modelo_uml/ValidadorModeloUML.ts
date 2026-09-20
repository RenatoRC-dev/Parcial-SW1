import type {
  AtributoUML,
  ClaseUML,
  MetodoUML,
  ModeloUMLCanonico,
} from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export type SeveridadDiagnostico = "error" | "advertencia"

export type TipoElementoDiagnostico =
  | "modelo"
  | "clase"
  | "atributo"
  | "metodo"
  | "parametro"
  | "relacion"

export interface DiagnosticoValidacion {
  codigo: string
  severidad: SeveridadDiagnostico
  mensaje: string
  elementoTipo?: TipoElementoDiagnostico
  elementoId?: string
}

export interface ResultadoValidacion {
  valido: boolean
  diagnosticos: DiagnosticoValidacion[]
}

export const TIPOS_GENERACION_SOPORTADOS = [
  "String",
  "Integer",
  "int",
  "Long",
  "long",
  "Decimal",
  "BigDecimal",
  "Double",
  "double",
  "Float",
  "float",
  "Boolean",
  "boolean",
  "Date",
  "LocalDate",
  "DateTime",
  "LocalDateTime",
  "UUID",
] as const
export const TIPOS_RETORNO_METODO = [...TIPOS_GENERACION_SOPORTADOS, "void"] as const

const tiposSoportados = new Set<string>(TIPOS_GENERACION_SOPORTADOS)
const tiposRetornoSoportados = new Set<string>(TIPOS_RETORNO_METODO)
const identificadorClase = /^[A-Z][A-Za-z0-9]*$/
const identificadorAtributo = /^[a-z][A-Za-z0-9]*$/
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

function crearDiagnostico(
  codigo: string,
  severidad: SeveridadDiagnostico,
  mensaje: string,
  elementoTipo: TipoElementoDiagnostico,
  elementoId?: string
): DiagnosticoValidacion {
  return { codigo, severidad, mensaje, elementoTipo, elementoId }
}

function claveNombre(nombre: string): string {
  return nombre.trim().toLowerCase()
}

function validarAtributo(
  atributo: AtributoUML,
  diagnosticos: DiagnosticoValidacion[]
) {
  const nombre = atributo.nombre.trim()
  if (nombre === "") {
    diagnosticos.push(
      crearDiagnostico(
        "ATRIBUTO_NOMBRE_REQUERIDO",
        "error",
        "El atributo debe tener un nombre.",
        "atributo",
        atributo.id
      )
    )
  } else if (
    !identificadorAtributo.test(nombre) ||
    palabrasReservadasJava.has(nombre)
  ) {
    diagnosticos.push(
      crearDiagnostico(
        "ATRIBUTO_IDENTIFICADOR_INVALIDO",
        "error",
        `El nombre de atributo "${atributo.nombre}" no es un identificador Java de campo soportado.`,
        "atributo",
        atributo.id
      )
    )
  }

}

function resumirReferencias(referencias: string[]): string {
  const visibles = referencias.slice(0, 5).join(", ")
  const restantes = referencias.length - 5
  return restantes > 0 ? `${visibles} y ${restantes} más` : visibles
}

function validarClase(
  clase: ClaseUML,
  diagnosticos: DiagnosticoValidacion[]
) {
  if (clase.tipoClase !== undefined && clase.tipoClase !== "normal" && clase.tipoClase !== "asociativa") {
    diagnosticos.push(crearDiagnostico(
      "CLASE_TIPO_INVALIDO", "error", "El tipo de clase no está soportado.", "clase", clase.id
    ))
  }
  const nombre = clase.nombre.trim()
  if (nombre === "") {
    diagnosticos.push(
      crearDiagnostico(
        "CLASE_NOMBRE_REQUERIDO",
        "error",
        "La clase debe tener un nombre.",
        "clase",
        clase.id
      )
    )
  } else if (!identificadorClase.test(nombre)) {
    diagnosticos.push(
      crearDiagnostico(
        "CLASE_IDENTIFICADOR_INVALIDO",
        "error",
        `El nombre de clase "${clase.nombre}" no es un identificador Java de clase soportado.`,
        "clase",
        clase.id
      )
    )
  }

  const nombresAtributos = new Set<string>()
  for (const atributo of clase.atributos) {
    validarAtributo(atributo, diagnosticos)
    const clave = claveNombre(atributo.nombre)
    if (clave !== "" && nombresAtributos.has(clave)) {
      diagnosticos.push(
        crearDiagnostico(
          "ATRIBUTO_NOMBRE_DUPLICADO",
          "error",
          `La clase "${clase.nombre}" contiene atributos duplicados para el campo "${atributo.nombre}".`,
          "atributo",
          atributo.id
        )
      )
    }
    if (clave !== "") nombresAtributos.add(clave)
  }

  const firmas = new Set<string>()
  for (const metodo of clase.metodos ?? []) {
    validarMetodo(metodo, diagnosticos)
    const firma = `${metodo.nombre.trim().toLowerCase()}(${metodo.parametros.map((parametro) => parametro.tipo.trim()).join(",")})`
    if (firmas.has(firma)) {
      diagnosticos.push(crearDiagnostico(
        "METODO_FIRMA_DUPLICADA", "error",
        `La clase "${clase.nombre}" contiene la firma de método duplicada "${metodo.nombre}".`,
        "metodo", metodo.id
      ))
    }
    firmas.add(firma)
  }
}

function validarMetodo(metodo: MetodoUML, diagnosticos: DiagnosticoValidacion[]) {
  if (metodo.id.trim() === "") diagnosticos.push(crearDiagnostico("METODO_ID_REQUERIDO", "error", "El método debe tener un identificador estable.", "metodo", metodo.id))
  if (metodo.nombre.trim() === "") diagnosticos.push(crearDiagnostico("METODO_NOMBRE_REQUERIDO", "error", "El método debe tener un nombre.", "metodo", metodo.id))
  if (metodo.visibilidad !== "publica" && metodo.visibilidad !== "privada") diagnosticos.push(crearDiagnostico("METODO_VISIBILIDAD_INVALIDA", "error", "La visibilidad del método no está soportada.", "metodo", metodo.id))
  if (!tiposRetornoSoportados.has(metodo.tipoRetorno.trim())) diagnosticos.push(crearDiagnostico("METODO_RETORNO_INVALIDO", "error", `El tipo de retorno "${metodo.tipoRetorno}" no está soportado.`, "metodo", metodo.id))
  const idsParametros = new Set<string>()
  const nombresParametros = new Set<string>()
  for (const parametro of metodo.parametros) {
    if (parametro.id.trim() === "" || idsParametros.has(parametro.id)) diagnosticos.push(crearDiagnostico("PARAMETRO_ID_INVALIDO", "error", "El parámetro debe tener un identificador único no vacío.", "parametro", parametro.id))
    idsParametros.add(parametro.id)
    const nombre = parametro.nombre.trim()
    if (nombre === "" || nombresParametros.has(nombre.toLowerCase())) diagnosticos.push(crearDiagnostico("PARAMETRO_NOMBRE_INVALIDO", "error", "El parámetro debe tener un nombre único no vacío.", "parametro", parametro.id))
    nombresParametros.add(nombre.toLowerCase())
    if (!tiposSoportados.has(parametro.tipo.trim())) diagnosticos.push(crearDiagnostico("PARAMETRO_TIPO_INVALIDO", "error", `El tipo de parámetro "${parametro.tipo}" no está soportado.`, "parametro", parametro.id))
  }
}

export function validarModelo(
  modelo: ModeloUMLCanonico
): ResultadoValidacion {
  const diagnosticos: DiagnosticoValidacion[] = []
  const atributosSinTipo: string[] = []

  if (modelo.id.trim() === "") {
    diagnosticos.push(
      crearDiagnostico(
        "MODELO_ID_REQUERIDO",
        "error",
        "El modelo debe tener un identificador estable no vacío.",
        "modelo",
        modelo.id
      )
    )
  }

  if (modelo.clases.length === 0) {
    diagnosticos.push(
      crearDiagnostico(
        "MODELO_SIN_CLASES",
        "error",
        "El modelo debe contener al menos una clase para generar un backend.",
        "modelo",
        modelo.id
      )
    )
  }

  const nombresClases = new Set<string>()
  const idsClasesVistos = new Set<string>()
  const idsAtributosVistos = new Set<string>()
  const idsMetodosVistos = new Set<string>()
  for (const clase of modelo.clases) {
    if (clase.id.trim() === "") {
      diagnosticos.push(
        crearDiagnostico(
          "CLASE_ID_REQUERIDO",
          "error",
          `La clase "${clase.nombre}" debe tener un identificador estable no vacío.`,
          "clase",
          clase.id
        )
      )
    } else if (idsClasesVistos.has(clase.id)) {
      diagnosticos.push(
        crearDiagnostico(
          "CLASE_ID_DUPLICADO",
          "error",
          `El identificador de clase "${clase.id}" está duplicado.`,
          "clase",
          clase.id
        )
      )
    } else {
      idsClasesVistos.add(clase.id)
    }

    for (const atributo of clase.atributos) {
      if (!atributo.tipo?.trim()) {
        atributosSinTipo.push(`${clase.nombre || "(clase sin nombre)"}.${atributo.nombre || "(atributo sin nombre)"}`)
      }
      if (atributo.id.trim() === "") {
        diagnosticos.push(
          crearDiagnostico(
            "ATRIBUTO_ID_REQUERIDO",
            "error",
            `El atributo "${atributo.nombre}" debe tener un identificador estable no vacío.`,
            "atributo",
            atributo.id
          )
        )
      } else if (idsAtributosVistos.has(atributo.id)) {
        diagnosticos.push(
          crearDiagnostico(
            "ATRIBUTO_ID_DUPLICADO",
            "error",
            `El identificador de atributo "${atributo.id}" está duplicado en el modelo.`,
            "atributo",
            atributo.id
          )
        )
      } else {
        idsAtributosVistos.add(atributo.id)
      }
    }

    for (const metodo of clase.metodos ?? []) {
      if (metodo.id.trim() !== "" && idsMetodosVistos.has(metodo.id)) diagnosticos.push(crearDiagnostico("METODO_ID_DUPLICADO", "error", `El identificador de método "${metodo.id}" está duplicado.`, "metodo", metodo.id))
      if (metodo.id.trim() !== "") idsMetodosVistos.add(metodo.id)
    }

    validarClase(clase, diagnosticos)
    const clave = claveNombre(clase.nombre)
    if (clave !== "" && nombresClases.has(clave)) {
      diagnosticos.push(
        crearDiagnostico(
          "CLASE_NOMBRE_DUPLICADO",
          "error",
          `El modelo contiene clases duplicadas para el nombre Java "${clase.nombre}".`,
          "clase",
          clase.id
        )
      )
    }
    if (clave !== "") nombresClases.add(clave)
  }

  if (atributosSinTipo.length > 0) {
    diagnosticos.push(
      crearDiagnostico(
        "ATRIBUTOS_SIN_TIPO",
        "advertencia",
        `${atributosSinTipo.length} ${atributosSinTipo.length === 1 ? "atributo sin tipo definido" : "atributos sin tipo definido"}: ${resumirReferencias(atributosSinTipo)}.`,
        "modelo",
        modelo.id
      )
    )
  }

  const idsClases = new Set(modelo.clases.map((clase) => clase.id))
  const idsRelacionesVistos = new Set<string>()
  for (const relacion of modelo.relaciones) {
    if (relacion.id.trim() === "") {
      diagnosticos.push(
        crearDiagnostico(
          "RELACION_ID_REQUERIDO",
          "error",
          "La relación debe tener un identificador estable no vacío.",
          "relacion",
          relacion.id
        )
      )
    } else if (idsRelacionesVistos.has(relacion.id)) {
      diagnosticos.push(
        crearDiagnostico(
          "RELACION_ID_DUPLICADO",
          "error",
          `El identificador de relación "${relacion.id}" está duplicado.`,
          "relacion",
          relacion.id
        )
      )
    } else {
      idsRelacionesVistos.add(relacion.id)
    }

    const origenExiste = idsClases.has(relacion.claseOrigenId)
    const destinoExiste = idsClases.has(relacion.claseDestinoId)
    if (!origenExiste || !destinoExiste) {
      diagnosticos.push(
        crearDiagnostico(
          "RELACION_EXTREMO_INEXISTENTE",
          "error",
          `La relación referencia una clase de origen o destino inexistente.`,
          "relacion",
          relacion.id
        )
      )
    }

    if (
      relacion.tipo !== "generalizacion" &&
      (relacion.multiplicidadOrigen === null || relacion.multiplicidadDestino === null)
    ) {
      diagnosticos.push(
        crearDiagnostico(
          "RELACION_MULTIPLICIDAD_INCOMPLETA",
          "advertencia",
          "La relación no tiene multiplicidades completas en ambos extremos.",
          "relacion",
          relacion.id
        )
      )
    }

  }

  return {
    valido: !diagnosticos.some(
      (diagnostico) => diagnostico.severidad === "error"
    ),
    diagnosticos,
  }
}
