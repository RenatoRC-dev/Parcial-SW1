import { randomUUID } from "node:crypto"
import type { ContextoAccesoProyecto } from "../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { ErrorProyectoNoEncontrado, type RepositorioProyectos } from "../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { MensajeProyecto, PaginaMensajes } from "../compartido/MensajeProyecto.js"
import type { RepositorioMensajes } from "../compartido/RepositorioMensajes.js"

export class ErrorMensajeInvalido extends Error {}
const MAXIMO_CONTENIDO = 8_000

export class GestionarMensajesProyecto {
  constructor(private readonly mensajes: RepositorioMensajes, private readonly proyectos: RepositorioProyectos) {}

  async registrarMensajeHumano(contexto: ContextoAccesoProyecto, contenido: string, opciones: {
    requestId?: string; replyToMessageId?: string; elementosRelacionadosIds?: string[]
  } = {}): Promise<MensajeProyecto> {
    return this.registrar(contexto.projectId, "human", contexto.participantId, contexto.displayName, contenido, opciones)
  }

  async registrarMensajeIA(projectId: string, contenido: string, opciones: {
    requestId?: string; replyToMessageId?: string; elementosRelacionadosIds?: string[]
  } = {}): Promise<MensajeProyecto> {
    return this.registrar(projectId, "ai", null, "Asistente", contenido, opciones)
  }

  async listarRecientes(projectId: string, limite = 30): Promise<PaginaMensajes> {
    return this.mensajes.listarPorProyecto({ projectId, limite: Math.min(Math.max(limite, 1), 100) })
  }

  private async registrar(
    projectId: string, tipoRemitente: "human" | "ai", participantId: string | null,
    nombreVisibleSnapshot: string | null, contenido: string,
    opciones: { requestId?: string; replyToMessageId?: string; elementosRelacionadosIds?: string[] },
  ): Promise<MensajeProyecto> {
    const limpio = contenido?.trim()
    if (!limpio || limpio.length > MAXIMO_CONTENIDO) throw new ErrorMensajeInvalido("El mensaje debe contener entre 1 y 8000 caracteres.")
    const ids = opciones.elementosRelacionadosIds ?? []
    if (ids.length > 50 || ids.some((id) => typeof id !== "string" || !id || id.length > 160)) throw new ErrorMensajeInvalido("Los elementos relacionados no son válidos.")
    const proyecto = await this.proyectos.obtenerPorId(projectId)
    if (!proyecto) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
    return this.mensajes.crear({
      id: randomUUID(), projectId, tipoRemitente, participantId, nombreVisibleSnapshot,
      contenido: limpio, requestId: opciones.requestId ?? null, replyToMessageId: opciones.replyToMessageId ?? null,
      elementosRelacionadosIds: [...ids], revisionModeloObservada: proyecto.revisionModelo,
      creadoEn: new Date().toISOString(),
    })
  }
}
