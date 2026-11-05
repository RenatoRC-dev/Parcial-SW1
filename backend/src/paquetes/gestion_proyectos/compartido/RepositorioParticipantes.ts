import type { ParticipantePersistido } from "./ParticipantePersistido.js"

export interface RepositorioParticipantes {
  crear(participante: ParticipantePersistido): Promise<ParticipantePersistido>
  obtenerPorCredencialDigest(digest: string): Promise<ParticipantePersistido | null>
  obtenerPorId(id: string): Promise<ParticipantePersistido | null>
}

export class ErrorDatosParticipanteCorruptos extends Error {}
export class ErrorPersistenciaParticipante extends Error {}
export class ErrorCredencialParticipanteDuplicada extends Error {}
