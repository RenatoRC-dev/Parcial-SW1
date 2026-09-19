export interface AtributoUMLEntrada {
  id: string
  nombre: string
  tipo: string | null
}

export interface ParametroUMLEntrada { id: string; nombre: string; tipo: string }
export interface MetodoUMLEntrada {
  id: string
  nombre: string
  visibilidad: "publica" | "privada"
  tipoRetorno: string
  parametros: ParametroUMLEntrada[]
}

export interface ClaseUMLEntrada {
  id: string
  nombre: string
  atributos: AtributoUMLEntrada[]
  metodos?: MetodoUMLEntrada[]
  abstracta: boolean
}

export interface RelacionUMLEntrada {
  id: string
  nombre?: string
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
