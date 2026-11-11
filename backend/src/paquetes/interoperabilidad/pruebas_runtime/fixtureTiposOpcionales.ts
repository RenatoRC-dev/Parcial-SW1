import type { ModeloUMLCanonicoIntercambio } from "../compartido/crunch_uml/ContratoInteroperabilidadXmi.js"

/** Mixed conceptual UML fixture: no inferred identifiers or relational foreign keys. */
export const fixtureTiposOpcionales: ModeloUMLCanonicoIntercambio = {
  id: "EAPK_TIPOS_OPCIONALES", nombre: "UML con tipos opcionales", version: "4.2.0",
  clases: [
    { id: "EAID_CLIENTE", nombre: "Cliente", abstracta: false, tipoClase: "normal", posicion: { x: 100, y: 100 }, atributos: [
      { id: "EAID_NOMBRE", nombre: "nombre", tipo: null, visibilidad: "privada" },
      { id: "EAID_CORREO", nombre: "correo", tipo: "String", visibilidad: "publica" },
      { id: "EAID_TELEFONO", nombre: "telefono", tipo: null },
    ] },
    { id: "EAID_VENTA", nombre: "VentaCredito", abstracta: false, tipoClase: "normal", posicion: { x: 450, y: 100 }, atributos: [] },
  ],
  relaciones: [{ id: "EAID_COMPRA", nombre: "compra", tipo: "asociacion", claseOrigenId: "EAID_CLIENTE", claseDestinoId: "EAID_VENTA", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "ventas" }],
}
