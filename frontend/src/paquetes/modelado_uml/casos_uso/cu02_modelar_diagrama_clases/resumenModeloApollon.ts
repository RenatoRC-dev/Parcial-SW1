import type { UMLModel } from "@tumaet/apollon"

export interface ResumenModeloApollon {
  id: string
  version: string
  tipoDiagrama: string
  cantidadNodos: number
  cantidadClases: number
  cantidadRelaciones: number
}

export function esUMLModel(valor: unknown): valor is UMLModel {
  if (typeof valor !== "object" || valor === null) return false

  const candidato = valor as Partial<UMLModel>

  return (
    typeof candidato.id === "string" &&
    typeof candidato.version === "string" &&
    typeof candidato.type === "string" &&
    Array.isArray(candidato.nodes) &&
    Array.isArray(candidato.edges) &&
    typeof candidato.assessments === "object" &&
    candidato.assessments !== null
  )
}

export function resumirModelo(modelo: UMLModel): ResumenModeloApollon {
  return {
    id: modelo.id,
    version: modelo.version,
    tipoDiagrama: modelo.type,
    cantidadNodos: modelo.nodes.length,
    cantidadClases: modelo.nodes.filter((nodo) => nodo.type === "class").length,
    cantidadRelaciones: modelo.edges.length,
  }
}

export function convertirAError(
  valor: unknown,
  mensajeAlternativo: string
): Error {
  return valor instanceof Error ? valor : new Error(mensajeAlternativo)
}

