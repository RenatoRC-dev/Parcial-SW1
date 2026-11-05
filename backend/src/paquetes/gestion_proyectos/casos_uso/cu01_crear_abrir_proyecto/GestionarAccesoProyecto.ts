import { randomUUID } from "node:crypto"
import type { ProtegerAccesoProyecto } from "../../acceso/ProtegerAccesoProyecto.js"
import { ErrorFormatoCodigoAcceso } from "../../acceso/ProtegerAccesoProyecto.js"
import type { ParticipantePersistido, ParticipantePublico } from "../../compartido/ParticipantePersistido.js"
import {
  ErrorCredencialParticipanteDuplicada,
  type RepositorioParticipantes,
} from "../../compartido/RepositorioParticipantes.js"
import {
  ErrorCodigoAccesoDuplicado,
  type RepositorioProyectos,
} from "../../compartido/RepositorioProyectos.js"
import type { ProyectoPersistido } from "../../compartido/ProyectoPersistido.js"
import { crearProyecto } from "./GestionarProyectos.js"

const MAXIMO_INTENTOS_COLISION = 5
const PATRON_CONTROLES = /[\u0000-\u001F\u007F]/

export class ErrorNombreParticipanteInvalido extends Error {}
export class ErrorCodigoProyectoInvalido extends Error {}
export class ErrorCreacionAccesoProyecto extends Error {}

export interface AccesoProyectoCreado {
  proyecto: ProyectoPersistido
  participante: ParticipantePublico
  codigoAcceso: string
  credencial: string
}

export type AccesoProyectoUnido = Omit<AccesoProyectoCreado, "codigoAcceso">

export function normalizarNombreParticipante(nombreSolicitado: unknown): { visible: string; normalizado: string } {
  if (typeof nombreSolicitado !== "string") throw new ErrorNombreParticipanteInvalido("Se requiere un nombre de participante.")
  const visible = nombreSolicitado.trim().replace(/\s+/g, " ")
  if (visible.length < 1 || visible.length > 60 || PATRON_CONTROLES.test(visible)) {
    throw new ErrorNombreParticipanteInvalido("El nombre del participante debe tener entre 1 y 60 caracteres y no contener controles.")
  }
  const normalizado = visible.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
  if (!normalizado) throw new ErrorNombreParticipanteInvalido("El nombre del participante no es válido.")
  return { visible, normalizado }
}

export async function crearProyectoConAcceso(
  proyectos: RepositorioProyectos,
  participantes: RepositorioParticipantes,
  protector: ProtegerAccesoProyecto,
  nombreProyecto: string,
  nombreParticipante: unknown,
): Promise<AccesoProyectoCreado> {
  const nombre = normalizarNombreParticipante(nombreParticipante)
  let codigoAcceso = ""
  let proyecto: ProyectoPersistido | null = null

  for (let intento = 0; intento < MAXIMO_INTENTOS_COLISION; intento += 1) {
    codigoAcceso = protector.generarCodigoAcceso()
    try {
      proyecto = await crearProyecto(proyectos, nombreProyecto, protector.obtenerDigestCodigo(codigoAcceso))
      break
    } catch (error) {
      if (!(error instanceof ErrorCodigoAccesoDuplicado)) throw error
    }
  }
  if (!proyecto) throw new ErrorCreacionAccesoProyecto("No se pudo generar un código de acceso único.")

  try {
    const { participante, credencial } = await crearParticipante(participantes, protector, proyecto.id, nombre)
    return { proyecto, participante: publicarParticipante(participante), codigoAcceso, credencial }
  } catch (error) {
    try {
      await proyectos.eliminar(proyecto.id)
    } catch {
      throw new ErrorCreacionAccesoProyecto("Falló la creación del participante y no se pudo compensar el proyecto.", { cause: error })
    }
    throw error
  }
}

export async function unirseAProyecto(
  proyectos: RepositorioProyectos,
  participantes: RepositorioParticipantes,
  protector: ProtegerAccesoProyecto,
  codigoSolicitado: unknown,
  nombreParticipante: unknown,
): Promise<AccesoProyectoUnido> {
  if (typeof codigoSolicitado !== "string") throw new ErrorCodigoProyectoInvalido("El código de proyecto no es válido.")
  const nombre = normalizarNombreParticipante(nombreParticipante)
  let digest: string
  try {
    digest = protector.obtenerDigestCodigo(codigoSolicitado)
  } catch (error) {
    if (error instanceof ErrorFormatoCodigoAcceso) throw new ErrorCodigoProyectoInvalido("El código de proyecto no es válido.")
    throw error
  }
  const proyecto = await proyectos.buscarPorCodigoAccesoDigest(digest)
  if (!proyecto) throw new ErrorCodigoProyectoInvalido("El código de proyecto no es válido.")
  const { participante, credencial } = await crearParticipante(participantes, protector, proyecto.id, nombre)
  return { proyecto, participante: publicarParticipante(participante), credencial }
}

async function crearParticipante(
  repositorio: RepositorioParticipantes,
  protector: ProtegerAccesoProyecto,
  proyectoId: string,
  nombre: { visible: string; normalizado: string },
): Promise<{ participante: ParticipantePersistido; credencial: string }> {
  for (let intento = 0; intento < MAXIMO_INTENTOS_COLISION; intento += 1) {
    const credencial = protector.generarCredencialParticipante()
    const ahora = new Date().toISOString()
    try {
      const participante = await repositorio.crear({
        id: randomUUID(), proyectoId, nombreVisible: nombre.visible, nombreNormalizado: nombre.normalizado,
        credencialDigest: protector.obtenerDigestCredencial(credencial), creadoEn: ahora, ultimoAccesoEn: ahora,
      })
      return { participante, credencial }
    } catch (error) {
      if (!(error instanceof ErrorCredencialParticipanteDuplicada)) throw error
    }
  }
  throw new ErrorCreacionAccesoProyecto("No se pudo generar una credencial única.")
}

function publicarParticipante(participante: ParticipantePersistido): ParticipantePublico {
  return { id: participante.id, nombreVisible: participante.nombreVisible }
}
