import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"

export interface ProyectoPersistido {
  id: string
  nombre: string
  creadoEn: string
  actualizadoEn: string
  modelo: ModeloUMLCanonicoIntercambio
}

export type ResumenProyecto = Omit<ProyectoPersistido, "modelo">

