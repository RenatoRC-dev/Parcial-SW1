import { randomUUID } from "node:crypto"
import type { ContextoAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { GestionarMensajesProyecto } from "../../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import type { MensajeProyecto, RecomendacionMensajeIA } from "../../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import type { AccionIAModeladoPersistida, RepositorioMensajes } from "../../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import type { PublicadorMensajesProyecto } from "../../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"
import type { ProveedorModeloLenguaje } from "../../../asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import { interpretarInstruccionModelado } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/interpretarInstruccionModelado.js"
import type { PreguntaAsistenteColaborativo } from "../../compartido/ContratoPreguntaColaborativa.js"
import type { ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { AsistirColaborativamente } from "./AsistirColaborativamente.js"
import type { ConstruirContextoAsistenteColaborativo } from "./ConstruirContextoAsistenteColaborativo.js"

export type IntencionInteraccionIA = "PRODUCT_QUERY" | "CONCEPTUAL_QUERY" | "MODEL_QUERY" | "ACTIVITY_QUERY" | "REVIEW_REQUEST" | "EXPLICIT_MODIFICATION" | "CONTEXTUAL_MODIFICATION" | "CLARIFICATION_REQUIRED"

export type ResultadoOrquestacion =
  | { kind: "advisory"; intent: IntencionInteraccionIA; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }
  | { kind: "clarification"; intent: "CLARIFICATION_REQUIRED"; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }
  | { kind: "action"; intent: "EXPLICIT_MODIFICATION" | "CONTEXTUAL_MODIFICATION"; mensajeHumano: MensajeProyecto; actionId: string; sourceMessageId: string; normalizedInstruction: string; plan: AccionIAModeladoPersistida["plan"]; baseEditorRevision: number }
  | { kind: "action_already_applied"; mensajeHumano: MensajeProyecto; actionId: string; mensajeIA: MensajeProyecto | null }
  | { kind: "action_already_finished"; mensajeHumano: MensajeProyecto; actionId: string; mensajeIA: MensajeProyecto | null }

function normalizar(texto: string): string { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/^[¿?¡!\s]+/, "") }

export function clasificarIntencionInteraccion(texto: string): IntencionInteraccionIA {
  const entrada = normalizar(texto)
  if (/\b(que pasaria|que ocurriria|si agregara|si eliminara|si cambiara)\b/.test(entrada)) return "MODEL_QUERY"
  if (/^(hazlo|aplicalo|aplica lo que|corrigelo|arreglalo|borralo|eliminalo|quitalo|agregale|anadele)(\b|\s)/.test(entrada)) return "CONTEXTUAL_MODIFICATION"
  if (/^(crea|crear|agrega|anade|elimina|borra|quita|renombra|modifica|cambia|relaciona|convierte|puedes (crear|agregar|anadir|eliminar|borrar|quitar|renombrar|modificar|cambiar|relacionar))\b/.test(entrada)
    ) return "EXPLICIT_MODIFICATION"
  if (/\b(quien|que hizo|historial|actividad|creo|modifico)\b/.test(entrada)) return "ACTIVITY_QUERY"
  if (/^(revisa|analiza|evalua|que opinas)/.test(entrada)) return "REVIEW_REQUEST"
  if (/\b(como uso|como exporto|como importo|nexocase|boton|panel)\b/.test(entrada)) return "PRODUCT_QUERY"
  if (/\b(que significa|que es|composicion|agregacion|uml|multiplicidad)\b/.test(entrada)) return "CONCEPTUAL_QUERY"
  return "MODEL_QUERY"
}

function existeElemento(modelo: NonNullable<PreguntaAsistenteColaborativo["modeloEjecucion"]>, id: string): boolean {
  return modelo.clases.some((clase) => clase.id === id || clase.atributos.some((atributo) => atributo.id === id)
    || (clase.metodos ?? []).some((metodo) => metodo.id === id || metodo.parametros.some((parametro) => parametro.id === id)))
    || modelo.relaciones.some((relacion) => relacion.id === id)
}

function recomendacionDelParticipante(contexto: Awaited<ReturnType<ConstruirContextoAsistenteColaborativo["construir"]>>, participantId: string): RecomendacionMensajeIA | null {
  const compartida = contexto.contexto.conversacionCompartida ?? []
  const humanos = new Map(compartida.filter((mensaje) => mensaje.tipoRemitente === "human").map((mensaje) => [mensaje.id, mensaje]))
  for (const mensaje of [...compartida].reverse()) {
    if (mensaje.tipoRemitente !== "ai" || !mensaje.recomendacion || !mensaje.replyToMessageId) continue
    if (humanos.get(mensaje.replyToMessageId)?.participantId === participantId) return mensaje.recomendacion
  }
  return null
}

function resolverAccionContextual(
  acceso: ContextoAccesoProyecto,
  pregunta: PreguntaAsistenteColaborativo,
  solicitud: Awaited<ReturnType<ConstruirContextoAsistenteColaborativo["construir"]>>,
): { instruccion: string; targetIds: string[] } | { aclaracion: string } {
  const modelo = pregunta.modeloEjecucion
  if (!modelo) return { aclaracion: "Necesito la vista actual del modelo para aplicar el cambio con seguridad." }
  const texto = normalizar(pregunta.contenido)
  const recomendacion = recomendacionDelParticipante(solicitud, acceso.participantId)
  if (recomendacion) {
    if (recomendacion.targetElementIds.some((id) => !existeElemento(modelo, id))) return { aclaracion: "El elemento recomendado ya no existe en el modelo actual. Revisa nuevamente antes de aplicar el cambio." }
    return { instruccion: recomendacion.normalizedInstruction, targetIds: recomendacion.targetElementIds }
  }
  const seleccionado = pregunta.foco?.elementoId
  if (seleccionado && existeElemento(modelo, seleccionado) && /^(borralo|eliminalo|quitalo)/.test(texto)) {
    const clase = modelo.clases.find((item) => item.id === seleccionado)
    const relacion = modelo.relaciones.find((item) => item.id === seleccionado)
    if (clase) return { instruccion: `Elimina la clase ${clase.nombre} con ID ${clase.id}.`, targetIds: [clase.id] }
    if (relacion) return { instruccion: `Elimina la relacion con ID ${relacion.id}.`, targetIds: [relacion.id] }
  }
  return { aclaracion: /^(borralo|eliminalo|quitalo)/.test(texto)
    ? "No puedo determinar de forma inequivoca que elemento deseas eliminar. Indica su nombre o seleccion exacta."
    : "No encuentro una recomendacion previa inequivoca en tu hilo. Indica el cambio y el elemento que deseas modificar." }
}

export class OrquestarInteraccionIA {
  private readonly asistente: AsistirColaborativamente
  constructor(
    private readonly gestionarMensajes: GestionarMensajesProyecto,
    private readonly repositorioMensajes: RepositorioMensajes,
    private readonly construirContexto: ConstruirContextoAsistenteColaborativo,
    proveedorCU12: ProveedorAsistenteContextual,
    private readonly proveedorCU04: ProveedorModeloLenguaje,
    private readonly publicador: PublicadorMensajesProyecto,
  ) { this.asistente = new AsistirColaborativamente(gestionarMensajes, construirContexto, proveedorCU12, publicador) }

  async ejecutar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): Promise<ResultadoOrquestacion> {
    const humano = await this.gestionarMensajes.registrarMensajeHumanoIdempotente(acceso, pregunta.contenido, pregunta.requestId, pregunta.foco ? [pregunta.foco.elementoId] : [])
    if (humano.creado) this.publicador.publicar(humano.mensaje)
    const accionExistente = await this.repositorioMensajes.obtenerAccionIAPorMensaje(acceso.projectId, humano.mensaje.id)
    if (accionExistente) {
      if (accionExistente.requestingParticipantId !== acceso.participantId) throw new Error("La accion pertenece a otro participante.")
      if (accionExistente.estado === "applied") return { kind: "action_already_applied", mensajeHumano: humano.mensaje, actionId: accionExistente.actionId, mensajeIA: await this.gestionarMensajes.obtenerPorRequestId(acceso.projectId, pregunta.requestId, "ai") }
      if (accionExistente.estado === "planned") return this.salidaAccion(humano.mensaje, accionExistente, clasificarIntencionInteraccion(pregunta.contenido))
      return { kind: "action_already_finished", mensajeHumano: humano.mensaje, actionId: accionExistente.actionId, mensajeIA: await this.gestionarMensajes.obtenerPorRequestId(acceso.projectId, pregunta.requestId, "ai") }
    }
    const intent = clasificarIntencionInteraccion(pregunta.contenido)
    if (!["EXPLICIT_MODIFICATION", "CONTEXTUAL_MODIFICATION"].includes(intent)) {
      const resultado = await this.asistente.ejecutar(acceso, pregunta)
      return { kind: "advisory", intent, ...resultado }
    }
    if (!pregunta.modeloEjecucion || pregunta.revisionEditor === undefined) return this.aclarar(acceso, pregunta, humano.mensaje, "Necesito una vista actual valida del modelo antes de preparar esa modificacion.")
    let instruccion = pregunta.contenido.trim()
    let targetIds: string[] = []
    if (intent === "CONTEXTUAL_MODIFICATION") {
      const contexto = await this.construirContexto.construir(acceso, pregunta)
      const resuelta = resolverAccionContextual(acceso, pregunta, contexto)
      if ("aclaracion" in resuelta) return this.aclarar(acceso, pregunta, humano.mensaje, resuelta.aclaracion)
      instruccion = resuelta.instruccion; targetIds = resuelta.targetIds
    }
    const plan = await interpretarInstruccionModelado({ instruccion, modelo: pregunta.modeloEjecucion, revision: pregunta.revisionEditor }, this.proveedorCU04)
    if (plan.resultado !== "aplicar") return this.aclarar(acceso, pregunta, humano.mensaje, plan.mensaje, targetIds)
    const accion = await this.repositorioMensajes.reservarAccionIA({
      actionId: randomUUID(), projectId: acceso.projectId, requestId: pregunta.requestId, sourceMessageId: humano.mensaje.id,
      requestingParticipantId: acceso.participantId, origen: "collaborative", normalizedInstruction: instruccion,
      baseEditorRevision: pregunta.revisionEditor, modeloBase: structuredClone(pregunta.modeloEjecucion), plan,
      estado: "planned", creadoEn: new Date().toISOString(), completadoEn: null,
    })
    return this.salidaAccion(humano.mensaje, accion, intent)
  }

  private salidaAccion(mensajeHumano: MensajeProyecto, accion: AccionIAModeladoPersistida, intent: IntencionInteraccionIA): ResultadoOrquestacion {
    return { kind: "action", intent: intent === "CONTEXTUAL_MODIFICATION" ? intent : "EXPLICIT_MODIFICATION", mensajeHumano, actionId: accion.actionId,
      sourceMessageId: accion.sourceMessageId, normalizedInstruction: accion.normalizedInstruction, plan: accion.plan, baseEditorRevision: accion.baseEditorRevision }
  }

  private async aclarar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo, humano: MensajeProyecto, contenido: string, ids: string[] = []): Promise<ResultadoOrquestacion> {
    const ia = await this.gestionarMensajes.registrarMensajeIAIdempotente(acceso.projectId, contenido, pregunta.requestId, humano.id, ids)
    if (ia.creado) this.publicador.publicar(ia.mensaje)
    return { kind: "clarification", intent: "CLARIFICATION_REQUIRED", mensajeHumano: humano, mensajeIA: ia.mensaje }
  }
}
