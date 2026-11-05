import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"

export interface ProyectoPersistido {
  id: string
  nombre: string
  creadoEn: string
  actualizadoEn: string
  /** Versión durable del snapshot; no representa cambios efímeros de Yjs. */
  revisionModelo: number
  modelo: ModeloUMLCanonicoIntercambio
}

export type ResumenProyecto = Omit<ProyectoPersistido, "modelo">

