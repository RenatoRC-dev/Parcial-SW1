import type { UMLModel } from "@tumaet/apollon"
import type {
  AtributoUML,
  ClaseUML,
  ModeloUMLCanonico,
  Multiplicidad,
  RelacionUML,
  TipoRelacionUML,
  VisibilidadUML,
} from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export interface ResultadoAdaptacionApollon {
  modelo: ModeloUMLCanonico
  advertencias: string[]
}

const TIPOS_RELACION: Readonly<Record<string, TipoRelacionUML>> = {
  ClassBidirectional: "asociacion",
  ClassUnidirectional: "asociacion",
  ClassAggregation: "agregacion",
  ClassComposition: "composicion",
  ClassInheritance: "generalizacion",
}

const VISIBILIDADES: Readonly<Record<string, VisibilidadUML>> = {
  "+": "publica",
  "-": "privada",
}

interface ElementoClaseApollon {
  id: string
  name: string
}

interface DatosClaseApollon {
  name: string
  attributes: ElementoClaseApollon[]
  isAbstract?: boolean
  stereotype?: unknown
}

interface ResultadoInterpretacionAtributo {
  atributo: AtributoUML
  advertencia?: string
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null
}

function leerDatosClase(valor: Record<string, unknown>): DatosClaseApollon | null {
  if (typeof valor.name !== "string" || !Array.isArray(valor.attributes)) {
    return null
  }

  const attributes = valor.attributes.filter(
    (atributo): atributo is ElementoClaseApollon =>
      esRegistro(atributo) &&
      typeof atributo.id === "string" &&
      typeof atributo.name === "string"
  )

  return {
    name: valor.name,
    attributes,
    isAbstract:
      typeof valor.isAbstract === "boolean" ? valor.isAbstract : undefined,
    stereotype: valor.stereotype,
  }
}

