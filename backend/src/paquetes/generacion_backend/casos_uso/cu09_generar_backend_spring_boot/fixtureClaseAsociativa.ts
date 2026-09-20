import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"

export const fixtureUsuarioRol: ModeloUMLCanonicoEntrada = {
  id: "fixture-usuario-rol", nombre: "Usuarios y roles", version: "1.0.0",
  clases: [
    { id: "usuario", nombre: "Usuario", tipoClase: "normal", abstracta: false, atributos: [
      { id: "usuario-id", nombre: "id", tipo: "Long" },
      { id: "usuario-nombre", nombre: "nombre", tipo: "String" },
    ] },
    { id: "rol", nombre: "Rol", tipoClase: "normal", abstracta: false, atributos: [
      { id: "rol-id", nombre: "id", tipo: "Long" },
      { id: "rol-nombre", nombre: "nombre", tipo: "String" },
    ] },
    { id: "usuario-rol", nombre: "UsuarioRol", tipoClase: "asociativa", abstracta: false, atributos: [] },
  ],
  relaciones: [
    { id: "usuario-usuario-rol", tipo: "asociacion", claseOrigenId: "usuario", claseDestinoId: "usuario-rol", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
    { id: "usuario-rol-rol", tipo: "asociacion", claseOrigenId: "usuario-rol", claseDestinoId: "rol", multiplicidadOrigen: "0..*", multiplicidadDestino: "1" },
  ],
}

export const fixtureInscripcion: ModeloUMLCanonicoEntrada = {
  id: "fixture-inscripcion", nombre: "Inscripciones", version: "1.0.0",
  clases: [
    { id: "estudiante", nombre: "Estudiante", abstracta: false, atributos: [{ id: "estudiante-id", nombre: "id", tipo: "Long" }] },
    { id: "materia", nombre: "Materia", abstracta: false, atributos: [{ id: "materia-id", nombre: "id", tipo: "Long" }] },
    { id: "inscripcion", nombre: "Inscripcion", tipoClase: "asociativa", abstracta: false, atributos: [{ id: "fecha", nombre: "fecha", tipo: "LocalDate" }] },
  ],
  relaciones: [
    { id: "estudiante-inscripcion", tipo: "asociacion", claseOrigenId: "estudiante", claseDestinoId: "inscripcion", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
    { id: "inscripcion-materia", tipo: "asociacion", claseOrigenId: "inscripcion", claseDestinoId: "materia", multiplicidadOrigen: "0..*", multiplicidadDestino: "1" },
  ],
}
