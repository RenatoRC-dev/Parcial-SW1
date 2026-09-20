export const MULTIPLICIDADES_UML = ["1", "0..1", "0..*", "1..*"] as const
export type Multiplicidad = (typeof MULTIPLICIDADES_UML)[number]

export const TIPOS_RELACION_UML = ["asociacion", "agregacion", "composicion", "generalizacion"] as const
export type TipoRelacionUML = (typeof TIPOS_RELACION_UML)[number]

export const VISIBILIDADES_UML = ["privada", "publica"] as const
export type VisibilidadUML = (typeof VISIBILIDADES_UML)[number]

export const TIPOS_CLASE_UML = ["normal", "asociativa"] as const
export type TipoClaseUML = (typeof TIPOS_CLASE_UML)[number]

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

export interface ParametroUML {
  id: string
  nombre: string
  tipo: string
}

export interface MetodoUML {
  id: string
  nombre: string
  visibilidad: VisibilidadUML
  tipoRetorno: string
  parametros: ParametroUML[]
}

export interface ClaseUML {
  id: string
  nombre: string
  atributos: AtributoUML[]
  /** Optional only for compatibility with projects saved before method modeling. */
  metodos?: MetodoUML[]
  posicion: PosicionUML
  abstracta: boolean
  /** Ausente en proyectos legacy; se interpreta siempre como normal. */
  tipoClase?: TipoClaseUML
}

export function obtenerTipoClase(clase: Pick<ClaseUML, "tipoClase">): TipoClaseUML {
  return clase.tipoClase === "asociativa" ? "asociativa" : "normal"
}

export interface RelacionUML {
  id: string
  nombre?: string
  tipo: TipoRelacionUML
  /**
   * Convencion direccional canonica:
   * - asociacion: extremos A/B sin navegabilidad;
   * - agregacion/composicion: origen = parte, destino = todo;
   * - generalizacion: origen = subclase, destino = superclase.
   */
  claseOrigenId: string
  claseDestinoId: string
  /** Multiplicidad UML anotada junto a la clase origen. */
  multiplicidadOrigen: Multiplicidad | null
  /** Multiplicidad UML anotada junto a la clase destino. */
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
