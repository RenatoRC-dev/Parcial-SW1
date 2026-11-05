import type express from "express"

export interface ContextoAccesoProyecto {
  projectId: string
  participantId: string
  displayName: string
}

export type SolicitudConAccesoProyecto = express.Request & { accesoProyecto: ContextoAccesoProyecto }
