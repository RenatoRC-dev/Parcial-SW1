import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"

/** Golden fixture: multiplicities belong to their UML association ends. */
export const fixturePersonaAuto: ModeloUMLCanonicoEntrada = {
  id: "fixture-persona-auto",
  nombre: "Modelo Persona Auto",
  version: "1.0.0",
  clases: [
    {
      id: "persona",
      nombre: "Persona",
      abstracta: false,
      atributos: [
        { id: "persona-id", nombre: "id", tipo: "Long" },
        { id: "persona-nombre", nombre: "nombre", tipo: "String" },
      ],
    },
    {
      id: "auto",
      nombre: "Auto",
      abstracta: false,
      atributos: [
        { id: "auto-id", nombre: "id", tipo: "Long" },
        { id: "auto-placa", nombre: "placa", tipo: "String" },
      ],
    },
  ],
  relaciones: [{
    id: "persona-autos",
    tipo: "asociacion",
    claseOrigenId: "persona",
    claseDestinoId: "auto",
    multiplicidadOrigen: "1",
    multiplicidadDestino: "0..*",
    rolOrigen: "persona",
    rolDestino: "autos",
  }],
}
