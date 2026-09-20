export type MultiplicidadIA = "0..1" | "1" | "0..*" | "1..*"
export type VisibilidadIA = "publica" | "privada"

export const TIPOS_UML_SOPORTADOS_IA = [
  "String", "Integer", "int", "Long", "long", "Decimal", "BigDecimal",
  "Double", "double", "Float", "float", "Boolean", "boolean", "Date",
  "LocalDate", "DateTime", "LocalDateTime", "UUID",
] as const

export interface AtributoModeloIA {
  id: string
  nombre: string
  tipo: string | null
  visibilidad?: VisibilidadIA
}

export interface ParametroModeloIA {
  id: string
  nombre: string
  tipo: string
}

export interface MetodoModeloIA {
  id: string
  nombre: string
  visibilidad: VisibilidadIA
  tipoRetorno: string
  parametros: ParametroModeloIA[]
}

export interface ClaseModeloIA {
  id: string
  nombre: string
  atributos: AtributoModeloIA[]
  metodos?: MetodoModeloIA[]
  posicion: { x: number; y: number }
  abstracta: boolean
}

export interface RelacionModeloIA {
  id: string
  tipo: "asociacion" | "agregacion" | "composicion" | "generalizacion"
  claseOrigenId: string
  claseDestinoId: string
  /** Multiplicidad UML del extremo ubicado junto a la clase origen. */
  multiplicidadOrigen: MultiplicidadIA | null
  /** Multiplicidad UML del extremo ubicado junto a la clase destino. */
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

type ComandoCrearRelacion =
  | { tipo: "crear_relacion"; refTemporal: string; tipoRelacion: "asociacion"; claseOrigenRef: string; claseDestinoRef: string; cantidadDestinoPorOrigen: MultiplicidadIA | null; cantidadOrigenPorDestino: MultiplicidadIA | null; rolOrigen: string | null; rolDestino: string | null }
  | { tipo: "crear_relacion"; refTemporal: string; tipoRelacion: "agregacion" | "composicion"; parteRef: string; todoRef: string; cantidadPartesPorTodo: MultiplicidadIA | null; cantidadTodosPorParte: MultiplicidadIA | null; rolParte: string | null; rolTodo: string | null }
  | { tipo: "crear_relacion"; refTemporal: string; tipoRelacion: "generalizacion"; subclaseRef: string; superclaseRef: string }

export type ComandoModeloUML =
  | { tipo: "crear_clase"; refTemporal: string; nombre: string; abstracta: boolean }
  | { tipo: "renombrar_clase"; claseId: string; nuevoNombre: string }
  | { tipo: "eliminar_clase"; claseId: string }
  | { tipo: "agregar_atributo"; claseRef: string; refTemporal: string; nombre: string; tipoDato: string; visibilidad: VisibilidadIA | null }
  | { tipo: "modificar_atributo"; atributoId: string; nuevoNombre: string | null; nuevoTipo: string | null; nuevaVisibilidad: VisibilidadIA | null }
  | { tipo: "eliminar_atributo"; atributoId: string }
  | { tipo: "crear_metodo"; claseRef: string; refTemporal: string; nombre: string; tipoRetorno: string; visibilidad: VisibilidadIA; parametros: Array<{ refTemporal: string; nombre: string; tipo: string }> }
  | { tipo: "modificar_metodo"; metodoId: string; nuevoNombre: string | null; nuevoTipoRetorno: string | null; nuevaVisibilidad: VisibilidadIA | null }
  | { tipo: "eliminar_metodo"; metodoId: string }
  | { tipo: "agregar_parametro"; metodoId: string; refTemporal: string; nombre: string; tipoDato: string }
  | { tipo: "modificar_parametro"; parametroId: string; nuevoNombre: string | null; nuevoTipo: string | null }
  | { tipo: "eliminar_parametro"; parametroId: string }
  | ComandoCrearRelacion
  | { tipo: "eliminar_relacion"; relacionId: string }
  | { tipo: "cambiar_multiplicidad"; relacionId: string; cantidadDestinoPorOrigen: MultiplicidadIA; cantidadOrigenPorDestino: MultiplicidadIA }
