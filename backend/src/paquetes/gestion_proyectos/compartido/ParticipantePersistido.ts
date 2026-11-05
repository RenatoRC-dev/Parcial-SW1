export interface ParticipantePersistido {
  id: string
  proyectoId: string
  nombreVisible: string
  nombreNormalizado: string
  credencialDigest: string
  creadoEn: string
  ultimoAccesoEn: string
}

export type ParticipantePublico = Pick<ParticipantePersistido, "id" | "nombreVisible">
