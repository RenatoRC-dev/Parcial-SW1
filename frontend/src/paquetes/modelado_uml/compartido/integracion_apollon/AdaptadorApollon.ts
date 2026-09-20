import type { UMLModel } from "@tumaet/apollon"
import type {
  AtributoUML,
  ClaseUML,
  MetodoUML,
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
  methods: ElementoClaseApollon[]
  isAbstract?: boolean
  stereotype?: unknown
  sw1TipoClase?: unknown
}

interface ResultadoInterpretacionAtributo {
  atributo: AtributoUML
  advertencia?: string
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null
}

function leerDatosClase(valor: Record<string, unknown>): DatosClaseApollon | null {
  if (typeof valor.name !== "string" || !Array.isArray(valor.attributes) || !Array.isArray(valor.methods)) {
    return null
  }

  const attributes = valor.attributes.filter(
    (atributo): atributo is ElementoClaseApollon =>
      esRegistro(atributo) &&
      typeof atributo.id === "string" &&
      typeof atributo.name === "string"
  )
  const methods = valor.methods.filter(
    (metodo): metodo is ElementoClaseApollon =>
      esRegistro(metodo) && typeof metodo.id === "string" && typeof metodo.name === "string"
  )

  return {
    name: valor.name,
    attributes,
    methods,
    isAbstract:
      typeof valor.isAbstract === "boolean" ? valor.isAbstract : undefined,
    stereotype: valor.stereotype,
    sw1TipoClase: valor.sw1TipoClase,
  }
}

