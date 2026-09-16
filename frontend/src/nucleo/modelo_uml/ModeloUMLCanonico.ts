export type Multiplicidad = "0..1" | "1" | "0..*" | "1..*"

export type TipoRelacionUML =
  | "asociacion"
  | "agregacion"
  | "composicion"
  | "generalizacion"

export type VisibilidadUML = "publica" | "privada"

export interface PosicionUML {
  x: number
  y: number
}

export interface AtributoUML {
  id: string
  nombre: string
  tipo: string | null
  visibilidad?: VisibilidadUML
}

export interface ClaseUML {
  id: string
  nombre: string
  atributos: AtributoUML[]
  posicion: PosicionUML
  abstracta: boolean
}

export interface RelacionUML {
  id: string
  tipo: TipoRelacionUML
  claseOrigenId: string
  claseDestinoId: string
  multiplicidadOrigen: Multiplicidad | null
  multiplicidadDestino: Multiplicidad | null
  rolOrigen?: string
  rolDestino?: string
}

export interface ModeloUMLCanonico {
  id: string
  nombre: string
  version: string
  clases: ClaseUML[]
  relaciones: RelacionUML[]
}
