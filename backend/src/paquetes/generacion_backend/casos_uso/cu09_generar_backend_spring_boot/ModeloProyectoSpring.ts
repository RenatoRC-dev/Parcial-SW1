export interface CampoSpring {
  nombreCampo: string
  nombreColumna: string
  tipoJava: string
}

export interface EntidadSpring {
  nombreClase: string
  nombreVariable: string
  nombreTabla: string
  campos: CampoSpring[]
  importaciones: string[]
}

export interface ModeloProyectoSpring {
  groupId: string
  artifactId: string
  packageName: string
  javaVersion: 21
  springBootVersion: string
  entidades: EntidadSpring[]
}
