import type { ModeloUMLCanonico } from "../../../nucleo/modelo_uml/ModeloUMLCanonico"

export interface ResumenProyecto {
  id: string
  nombre: string
  creadoEn: string
  actualizadoEn: string
}

export interface Proyecto extends ResumenProyecto {
  modelo: ModeloUMLCanonico
}

