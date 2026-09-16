export type MultiplicidadIntercambio = "0..1" | "1" | "0..*" | "1..*" | null

export interface AtributoIntercambio {
  id: string
  nombre: string
  tipo: string | null
  visibilidad?: "publica" | "privada"
}

export interface ClaseIntercambio {
  id: string
  nombre: string
  atributos: AtributoIntercambio[]
  posicion: { x: number; y: number }
  abstracta: boolean
}

export interface RelacionIntercambio {
  id: string
  tipo: "asociacion" | "agregacion" | "composicion" | "generalizacion"
  claseOrigenId: string
  claseDestinoId: string
  multiplicidadOrigen: MultiplicidadIntercambio
  multiplicidadDestino: MultiplicidadIntercambio
  rolOrigen?: string
  rolDestino?: string
}

export interface ModeloUMLCanonicoIntercambio {
  id: string
  nombre: string
  version: string
  clases: ClaseIntercambio[]
  relaciones: RelacionIntercambio[]
}

export interface AdvertenciaInteroperabilidad {
  codigo: string
  mensaje: string
  elementoId?: string
}

export interface ResultadoImportacionXmi {
  modelo: ModeloUMLCanonicoIntercambio
  advertencias: AdvertenciaInteroperabilidad[]
}
