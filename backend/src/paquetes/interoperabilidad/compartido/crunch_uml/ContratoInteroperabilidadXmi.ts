export type MultiplicidadIntercambio = "0..1" | "1" | "0..*" | "1..*" | null

export interface AtributoIntercambio {
  id: string
  nombre: string
  tipo: string | null
  visibilidad?: "publica" | "privada"
}

export interface ParametroIntercambio { id: string; nombre: string; tipo: string }
export interface MetodoIntercambio {
  id: string
  nombre: string
  visibilidad: "publica" | "privada"
  tipoRetorno: string
  parametros: ParametroIntercambio[]
}

export interface ClaseIntercambio {
  id: string
  nombre: string
  atributos: AtributoIntercambio[]
  metodos?: MetodoIntercambio[]
  posicion: { x: number; y: number }
  abstracta: boolean
}

export interface RelacionIntercambio {
  id: string
  tipo: "asociacion" | "agregacion" | "composicion" | "generalizacion"
  /** Parte en agregacion/composicion; subclase en generalizacion. */
  claseOrigenId: string
  /** Todo en agregacion/composicion; superclase en generalizacion. */
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
