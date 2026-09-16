export interface AtributoUMLEntrada {
  id: string
  nombre: string
  tipo: string | null
}

export interface ClaseUMLEntrada {
  id: string
  nombre: string
  atributos: AtributoUMLEntrada[]
  abstracta: boolean
}

export interface RelacionUMLEntrada {
  id: string
  tipo: "asociacion" | "agregacion" | "composicion" | "generalizacion"
  claseOrigenId: string
  claseDestinoId: string
  multiplicidadOrigen: "0..1" | "1" | "0..*" | "1..*" | null
  multiplicidadDestino: "0..1" | "1" | "0..*" | "1..*" | null
  rolOrigen?: string
  rolDestino?: string
}

export interface ModeloUMLCanonicoEntrada {
  id: string
  nombre: string
  version: string
  clases: ClaseUMLEntrada[]
  relaciones: RelacionUMLEntrada[]
}
