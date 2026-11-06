import { randomUUID } from "node:crypto"
import type { ContextoAccesoProyecto } from "../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import type { RepositorioProyectos } from "../../gestion_proyectos/compartido/RepositorioProyectos.js"
import { ErrorProyectoNoEncontrado } from "../../gestion_proyectos/compartido/RepositorioProyectos.js"
import { TIPOS_ELEMENTO_UML, type EventoProyecto, type MecanismoEvento, type ReferenciaElementoEvento, type TipoEventoProyecto } from "../compartido/EventoProyecto.js"
import { ErrorClientChangeIdDuplicado, type RepositorioEventos } from "../compartido/RepositorioEventos.js"

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CAMPOS_DETALLE = new Set(["campo", "elementoPadreId"])
export class ErrorActividadInvalida extends Error {}

export interface SolicitudActividadManual {
  clientChangeId: string
  tipo: "UML_ELEMENT_CREATED" | "UML_ELEMENT_UPDATED" | "UML_ELEMENT_DELETED"
  elemento: ReferenciaElementoEvento
  detalle?: Record<string, unknown>
}

export interface SolicitudActividadIntegracion {
  clientChangeId: string
  mecanismo: "image_cu05" | "xmi"
  tipo: "UML_ELEMENT_CREATED" | "XMI_IMPORTED"
  elemento: ReferenciaElementoEvento | null
}

export interface CambioAplicadoIA {
  commandIndex: number
  tipo: "UML_ELEMENT_CREATED" | "UML_ELEMENT_UPDATED" | "UML_ELEMENT_DELETED"
  elemento: ReferenciaElementoEvento
}

function validarElemento(elemento: ReferenciaElementoEvento): ReferenciaElementoEvento {
  if (!elemento || typeof elemento.id !== "string" || !elemento.id.trim() || elemento.id.length > 160
    || !TIPOS_ELEMENTO_UML.includes(elemento.tipo)
    || typeof elemento.nombreSnapshot !== "string" || !elemento.nombreSnapshot.trim() || elemento.nombreSnapshot.length > 120) {
    throw new ErrorActividadInvalida("La referencia del elemento UML no es válida.")
  }
  return { id: elemento.id.trim(), tipo: elemento.tipo, nombreSnapshot: elemento.nombreSnapshot.trim() }
}

function validarDetalle(detalle: Record<string, unknown> | undefined): Record<string, string> {
  if (!detalle) return {}
  const salida: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(detalle)) {
    if (!CAMPOS_DETALLE.has(clave) || typeof valor !== "string" || valor.length > 160) {
      throw new ErrorActividadInvalida("El detalle de actividad no es válido.")
    }
    salida[clave] = valor
  }
  return salida
}

export class RegistrarActividadProyecto {
  constructor(private readonly eventos: RepositorioEventos, private readonly proyectos: RepositorioProyectos) {}

  async registrarManual(contexto: ContextoAccesoProyecto, solicitud: SolicitudActividadManual): Promise<EventoProyecto> {
    if (!esUuid(solicitud.clientChangeId) || !["UML_ELEMENT_CREATED", "UML_ELEMENT_UPDATED", "UML_ELEMENT_DELETED"].includes(solicitud.tipo)) {
      throw new ErrorActividadInvalida("La actividad manual no tiene un contrato válido.")
    }
    const existente = await this.eventos.obtenerPorClientChangeId(contexto.projectId, solicitud.clientChangeId)
    if (existente) return existente
    const proyecto = await this.proyectos.obtenerPorId(contexto.projectId)
    if (!proyecto) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
    const evento = this.construir({
      contexto, tipo: solicitud.tipo, mecanismo: "manual", elemento: validarElemento(solicitud.elemento),
      detalle: validarDetalle(solicitud.detalle), revision: proyecto.revisionModelo,
      clientChangeId: solicitud.clientChangeId,
    })
    try { return await this.eventos.crear(evento) }
    catch (error) {
      if (error instanceof ErrorClientChangeIdDuplicado) {
        const repetido = await this.eventos.obtenerPorClientChangeId(contexto.projectId, solicitud.clientChangeId)
        if (repetido) return repetido
      }
      throw error
    }
  }

