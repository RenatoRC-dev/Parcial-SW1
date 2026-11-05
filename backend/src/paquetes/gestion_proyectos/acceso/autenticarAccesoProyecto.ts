import type { ContextoAccesoProyecto } from "../api/ContextoAccesoProyecto.js"
import type { RepositorioParticipantes } from "../compartido/RepositorioParticipantes.js"
import type { RepositorioProyectos } from "../compartido/RepositorioProyectos.js"
import type { ProtegerAccesoProyecto } from "./ProtegerAccesoProyecto.js"

export class ErrorCredencialProyectoInvalida extends Error {}
export class ErrorAccesoProyectoDenegado extends Error {}
export class ErrorProyectoAccesoNoEncontrado extends Error {}

/**
 * Autentica una credencial opaca contra el participante durable y su proyecto.
 * Es la frontera compartida por HTTP y WebSocket; nunca confía en identidad enviada
 * como texto por el cliente.
 */
export async function autenticarAccesoProyecto(
  proyectos: RepositorioProyectos,
  participantes: RepositorioParticipantes,
  protector: ProtegerAccesoProyecto,
  projectId: string,
  credencial: string,
): Promise<ContextoAccesoProyecto> {
  if (!protector.esCredencialConFormatoValido(credencial)) {
    throw new ErrorCredencialProyectoInvalida("La credencial de proyecto no es válida.")
  }
  const participante = await participantes.obtenerPorCredencialDigest(protector.obtenerDigestCredencial(credencial))
  if (!participante) throw new ErrorCredencialProyectoInvalida("La credencial de proyecto no es válida.")
  if (participante.proyectoId !== projectId) {
    throw new ErrorAccesoProyectoDenegado("La credencial no autoriza este proyecto.")
  }
  if (!await proyectos.obtenerPorId(projectId)) {
    throw new ErrorProyectoAccesoNoEncontrado("Proyecto no encontrado.")
  }
  return {
    projectId,
    participantId: participante.id,
    displayName: participante.nombreVisible,
  }
}
