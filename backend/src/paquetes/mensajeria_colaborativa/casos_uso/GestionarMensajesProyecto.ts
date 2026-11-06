import { randomUUID } from "node:crypto"
import type { ContextoAccesoProyecto } from "../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { ErrorProyectoNoEncontrado, type RepositorioProyectos } from "../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { MensajeProyecto, PaginaMensajes, RecomendacionMensajeIA } from "../compartido/MensajeProyecto.js"
import { ErrorRequestMensajeDuplicado, type RepositorioMensajes } from "../compartido/RepositorioMensajes.js"

export class ErrorMensajeInvalido extends Error {}
export class ErrorConflictoRequestMensaje extends Error {}
const MAXIMO_CONTENIDO = 8_000
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class GestionarMensajesProyecto {
  constructor(private readonly mensajes: RepositorioMensajes, private readonly proyectos: RepositorioProyectos) {}

  async registrarMensajeHumano(contexto: ContextoAccesoProyecto, contenido: string, opciones: {
    requestId?: string; replyToMessageId?: string; elementosRelacionadosIds?: string[]
  } = {}): Promise<MensajeProyecto> {
    return this.registrar(contexto.projectId, "human", contexto.participantId, contexto.displayName, contenido, opciones)
  }

  async registrarMensajeIA(projectId: string, contenido: string, opciones: {
    requestId?: string; replyToMessageId?: string; elementosRelacionadosIds?: string[]; recomendacion?: RecomendacionMensajeIA | null
  } = {}): Promise<MensajeProyecto> {
    return this.registrar(projectId, "ai", null, "Asistente", contenido, opciones)
  }

  async listarRecientes(projectId: string, limite = 30): Promise<PaginaMensajes> {
    return this.mensajes.listarPorProyecto({ projectId, limite: Math.min(Math.max(limite, 1), 100) })
  }

  async obtenerPorRequestId(projectId: string, requestId: string, tipo: "human" | "ai"): Promise<MensajeProyecto | null> {
    if (!PATRON_UUID.test(requestId)) throw new ErrorMensajeInvalido("El requestId no es válido.")
    return this.mensajes.obtenerPorRequestId(projectId, requestId, tipo)
  }

  async registrarMensajeHumanoIdempotente(contexto: ContextoAccesoProyecto, contenido: string, requestId: string, elementosRelacionadosIds: string[] = []): Promise<{ mensaje: MensajeProyecto; creado: boolean }> {
    if (!PATRON_UUID.test(requestId)) throw new ErrorMensajeInvalido("El requestId no es válido.")
    const limpio = contenido?.trim() ?? ""
    const existente = await this.mensajes.obtenerPorRequestId(contexto.projectId, requestId, "human")
    if (existente) {
      if (existente.contenido !== limpio || existente.participantId !== contexto.participantId) {
        throw new ErrorConflictoRequestMensaje("El requestId ya fue utilizado con otra pregunta.")
      }
      return { mensaje: existente, creado: false }
    }
    try {
      return { mensaje: await this.registrarMensajeHumano(contexto, limpio, { requestId, elementosRelacionadosIds }), creado: true }
    } catch (error) {
      if (error instanceof ErrorRequestMensajeDuplicado) {
        const repetido = await this.mensajes.obtenerPorRequestId(contexto.projectId, requestId, "human")
        if (repetido && repetido.contenido === limpio && repetido.participantId === contexto.participantId) return { mensaje: repetido, creado: false }
        throw new ErrorConflictoRequestMensaje("El requestId ya fue utilizado con otra pregunta.")
      }
      throw error
    }
  }

  async registrarMensajeIAIdempotente(projectId: string, contenido: string, requestId: string, replyToMessageId: string, elementosRelacionadosIds: string[] = [], recomendacion: RecomendacionMensajeIA | null = null): Promise<{ mensaje: MensajeProyecto; creado: boolean }> {
    if (!PATRON_UUID.test(requestId)) throw new ErrorMensajeInvalido("El requestId no es válido.")
    const existente = await this.mensajes.obtenerPorRequestId(projectId, requestId, "ai")
    if (existente) return { mensaje: existente, creado: false }
    try {
      return { mensaje: await this.registrarMensajeIA(projectId, contenido, { requestId, replyToMessageId, elementosRelacionadosIds, recomendacion }), creado: true }
    } catch (error) {
      if (error instanceof ErrorRequestMensajeDuplicado) {
        const repetido = await this.mensajes.obtenerPorRequestId(projectId, requestId, "ai")
        if (repetido) return { mensaje: repetido, creado: false }
      }
      throw error
    }
  }

  private async registrar(
    projectId: string, tipoRemitente: "human" | "ai", participantId: string | null,
    nombreVisibleSnapshot: string | null, contenido: string,
    opciones: { requestId?: string; replyToMessageId?: string; elementosRelacionadosIds?: string[]; recomendacion?: RecomendacionMensajeIA | null },
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
      elementosRelacionadosIds: [...ids], ...(tipoRemitente === "ai" ? { recomendacion: opciones.recomendacion ?? null } : {}), revisionModeloObservada: proyecto.revisionModelo,
      creadoEn: new Date().toISOString(),
    })
  }
}
