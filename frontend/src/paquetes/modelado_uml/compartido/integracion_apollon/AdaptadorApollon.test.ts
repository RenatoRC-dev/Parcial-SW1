import { describe, expect, it } from "vitest"
import type { UMLModel } from "@tumaet/apollon"
import {
  convertirAModeloCanonico,
  convertirAModeloCanonicoConAdvertencias,
  convertirDesdeModeloCanonico,
} from "./AdaptadorApollon"

function crearModelo(
  nodes: UMLModel["nodes"] = [],
  edges: UMLModel["edges"] = []
): UMLModel {
  return {
    version: "4.2.0",
    id: "modelo-1",
    title: "Modelo de prueba",
    type: "ClassDiagram",
    nodes,
    edges,
    assessments: {},
  }
}

function crearClase(
  id: string,
  name: string,
  opciones: {
    attributes?: Array<{ id: string; name: string }>
    position?: { x: number; y: number }
    isAbstract?: boolean
  } = {}
): UMLModel["nodes"][number] {
  return {
    id,
    type: "class",
    width: 200,
    height: 100,
    position: opciones.position ?? { x: 0, y: 0 },
    measured: { width: 200, height: 100 },
    data: {
      name,
      attributes: opciones.attributes ?? [],
      methods: [],
      ...(opciones.isAbstract === undefined
        ? {}
        : { isAbstract: opciones.isAbstract }),
    },
  }
}

function crearRelacion(
  type: UMLModel["edges"][number]["type"],
  data: Record<string, unknown> = {}
): UMLModel["edges"][number] {
  return {
    id: "relacion-1",
    type,
    source: "cliente",
    target: "pedido",
    sourceHandle: "source",
    targetHandle: "target",
    data: { points: [], ...data },
  }
}

