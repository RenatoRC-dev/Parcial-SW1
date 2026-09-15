import { UMLDiagramType, type UMLModel } from "@tumaet/apollon"
import { esUMLModel, resumirModelo } from "./resumenModeloApollon"

const modelo: UMLModel = {
  version: "4.2.0",
  id: "modelo-01",
  title: "Modelo de clientes",
  type: UMLDiagramType.ClassDiagram,
  nodes: [
    {
      id: "cliente",
      type: "class",
      width: 220,
      height: 160,
      position: { x: 20, y: 20 },
      measured: { width: 220, height: 160 },
      data: { name: "Cliente", attributes: [], methods: [] },
    },
    {
      id: "nota",
      type: "titleAndDesctiption",
      width: 200,
      height: 100,
      position: { x: 300, y: 20 },
      measured: { width: 200, height: 100 },
      data: { name: "Contexto" },
    },
  ],
  edges: [
    {
      id: "relacion-01",
      source: "cliente",
      target: "cliente",
      sourceHandle: "source",
      targetHandle: "target",
      type: "ClassBidirectional",
      data: { points: [] },
    },
  ],
  assessments: {},
}

describe("resumirModelo", () => {
  it("resume el contrato UML público y distingue las clases", () => {
    expect(resumirModelo(modelo)).toEqual({
      id: "modelo-01",
      version: "4.2.0",
      tipoDiagrama: "ClassDiagram",
      cantidadNodos: 2,
      cantidadClases: 1,
      cantidadRelaciones: 1,
    })
  })
})

describe("esUMLModel", () => {
  it("acepta un modelo con el sobre público requerido", () => {
    expect(esUMLModel(modelo)).toBe(true)
  })

  it("rechaza un modelo sin colecciones estructuradas", () => {
    expect(esUMLModel({ id: "invalido", version: "4.2.0" })).toBe(false)
  })
})

