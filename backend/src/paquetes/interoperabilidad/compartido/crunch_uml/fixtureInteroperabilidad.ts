import type { ModeloUMLCanonicoIntercambio } from "./ContratoInteroperabilidadXmi.js"

export const fixtureInteroperabilidad: ModeloUMLCanonicoIntercambio = {
  id: "EAPK_SW1_INTEROP",
  nombre: "Modelo SW1 Interoperabilidad",
  version: "4.2.0",
  clases: [
    {
      id: "EAID_CLIENTE",
      nombre: "Cliente",
      abstracta: false,
      posicion: { x: 100, y: 100 },
      atributos: [
        { id: "EAID_CLIENTE_NOMBRE", nombre: "nombre", tipo: "String" },
        { id: "EAID_CLIENTE_EMAIL", nombre: "email", tipo: "String" },
      ],
    },
    {
      id: "EAID_PEDIDO",
      nombre: "Pedido",
      abstracta: false,
      posicion: { x: 450, y: 100 },
      atributos: [{ id: "EAID_PEDIDO_FECHA", nombre: "fecha", tipo: "LocalDate" }],
    },
  ],
  relaciones: [
    {
      id: "EAID_CLIENTE_PEDIDOS",
      tipo: "asociacion",
      claseOrigenId: "EAID_CLIENTE",
      claseDestinoId: "EAID_PEDIDO",
      multiplicidadOrigen: "1",
      multiplicidadDestino: "0..*",
      rolOrigen: "cliente",
      rolDestino: "pedidos",
    },
  ],
}