describe("AdaptadorApollon", () => {
  it("convierte un diagrama de clases vacío", () => {
    const canonico = convertirAModeloCanonico(crearModelo())

    expect(canonico).toMatchObject({
      id: "modelo-1",
      nombre: "Modelo de prueba",
      version: "4.2.0",
      clases: [],
      relaciones: [],
    })
  })

  it("preserva id, nombre, posición y abstracción de una clase", () => {
    const canonico = convertirAModeloCanonico(
      crearModelo([
        crearClase("cliente", "Cliente", {
          position: { x: 125, y: 240 },
          isAbstract: true,
        }),
      ])
    )

    expect(canonico.clases).toEqual([
      {
        id: "cliente",
        nombre: "Cliente",
        atributos: [],
        metodos: [],
        posicion: { x: 125, y: 240 },
        abstracta: true,
      },
    ])
  })

  it("interpreta atributos y conserva sus ids estables", () => {
    const canonico = convertirAModeloCanonico(
      crearModelo([
        crearClase("cliente", "Cliente", {
          attributes: [
            { id: "atributo-nombre", name: "+ nombre: String" },
            { id: "atributo-email", name: "- email : String" },
          ],
        }),
      ])
    )

    expect(canonico.clases[0].atributos).toEqual([
      {
        id: "atributo-nombre",
        nombre: "nombre",
        tipo: "String",
        visibilidad: "publica",
      },
      {
        id: "atributo-email",
        nombre: "email",
        tipo: "String",
        visibilidad: "privada",
      },
    ])
  })

  it.each([
    ["ClassBidirectional", "asociacion"],
    ["ClassUnidirectional", "asociacion"],
    ["ClassAggregation", "agregacion"],
    ["ClassComposition", "composicion"],
    ["ClassInheritance", "generalizacion"],
  ] as const)("convierte %s en %s", (tipoApollon, tipoCanonico) => {
    const canonico = convertirAModeloCanonico(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [crearRelacion(tipoApollon)]
      )
    )

    expect(canonico.relaciones[0]).toMatchObject({
      id: "relacion-1",
      tipo: tipoCanonico,
      claseOrigenId: "cliente",
      claseDestinoId: "pedido",
    })
  })

  it("normaliza multiplicidades y conserva roles verificados", () => {
    const canonico = convertirAModeloCanonico(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [
          crearRelacion("ClassBidirectional", {
            sourceMultiplicity: "1",
            targetMultiplicity: "*",
            sourceRole: "cliente",
            targetRole: "pedidos",
          }),
        ]
      )
    )

    expect(canonico.relaciones[0]).toMatchObject({
      multiplicidadOrigen: "1",
      multiplicidadDestino: "0..*",
      rolOrigen: "cliente",
      rolDestino: "pedidos",
    })
  })

  it("omite una relación no soportada y entrega una advertencia", () => {
    const resultado = convertirAModeloCanonicoConAdvertencias(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [crearRelacion("ClassDependency")]
      )
    )

    expect(resultado.modelo.relaciones).toEqual([])
    expect(resultado.advertencias).toContain(
      "Tipo de relación de Apollon no soportado por el modelo canónico: ClassDependency."
    )
  })

  it("no inventa un tipo para una multiplicidad desconocida", () => {
    const resultado = convertirAModeloCanonicoConAdvertencias(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [crearRelacion("ClassBidirectional", { sourceMultiplicity: "2..5" })]
      )
    )

    expect(resultado.modelo.relaciones[0].multiplicidadOrigen).toBeNull()
    expect(resultado.advertencias[0]).toContain(
      "Multiplicidad de origen no soportada"
    )
  })

  it("recrea una clase canónica con id, atributos, posición y abstracción", () => {
    const apollon = convertirDesdeModeloCanonico({
      id: "modelo-importado",
      nombre: "Importado",
      version: "xmi",
      clases: [{
        id: "cliente",
        nombre: "Cliente",
        abstracta: false,
        posicion: { x: 100, y: 200 },
        atributos: [{ id: "nombre", nombre: "nombre", tipo: "String" }],
      }],
      relaciones: [],
    })

    expect(apollon).toMatchObject({ id: "modelo-importado", title: "Importado", type: "ClassDiagram" })
    expect(apollon.nodes[0]).toMatchObject({
      id: "cliente",
      position: { x: 100, y: 200 },
      data: { name: "Cliente", attributes: [{ id: "nombre", name: "nombre: String" }] },
    })
  })

  it("no inventa String al recrear un atributo canónico sin tipo", () => {
    const modelo = {
      id: "modelo-sin-tipo",
      nombre: "Sin tipo",
      version: "4.2.0",
      clases: [{
        id: "cliente",
        nombre: "Cliente",
        abstracta: false,
        posicion: { x: 100, y: 100 },
        atributos: [{ id: "dato", nombre: "dato", tipo: null }],
      }],
      relaciones: [],
    }

    const vuelta = convertirAModeloCanonico(convertirDesdeModeloCanonico(modelo))

    expect(vuelta.clases[0].atributos[0]).toMatchObject({
      id: "dato",
      nombre: "dato",
      tipo: null,
    })
  })

  it("preserva la asociación soportada en canonical → Apollon → canonical", () => {
    const modelo = {
      id: "modelo-importado",
      nombre: "Importado",
      version: "4.2.0",
      clases: [
        { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [] },
        { id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 450, y: 100 }, atributos: [] },
      ],
      relaciones: [{
        id: "relacion",
        nombre: "tiene",
        tipo: "asociacion" as const,
        claseOrigenId: "cliente",
        claseDestinoId: "pedido",
        multiplicidadOrigen: "1" as const,
        multiplicidadDestino: "0..*" as const,
        rolOrigen: "cliente",
        rolDestino: "pedidos",
      }],
    }
    const vuelta = convertirAModeloCanonico(convertirDesdeModeloCanonico(modelo))
    expect(vuelta.relaciones).toEqual([expect.objectContaining(modelo.relaciones[0])])
    const arista = convertirDesdeModeloCanonico(modelo).edges[0]
    expect(arista).toMatchObject({
      sourceHandle: "right",
      targetHandle: "left",
      data: { label: "tiene", sourceMultiplicity: "1", targetMultiplicity: "*" },
    })
  })

  it("preserva operaciones UML y parámetros en canonical → Apollon → canonical", () => {
    const modelo = {
      id: "modelo-metodos", nombre: "Métodos", version: "4.2.0",
      clases: [{
        id: "persona", nombre: "Persona", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [],
        metodos: [
          { id: "calcular", nombre: "calcularTotal", visibilidad: "publica" as const, tipoRetorno: "Double", parametros: [] },
          { id: "cambiar", nombre: "cambiarNombre", visibilidad: "publica" as const, tipoRetorno: "void", parametros: [{ id: "nombre-param", nombre: "nombre", tipo: "String" }] },
          { id: "validar", nombre: "validarStock", visibilidad: "privada" as const, tipoRetorno: "Boolean", parametros: [{ id: "producto-param", nombre: "productoId", tipo: "Long" }] },
        ],
      }],
      relaciones: [],
    }

    const apollon = convertirDesdeModeloCanonico(modelo)
    expect(apollon.nodes[0].data.methods).toEqual([
      { id: "calcular", name: "+ calcularTotal(): Double" },
      { id: "cambiar", name: "+ cambiarNombre(nombre: String): void" },
      { id: "validar", name: "- validarStock(productoId: Long): Boolean" },
    ])
    const vuelta = convertirAModeloCanonico(apollon)
    expect(vuelta.clases[0].metodos).toEqual([
      expect.objectContaining({ id: "calcular", nombre: "calcularTotal", visibilidad: "publica", tipoRetorno: "Double", parametros: [] }),
      expect.objectContaining({ id: "cambiar", nombre: "cambiarNombre", visibilidad: "publica", tipoRetorno: "void", parametros: [expect.objectContaining({ nombre: "nombre", tipo: "String" })] }),
      expect.objectContaining({ id: "validar", nombre: "validarStock", visibilidad: "privada", tipoRetorno: "Boolean", parametros: [expect.objectContaining({ nombre: "productoId", tipo: "Long" })] }),
    ])
  })
})
