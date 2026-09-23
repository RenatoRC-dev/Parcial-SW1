import type { Multiplicidad, VisibilidadUML } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export interface AtributoCandidatoImagen {
  refTemporal: string
  nombre: string
  tipoDato: string | null
  visibilidad?: VisibilidadUML
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
  multiplicidadOrigen: Multiplicidad
  multiplicidadDestino: Multiplicidad
  rolOrigen: string | null
  rolDestino: string | null
}

export interface CandidatoModeloUMLImagen {
  clases: ClaseCandidataImagen[]
  relaciones: RelacionCandidataImagen[]
  advertencias: string[]
}

export type RespuestaAnalisisImagen =
  | { resultado: "candidato"; mensaje: string; candidato: CandidatoModeloUMLImagen; modelo: string }
  | { resultado: "sin_modelo"; mensaje: string; candidato: null; modelo: string }
