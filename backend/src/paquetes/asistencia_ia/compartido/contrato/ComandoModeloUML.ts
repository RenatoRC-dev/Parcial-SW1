export type MultiplicidadIA = "0..1" | "1" | "0..*" | "1..*"
export type VisibilidadIA = "publica" | "privada"

export interface AtributoModeloIA {
  id: string
  nombre: string
  tipo: string | null
  visibilidad?: VisibilidadIA
}

export interface ClaseModeloIA {
  id: string
  nombre: string
  atributos: AtributoModeloIA[]
  posicion: { x: number; y: number }
  abstracta: boolean
}

export interface RelacionModeloIA {
  id: string
  tipo: "asociacion" | "agregacion" | "composicion" | "generalizacion"
  claseOrigenId: string
  claseDestinoId: string
  multiplicidadOrigen: MultiplicidadIA | null
  multiplicidadDestino: MultiplicidadIA | null
  rolOrigen?: string
  rolDestino?: string
}

export interface ModeloUMLCanonicoIA {
  id: string
  nombre: string
  version: string
  clases: ClaseModeloIA[]
  relaciones: RelacionModeloIA[]
}

export type ComandoModeloUML =
  | { tipo: "crear_clase"; refTemporal: string; nombre: string; abstracta: boolean }
  | { tipo: "renombrar_clase"; claseId: string; nuevoNombre: string }
  | { tipo: "eliminar_clase"; claseId: string }
  | { tipo: "agregar_atributo"; claseRef: string; refTemporal: string; nombre: string; tipoDato: string; visibilidad: VisibilidadIA | null }
  | { tipo: "modificar_atributo"; atributoId: string; nuevoNombre: string | null; nuevoTipo: string | null; nuevaVisibilidad: VisibilidadIA | null }
  | { tipo: "eliminar_atributo"; atributoId: string }
  | { tipo: "crear_relacion"; refTemporal: string; claseOrigenRef: string; claseDestinoRef: string; tipoRelacion: "asociacion"; multiplicidadOrigen: MultiplicidadIA; multiplicidadDestino: MultiplicidadIA; rolOrigen: string | null; rolDestino: string | null }
  | { tipo: "eliminar_relacion"; relacionId: string }
  | { tipo: "cambiar_multiplicidad"; relacionId: string; multiplicidadOrigen: MultiplicidadIA; multiplicidadDestino: MultiplicidadIA }
