import type { ModeloUMLCanonico } from "../../../nucleo/modelo_uml/ModeloUMLCanonico"

export interface ResumenProyecto {
  id: string
  nombre: string
  creadoEn: string
  actualizadoEn: string
  revisionModelo: number
}

export interface Proyecto extends ResumenProyecto {
  modelo: ModeloUMLCanonico
}

export interface ParticipanteProyecto {
  id: string
  nombreVisible: string
}

export interface AccesoProyectoActivo {
  projectId: string
  participantId: string
  displayName: string
  credential: string
}

export interface RespuestaCrearProyecto {
  proyecto: Proyecto
  participante: ParticipanteProyecto
  codigoAcceso: string
  credencial: string
}

export interface RespuestaUnirseProyecto {
  proyecto: Proyecto
  participante: ParticipanteProyecto
  credencial: string
}

