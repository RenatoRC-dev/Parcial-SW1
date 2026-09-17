export type MultiplicidadCandidata = "0..1" | "1" | "0..*" | "1..*"

export interface AtributoCandidatoImagen {
  refTemporal: string
  nombre: string
  tipoDato: string | null
}

export interface ClaseCandidataImagen {
  refTemporal: string
  nombre: string
  atributos: AtributoCandidatoImagen[]
}

export interface RelacionCandidataImagen {
  refTemporal: string
  tipo: "asociacion"
  origenRef: string
  destinoRef: string
  multiplicidadOrigen: MultiplicidadCandidata
  multiplicidadDestino: MultiplicidadCandidata
  rolOrigen: string | null
  rolDestino: string | null
}

export interface CandidatoModeloUMLImagen {
  clases: ClaseCandidataImagen[]
  relaciones: RelacionCandidataImagen[]
  advertencias: string[]
}

export type ResultadoVisionUML =
  | { resultado: "candidato"; mensaje: string; candidato: CandidatoModeloUMLImagen; modelo: string }
  | { resultado: "sin_modelo"; mensaje: string; candidato: null; modelo: string }