  async registrarSistema(entrada: {
    contexto: ContextoAccesoProyecto
    tipo: "PROJECT_CREATED" | "PARTICIPANT_JOINED" | "MODEL_SAVED"
    revision: number
  }): Promise<EventoProyecto> {
    return this.eventos.crear(this.construir({ ...entrada, mecanismo: "system", elemento: null, detalle: {}, clientChangeId: null }))
  }

  async registrarIntegracion(contexto: ContextoAccesoProyecto, solicitud: SolicitudActividadIntegracion): Promise<EventoProyecto> {
    const esImagenValida = solicitud.mecanismo === "image_cu05" && solicitud.tipo === "UML_ELEMENT_CREATED" && solicitud.elemento !== null
    const esXmiValido = solicitud.mecanismo === "xmi" && solicitud.tipo === "XMI_IMPORTED" && solicitud.elemento === null
    if (!esUuid(solicitud.clientChangeId) || (!esImagenValida && !esXmiValido)) {
      throw new ErrorActividadInvalida("La actividad de integracion no tiene un contrato valido.")
    }
    const existente = await this.eventos.obtenerPorClientChangeId(contexto.projectId, solicitud.clientChangeId)
    if (existente) return existente
    const proyecto = await this.proyectos.obtenerPorId(contexto.projectId)
    if (!proyecto) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
    const evento = this.construir({
      contexto, tipo: solicitud.tipo, mecanismo: solicitud.mecanismo,
      elemento: solicitud.elemento ? validarElemento(solicitud.elemento) : null,
      detalle: {}, revision: proyecto.revisionModelo, clientChangeId: solicitud.clientChangeId,
    })
    try { return await this.eventos.crear(evento) }
    catch (error) {
      if (error instanceof ErrorClientChangeIdDuplicado) {
        const repetido = await this.eventos.obtenerPorClientChangeId(contexto.projectId, solicitud.clientChangeId)
        if (repetido) return repetido
      }
      throw error
    }
  }

  async registrarIA(contexto: ContextoAccesoProyecto, actionId: string, sourceMessageId: string | null, cambios: CambioAplicadoIA[]): Promise<EventoProyecto[]> {
    const proyecto = await this.proyectos.obtenerPorId(contexto.projectId)
    if (!proyecto) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
    const salida: EventoProyecto[] = []
    for (const cambio of cambios) {
      const evento = this.construir({ contexto, tipo: cambio.tipo, mecanismo: "ai_cu04", elemento: validarElemento(cambio.elemento),
        detalle: { actionId, commandIndex: String(cambio.commandIndex) }, revision: proyecto.revisionModelo,
        clientChangeId: `${actionId}:${cambio.commandIndex}`, sourceMessageId })
      try { salida.push(await this.eventos.crear(evento)) }
      catch (error) {
        if (error instanceof ErrorClientChangeIdDuplicado) {
          const repetido = await this.eventos.obtenerPorClientChangeId(contexto.projectId, evento.clientChangeId!)
          if (repetido) { salida.push(repetido); continue }
        }
        throw error
      }
    }
    return salida
  }

  private construir(entrada: {
    contexto: ContextoAccesoProyecto; tipo: TipoEventoProyecto; mecanismo: MecanismoEvento
    elemento: ReferenciaElementoEvento | null; detalle: Record<string, string>; revision: number; clientChangeId: string | null; sourceMessageId?: string | null
  }): EventoProyecto {
    return {
      id: randomUUID(), projectId: entrada.contexto.projectId, tipo: entrada.tipo,
      solicitadoPorParticipantId: entrada.contexto.participantId,
      nombreParticipanteSnapshot: entrada.contexto.displayName,
      mecanismo: entrada.mecanismo, elemento: entrada.elemento, detalle: entrada.detalle,
      revisionModeloObservada: entrada.revision, clientChangeId: entrada.clientChangeId,
      sourceMessageId: entrada.sourceMessageId ?? null, creadoEn: new Date().toISOString(),
    }
  }
}

function esUuid(valor: unknown): valor is string { return typeof valor === "string" && PATRON_UUID.test(valor) }
