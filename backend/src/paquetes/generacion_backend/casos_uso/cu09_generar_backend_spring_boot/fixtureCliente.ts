import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"

export const fixtureCliente: ModeloUMLCanonicoEntrada = {
  id: "fixture-cliente",
  nombre: "Modelo Cliente",
  version: "1.0.0",
  clases: [
    {
      id: "cliente",
      nombre: "Cliente",
      abstracta: false,
      atributos: [
        { id: "nombre", nombre: "nombre", tipo: "String" },
        { id: "email", nombre: "email", tipo: "String" },
        { id: "edad", nombre: "edad", tipo: "Integer" },
      ],
    },
  ],
  relaciones: [],
}
