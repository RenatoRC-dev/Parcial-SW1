import type { ParticipantePersistido } from "../compartido/ParticipantePersistido.js"
import { ErrorCredencialParticipanteDuplicada, type RepositorioParticipantes } from "../compartido/RepositorioParticipantes.js"

export class RepositorioParticipantesMemoria implements RepositorioParticipantes {
  private readonly participantes = new Map<string, ParticipantePersistido>()

  async crear(participante: ParticipantePersistido): Promise<ParticipantePersistido> {
    if ([...this.participantes.values()].some((actual) => actual.credencialDigest === participante.credencialDigest)) {
      throw new ErrorCredencialParticipanteDuplicada("La credencial ya existe.")
    }
    this.participantes.set(participante.id, structuredClone(participante))
    return structuredClone(participante)
  }

  async obtenerPorCredencialDigest(digest: string): Promise<ParticipantePersistido | null> {
    const encontrado = [...this.participantes.values()].find((participante) => participante.credencialDigest === digest)
    return encontrado ? structuredClone(encontrado) : null
  }

  async obtenerPorId(id: string): Promise<ParticipantePersistido | null> {
    const encontrado = this.participantes.get(id)
    return encontrado ? structuredClone(encontrado) : null
  }
}
