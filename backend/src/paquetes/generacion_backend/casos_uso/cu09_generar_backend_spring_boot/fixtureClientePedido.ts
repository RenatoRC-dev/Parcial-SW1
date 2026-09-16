import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"

export const fixtureClientePedido: ModeloUMLCanonicoEntrada = {
  id: "fixture-cliente-pedido",
  nombre: "Modelo Cliente Pedido",
  version: "1.0.0",
  clases: [
    {
      id: "cliente",
      nombre: "Cliente",
      abstracta: false,
      atributos: [
        { id: "nombre", nombre: "nombre", tipo: "String" },
        { id: "email", nombre: "email", tipo: "String" },
      ],
    },
    {
      id: "pedido",
      nombre: "Pedido",
      abstracta: false,
      atributos: [{ id: "fecha", nombre: "fecha", tipo: "LocalDate" }],
    },
  ],
  relaciones: [
    {
      id: "cliente-pedidos",
      tipo: "asociacion",
      claseOrigenId: "cliente",
      claseDestinoId: "pedido",
      multiplicidadOrigen: "1",
      multiplicidadDestino: "0..*",
      rolOrigen: "cliente",
      rolDestino: "pedidos",
    },
  ],
}