export function interpretarAtributo(
  atributoApollon: ElementoClaseApollon
): ResultadoInterpretacionAtributo {
  const notacion = atributoApollon.name.trim()
  const coincidencia = notacion.match(/^([+\-#~])?\s*([^:]+?)\s*:\s*(.+)$/)

  if (!coincidencia) {
    const nombreSinVisibilidad = notacion.replace(/^[+\-#~]\s*/, "").trim()
    return {
      atributo: {
        id: atributoApollon.id,
        nombre: nombreSinVisibilidad,
        tipo: null,
      },
      advertencia: `El atributo ${atributoApollon.id} no usa la notación "nombre: Tipo"; su tipo no fue inferido.`,
    }
  }

  const [, simboloVisibilidad, nombre, tipo] = coincidencia
  const atributo: AtributoUML = {
    id: atributoApollon.id,
    nombre: nombre.trim(),
    tipo: tipo.trim(),
  }

  if (simboloVisibilidad) {
    const visibilidad = VISIBILIDADES[simboloVisibilidad]
    if (visibilidad) atributo.visibilidad = visibilidad
    else {
      return {
        atributo,
        advertencia: `La visibilidad ${simboloVisibilidad} del atributo ${atributoApollon.id} no está soportada en esta iteración.`,
      }
    }
  }

  return { atributo }
}

export function normalizarMultiplicidad(
  valor: unknown
): Multiplicidad | null | undefined {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== "string") return undefined

  const multiplicidad = valor.trim()
  if (multiplicidad === "") return null
  if (multiplicidad === "*") return "0..*"
  if (
    multiplicidad === "0..1" ||
    multiplicidad === "1" ||
    multiplicidad === "0..*" ||
    multiplicidad === "1..*"
  ) {
    return multiplicidad
  }

  return undefined
}

function leerTextoOpcional(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined
  const texto = valor.trim()
  return texto === "" ? undefined : texto
}

function convertirClase(
  nodo: UMLModel["nodes"][number],
  advertencias: string[]
): ClaseUML | null {
  const datos = leerDatosClase(nodo.data)
  if (!datos) {
    advertencias.push(
      `La clase ${nodo.id} no contiene nombre y atributos con la estructura esperada de Apollon.`
    )
    return null
  }

  if (datos.stereotype !== undefined && datos.stereotype !== null) {
    advertencias.push(
      `El nodo ${nodo.id} usa el estereotipo ${String(datos.stereotype)}, no soportado por el modelo canónico actual.`
    )
    return null
  }

  if (
    typeof nodo.position?.x !== "number" ||
    typeof nodo.position?.y !== "number"
  ) {
    advertencias.push(`La clase ${nodo.id} no tiene una posición válida.`)
    return null
  }

  const atributos = datos.attributes.map((atributoApollon) => {
    const resultado = interpretarAtributo(atributoApollon)
    if (resultado.advertencia) advertencias.push(resultado.advertencia)
    return resultado.atributo
  })

  return {
    id: nodo.id,
    nombre: datos.name,
    atributos,
    posicion: { x: nodo.position.x, y: nodo.position.y },
    abstracta: datos.isAbstract === true,
  }
}

function convertirRelacion(
  arista: UMLModel["edges"][number],
  idsClases: ReadonlySet<string>,
  advertencias: string[]
): RelacionUML | null {
  const tipo = TIPOS_RELACION[arista.type]
  if (!tipo) {
    advertencias.push(
      `Tipo de relación de Apollon no soportado por el modelo canónico: ${arista.type}.`
    )
    return null
  }

  if (!idsClases.has(arista.source) || !idsClases.has(arista.target)) {
    advertencias.push(
      `La relación ${arista.id} no conecta dos clases canónicas soportadas.`
    )
    return null
  }

  const multiplicidadOrigen = normalizarMultiplicidad(
    arista.data.sourceMultiplicity
  )
  const multiplicidadDestino = normalizarMultiplicidad(
    arista.data.targetMultiplicity
  )

  if (multiplicidadOrigen === undefined) {
    advertencias.push(
      `Multiplicidad de origen no soportada en la relación ${arista.id}: ${String(arista.data.sourceMultiplicity)}.`
    )
  }
  if (multiplicidadDestino === undefined) {
    advertencias.push(
      `Multiplicidad de destino no soportada en la relación ${arista.id}: ${String(arista.data.targetMultiplicity)}.`
    )
  }

  const relacion: RelacionUML = {
    id: arista.id,
    tipo,
    claseOrigenId: arista.source,
    claseDestinoId: arista.target,
    multiplicidadOrigen: multiplicidadOrigen ?? null,
    multiplicidadDestino: multiplicidadDestino ?? null,
  }
  const rolOrigen = leerTextoOpcional(arista.data.sourceRole)
  const rolDestino = leerTextoOpcional(arista.data.targetRole)
  if (rolOrigen) relacion.rolOrigen = rolOrigen
  if (rolDestino) relacion.rolDestino = rolDestino

  return relacion
}

export function convertirAModeloCanonicoConAdvertencias(
  modeloApollon: UMLModel
): ResultadoAdaptacionApollon {
  const advertencias: string[] = []
  const clases = modeloApollon.nodes
    .filter((nodo) => nodo.type === "class")
    .map((nodo) => convertirClase(nodo, advertencias))
    .filter((clase): clase is ClaseUML => clase !== null)
  const idsClases = new Set(clases.map((clase) => clase.id))
  const relaciones = modeloApollon.edges
    .map((arista) => convertirRelacion(arista, idsClases, advertencias))
    .filter((relacion): relacion is RelacionUML => relacion !== null)

  return {
    modelo: {
      id: modeloApollon.id,
      nombre: modeloApollon.title,
      version: modeloApollon.version,
      clases,
      relaciones,
    },
    advertencias,
  }
}

export function convertirAModeloCanonico(
  modeloApollon: UMLModel
): ModeloUMLCanonico {
  return convertirAModeloCanonicoConAdvertencias(modeloApollon).modelo
}
