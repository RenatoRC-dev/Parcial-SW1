export interface CampoSpring {
  nombreCampo: string
  nombreColumna: string
  tipoJava: string
}

export interface RelacionMuchosAUnoSpring {
  nombreCampo: string
  entidadObjetivo: string
  nombreColumna: string
  campoMapsId?: string
}

export interface RelacionUnoAMuchosSpring {
  nombreCampo: string
  entidadObjetivo: string
  mappedBy: string
}

export interface EntidadSpring {
  nombreClase: string
  nombreVariable: string
  nombreTabla: string
  campos: CampoSpring[]
  relacionesMuchosAUno: RelacionMuchosAUnoSpring[]
  relacionesUnoAMuchos: RelacionUnoAMuchosSpring[]
  importaciones: string[]
  tipoId: string
  esAsociativa: boolean
  claveCompuesta?: ClaveCompuestaSpring
}

export interface CampoClaveCompuestaSpring {
  nombreCampo: string
  nombreColumna: string
}

export interface ClaveCompuestaSpring {
  nombreClase: string
  campos: CampoClaveCompuestaSpring[]
}

export interface ModeloProyectoSpring {
  groupId: string
  artifactId: string
  packageName: string
  javaVersion: 21
  springBootVersion: string
  entidades: EntidadSpring[]
}