function interpretarMetodo(
  metodoApollon: ElementoClaseApollon,
  advertencias: string[]
): MetodoUML | null {
  const coincidencia = metodoApollon.name.trim().match(/^([+\-])?\s*([^()]+?)\s*\((.*)\)\s*:\s*(\S+)$/)
  if (!coincidencia) {
    advertencias.push(`El método ${metodoApollon.id} no usa la notación UML soportada "nombre(parámetros): Retorno".`)
    return null
  }
  const [, simbolo, nombre, textoParametros, tipoRetorno] = coincidencia
  const parametros = textoParametros.trim() === "" ? [] : textoParametros.split(",").map((texto, indice) => {
    const partes = texto.trim().match(/^([^:]+?)\s*:\s*(\S+)$/)
    if (!partes) return null
    return { id: `${metodoApollon.id}:parametro:${indice}`, nombre: partes[1].trim(), tipo: partes[2].trim() }
  })
  if (parametros.some((parametro) => parametro === null)) {
    advertencias.push(`El método ${metodoApollon.id} contiene parámetros fuera de la notación "nombre: Tipo".`)
    return null
  }
  return {
    id: metodoApollon.id,
    nombre: nombre.trim(),
    visibilidad: simbolo === "-" ? "privada" : "publica",
    tipoRetorno: tipoRetorno.trim(),
    parametros: parametros as MetodoUML["parametros"],
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
  const metodos = datos.methods
    .map((metodo) => interpretarMetodo(metodo, advertencias))
    .filter((metodo): metodo is MetodoUML => metodo !== null)

  return {
    id: nodo.id,
    nombre: datos.name,
    atributos,
    metodos,
    posicion: { x: nodo.position.x, y: nodo.position.y },
    abstracta: datos.isAbstract === true,
    tipoClase: datos.sw1TipoClase === "asociativa" ? "asociativa" : "normal",
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
  const nombre = leerTextoOpcional(arista.data.label)
  const rolOrigen = leerTextoOpcional(arista.data.sourceRole)
  const rolDestino = leerTextoOpcional(arista.data.targetRole)
  if (nombre) relacion.nombre = nombre
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

/**
 * El modelo canonico no representa navegabilidad. Una asociacion creada por
 * Apollon como unidireccional se normaliza a la arista publica sin flecha para
 * que el lienzo no conserve una semantica que SW1 no puede almacenar.
 */
export function normalizarAsociacionesSinNavegabilidad(modeloApollon: UMLModel): UMLModel {
  if (!modeloApollon.edges.some((arista) => arista.type === "ClassUnidirectional")) {
    return modeloApollon
  }

  return {
    ...modeloApollon,
    edges: modeloApollon.edges.map((arista) =>
      arista.type === "ClassUnidirectional"
        ? { ...arista, type: "ClassBidirectional" }
        : arista
    ),
  }
}

function notacionAtributo(atributo: AtributoUML): string {
  const visibilidad = atributo.visibilidad === "privada" ? "- " : atributo.visibilidad === "publica" ? "+ " : ""
  const tipo = atributo.tipo?.trim()
  return tipo ? `${visibilidad}${atributo.nombre}: ${tipo}` : `${visibilidad}${atributo.nombre}`
}

function notacionMetodo(metodo: MetodoUML): string {
  const visibilidad = metodo.visibilidad === "privada" ? "-" : "+"
  const parametros = metodo.parametros.map((parametro) => `${parametro.nombre}: ${parametro.tipo}`).join(", ")
  return `${visibilidad} ${metodo.nombre}(${parametros}): ${metodo.tipoRetorno}`
}

function multiplicidadApollon(multiplicidad: Multiplicidad | null): string {
  return multiplicidad === "0..*" ? "*" : (multiplicidad ?? "")
}

function obtenerHandlesRelacion(
  relacion: RelacionUML,
  clases: ModeloUMLCanonico["clases"]
): { sourceHandle: string; targetHandle: string } {
  const origen = clases.find((clase) => clase.id === relacion.claseOrigenId)
  const destino = clases.find((clase) => clase.id === relacion.claseDestinoId)
  if (!origen || !destino) return { sourceHandle: "right", targetHandle: "left" }

  const deltaX = destino.posicion.x - origen.posicion.x
  const deltaY = destino.posicion.y - origen.posicion.y
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" }
  }
  return deltaY >= 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" }
}

export function convertirDesdeModeloCanonico(modelo: ModeloUMLCanonico): UMLModel {
  const tiposRelacion: Record<TipoRelacionUML, UMLModel["edges"][number]["type"]> = {
    asociacion: "ClassBidirectional",
    agregacion: "ClassAggregation",
    composicion: "ClassComposition",
    generalizacion: "ClassInheritance",
  }

  return {
    version: "4.2.0",
    id: modelo.id,
    title: modelo.nombre,
    type: "ClassDiagram",
    assessments: {},
    nodes: modelo.clases.map((clase, indice) => ({
      id: clase.id,
      type: "class",
      width: 220,
      height: Math.max(100, 70 + clase.atributos.length * 24),
      measured: { width: 220, height: Math.max(100, 70 + clase.atributos.length * 24) },
      position: Number.isFinite(clase.posicion?.x) && Number.isFinite(clase.posicion?.y)
        ? clase.posicion
        : { x: 100 + (indice % 3) * 350, y: 100 + Math.floor(indice / 3) * 250 },
      data: {
        name: clase.nombre,
        attributes: clase.atributos.map((atributo) => ({ id: atributo.id, name: notacionAtributo(atributo) })),
        methods: (clase.metodos ?? []).map((metodo) => ({ id: metodo.id, name: notacionMetodo(metodo) })),
        isAbstract: clase.abstracta,
        sw1TipoClase: clase.tipoClase === "asociativa" ? "asociativa" : "normal",
      },
    })),
    edges: modelo.relaciones.map((relacion) => ({
      id: relacion.id,
      type: tiposRelacion[relacion.tipo],
      source: relacion.claseOrigenId,
      target: relacion.claseDestinoId,
      ...obtenerHandlesRelacion(relacion, modelo.clases),
      data: {
        points: [],
        label: relacion.nombre ?? "",
        sourceMultiplicity: multiplicidadApollon(relacion.multiplicidadOrigen),
        targetMultiplicity: multiplicidadApollon(relacion.multiplicidadDestino),
        sourceRole: relacion.rolOrigen ?? "",
        targetRole: relacion.rolDestino ?? "",
      },
    })),
  }
}
