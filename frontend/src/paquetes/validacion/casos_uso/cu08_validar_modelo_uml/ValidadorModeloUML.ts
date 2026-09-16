import type {
  AtributoUML,
  ClaseUML,
  ModeloUMLCanonico,
} from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export type SeveridadDiagnostico = "error" | "advertencia"

export type TipoElementoDiagnostico =
  | "modelo"
  | "clase"
  | "atributo"
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

const tiposSoportados = new Set<string>(TIPOS_GENERACION_SOPORTADOS)
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

  if (nombre === "id") {
    diagnosticos.push(
      crearDiagnostico(
        "ATRIBUTO_ID_RESERVADO",
        "error",
        "El campo id está reservado para la identidad Long generada automáticamente.",
        "atributo",
        atributo.id
      )
    )
  }

  const tipo = atributo.tipo?.trim() ?? ""
  if (tipo === "") {
    diagnosticos.push(
      crearDiagnostico(
        "ATRIBUTO_TIPO_REQUERIDO",
        "error",
        `El atributo "${atributo.nombre || atributo.id}" debe declarar un tipo.`,
        "atributo",
        atributo.id
      )
    )
  } else if (!tiposSoportados.has(tipo)) {
    diagnosticos.push(
      crearDiagnostico(
        "ATRIBUTO_TIPO_NO_SOPORTADO",
        "error",
        `El tipo "${tipo}" no está soportado por el perfil inicial de generación.`,
        "atributo",
        atributo.id
      )
    )
  }
}

function validarClase(
  clase: ClaseUML,
  diagnosticos: DiagnosticoValidacion[]
) {
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
}

export function validarModelo(
  modelo: ModeloUMLCanonico
): ResultadoValidacion {
  const diagnosticos: DiagnosticoValidacion[] = []

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
      relacion.multiplicidadOrigen === null ||
      relacion.multiplicidadDestino === null
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
