import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"

export const fixtureClienteProducto: ModeloUMLCanonicoEntrada = {
  id: "fixture-flutter-sync",
  nombre: "Flutter Sync",
  version: "1.0.0",
  clases: [
    {
      id: "cliente",
      nombre: "Cliente",
      abstracta: false,
      atributos: [
        { id: "cliente-nombre", nombre: "nombre", tipo: "String" },
        { id: "cliente-correo", nombre: "correo", tipo: "String" },
      ],
    },
    {
      id: "producto",
      nombre: "Producto",
      abstracta: false,
      atributos: [
        { id: "producto-nombre", nombre: "nombre", tipo: "String" },
        { id: "producto-precio", nombre: "precio", tipo: "Double" },
      ],
    },
  ],
  relaciones: [],
}
