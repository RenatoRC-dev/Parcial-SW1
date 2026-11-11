import type { PasoIA } from "./ProcedenciaIA.js"
import type { RespuestaInterpretacionUMLHttp } from "../../asistencia_ia/compartido/contrato/PlanCambiosUML.js"
import type { ModeloUMLCanonicoIA } from "../../asistencia_ia/compartido/contrato/ComandoModeloUML.js"
import type { ConsultaMensajes, MensajeProyecto, PaginaMensajes } from "./MensajeProyecto.js"
import type { EstadoFlujo, FlujoAsistentePersistido } from "../../asistencia_contextual/compartido/FlujoAsistente.js"

export type EstadoAccionIAModelado = "planned" | "applied" | "failed"
export type OrigenAccionIAModelado = "direct" | "collaborative"

/** Metadato interno de idempotencia. Nunca forma parte del mensaje emitido al canal de aplicacion. */
export interface AccionIAModeladoPersistida {
  proposalMessageId?: string
  procedencia?: PasoIA[]
  actionId: string
  projectId: string
  requestId: string
  sourceMessageId: string
  requestingParticipantId: string
  origen: OrigenAccionIAModelado
  normalizedInstruction: string
  baseEditorRevision: number
  modeloBase: ModeloUMLCanonicoIA
  plan: RespuestaInterpretacionUMLHttp
  estado: EstadoAccionIAModelado
  creadoEn: string
  completadoEn: string | null
}

export interface RepositorioMensajes {
  reservarFlujo(flujo: FlujoAsistentePersistido): Promise<boolean>
  obtenerFlujo(projectId: string, requestId: string): Promise<FlujoAsistentePersistido | null>
  actualizarFlujo(flujo: FlujoAsistentePersistido, esperado: EstadoFlujo): Promise<boolean>
  buscarRecomendaciones(projectId: string, participantId: string, limite: number): Promise<Array<{ mensaje: MensajeProyecto; solicitud: MensajeProyecto }>>
  crear(mensaje: MensajeProyecto): Promise<MensajeProyecto>
  listarPorProyecto(consulta: ConsultaMensajes): Promise<PaginaMensajes>
  obtenerPorId(projectId: string, id: string): Promise<MensajeProyecto | null>
  obtenerPorRequestId(projectId: string, requestId: string, tipoRemitente: "human" | "ai"): Promise<MensajeProyecto | null>
  reservarAccionIA(accion: AccionIAModeladoPersistida): Promise<AccionIAModeladoPersistida>
  obtenerAccionIAPorId(projectId: string, actionId: string): Promise<AccionIAModeladoPersistida | null>
  obtenerAccionIAPorMensaje(projectId: string, sourceMessageId: string): Promise<AccionIAModeladoPersistida | null>
  completarAccionIA(projectId: string, actionId: string, participantId: string, estado: "applied" | "failed", completadoEn: string): Promise<{ accion: AccionIAModeladoPersistida | null; transicion: boolean }>
}

export class ErrorDatosMensajeCorruptos extends Error {}
export class ErrorPersistenciaMensaje extends Error {}
export class ErrorRequestMensajeDuplicado extends Error {}
