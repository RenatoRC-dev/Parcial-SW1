import { randomUUID } from "node:crypto"
import type { ContextoAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { GestionarMensajesProyecto } from "../../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import type { MensajeProyecto } from "../../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
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

function normalizarAutorizacion(texto: string): string {
  // Reconocer el «sí» afirmativo antes de quitar tildes; «si ...» sigue siendo condicional.
  return normalizar(texto.trim().replace(/^(sí|de acuerdo)\s*[,!:]\s*/i, ""))
    .replace(/^por favor[, ]+/, "").replace(/^quiero que crees\b/, "crea")
    .replace(/^me referia a que agregues lo que me recomendaste[.!]?$/, "aplica lo que me recomendaste")
    .replace(/^(?:bien(?:[,!]\s*|\s+))?(?:agregalo|anadelo|ejecuta|ejecutalo)(?:\s+entonces)?[.!]?$/, "aplica eso")
}

export function clasificarIntencionInteraccion(texto: string): IntencionInteraccionIA {
  const entrada = normalizarAutorizacion(texto)
  if (/\b(que pasaria|que ocurriria|si agregara|si eliminara|si cambiara)\b/.test(entrada)) return "MODEL_QUERY"
  if (/^(no|como|que|por que|cuando|seria|si)\b/.test(entrada)) {
    if (/^que hizo\b/.test(entrada)) return "ACTIVITY_QUERY"
    if (/^que (significa|es)\b/.test(entrada)) return "CONCEPTUAL_QUERY"
    if (/^como (uso|exporto|importo)\b/.test(entrada)) return "PRODUCT_QUERY"
    return "MODEL_QUERY"
  }
  if (/^(aplica (la |el |una |mi )?(propuesta|recomendacion)|(?:hazme|disena|construye|modela|crea) (?:todo el modelo|el (?:modelo|diagrama) completo)[.!]?$)/.test(entrada)) return "CONTEXTUAL_MODIFICATION"
  if (/^crea (?:todas )?las (?:clases|tablas)(?: y relaciones)? recomendadas\b/.test(entrada)) return "CONTEXTUAL_MODIFICATION"
  if (/^(aplica (eso|esto)|las que (tu )?me (indicaste|dijiste|recomendaste))\b/.test(entrada)
    || (/\b(crea|crear|hazme|haz|aplica)\b/.test(entrada) && /\b(que (tu )?(me )?(dijiste|indicaste|recomendaste)|anteriormente|hace rato me dijiste)\b/.test(entrada))) return "CONTEXTUAL_MODIFICATION"
  if (/^(hazlo|aplicalo|aplica lo que|corrigelo|arreglalo|borralo|eliminalo|quitalo|agregale|anadele)(\b|\s)/.test(entrada)) return "CONTEXTUAL_MODIFICATION"
  if (/^(crea|crear|hazme|disena|construye|modela|agrega|anade|elimina|borra|quita|renombra|modifica|cambia|relaciona|convierte|(?:puedes|podrias) (crear|disenar|construir|modelar|hacer|agregar|anadir|eliminar|borrar|quitar|renombrar|modificar|cambiar|relacionar))\b/.test(entrada)
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

type PropuestaGuardada = Awaited<ReturnType<RepositorioMensajes["buscarRecomendaciones"]>>[number]

function seleccionarPropuesta(texto: string, propuestas: PropuestaGuardada[], recientes: MensajeProyecto[], pregunta: PreguntaAsistenteColaborativo, participantId: string): PropuestaGuardada | null {
  // Solo palabras de tema, no las fórmulas que autorizan la ejecución.
  const omitir = new Set("aplica aplicar aplicalo corrigelo arreglalo borralo eliminalo quitalo agregale anadele crea crear disena construye modela hazlo hazme haz tu eso esto todo todos todas el la los las un una de del al para sobre y con sus que me mi indicaste dijiste recomendaste recomendadas anteriormente hace rato modelar sistema modelo diagrama completo clases tablas relaciones atributos propuesta recomendacion ultima ultimo anterior por favor".split(" "))
  const temas = normalizar(texto).match(/[a-z0-9]+/g)?.filter((palabra) => palabra.length > 2 && !omitir.has(palabra))
    .map((palabra) => palabra.length > 5 && palabra.endsWith("es") ? palabra.slice(0, -2) : palabra.length > 4 && palabra.endsWith("s") ? palabra.slice(0, -1) : palabra) ?? []
  const clave = ({ mensaje }: PropuestaGuardada) => JSON.stringify([mensaje.recomendacion!.normalizedInstruction.trim().replace(/\s+/g, " "), [...new Set(mensaje.recomendacion!.targetElementIds)].sort()])
  const unicas = propuestas.filter((propuesta, indice) => propuestas.findIndex((otra) => clave(otra) === clave(propuesta)) === indice)
  const candidatas = temas.length ? unicas.filter(({ mensaje, solicitud }) => {
    const evidencia = normalizar(`${mensaje.recomendacion!.resumen} ${mensaje.recomendacion!.normalizedInstruction} ${solicitud.contenido}`)
    return temas.every((tema) => evidencia.includes(tema))
  }) : unicas
  if (candidatas.length === 1) return candidatas[0]
  if (!candidatas.length) return null
  // Una continuación inmediata del propio hilo identifica su respuesta, aunque otros hablen entre medias.
  const ultimoHumano = recientes.find((mensaje) => mensaje.tipoRemitente === "human" && mensaje.participantId === participantId && mensaje.requestId !== pregunta.requestId)
  const correlacionadas = candidatas.filter((propuesta) => propuesta.solicitud.id === ultimoHumano?.id)
  if (correlacionadas.length === 1) return correlacionadas[0]
  if (/\b(ultima|ultimo)\b/.test(normalizar(texto))) {
    return [...candidatas].sort((a, b) => b.mensaje.creadoEn.localeCompare(a.mensaje.creadoEn) || b.mensaje.id.localeCompare(a.mensaje.id))[0]
  }
  return null
}

function resolverAccionContextual(
  acceso: ContextoAccesoProyecto,
  pregunta: PreguntaAsistenteColaborativo,
  propuestas: PropuestaGuardada[],
  recientes: MensajeProyecto[],
): { instruccion: string; targetIds: string[] } | { aclaracion: string } {
  const modelo = pregunta.modeloEjecucion
  if (!modelo) return { aclaracion: "Necesito la vista actual del modelo para aplicar el cambio con seguridad." }
  const texto = normalizarAutorizacion(pregunta.contenido)
  const seleccionado = pregunta.foco?.elementoId
  if (seleccionado && /^(borralo|eliminalo|quitalo)/.test(texto)) {
    const clase = modelo.clases.find((item) => item.id === seleccionado)
    const relacion = modelo.relaciones.find((item) => item.id === seleccionado)
    if (clase) return { instruccion: `Elimina la clase ${clase.nombre} con ID ${clase.id}.`, targetIds: [clase.id] }
    if (relacion) return { instruccion: `Elimina la relacion con ID ${relacion.id}.`, targetIds: [relacion.id] }
    return { aclaracion: "La selección ya no existe o no identifica una clase o relación eliminable. Selecciona el elemento exacto." }
  }
  const propuesta = seleccionarPropuesta(texto, propuestas, recientes, pregunta, acceso.participantId)
  const recomendacion = propuesta?.mensaje.recomendacion
  if (recomendacion) {
    if (!recomendacion.normalizedInstruction.trim()) return { aclaracion: "La recomendación no especifica un cambio ejecutable. Indica las clases y relaciones deseadas." }
    const elimina = /\b(elimina|eliminar|borra|borrar|quita|quitar)\b/
    if (/^(borralo|eliminalo|quitalo)/.test(texto) && recomendacion.targetElementIds.length !== 1) return { aclaracion: "Indica o selecciona el elemento exacto que deseas eliminar." }
    if (elimina.test(normalizar(recomendacion.normalizedInstruction)) && !/^(borralo|eliminalo|quitalo)/.test(texto) && !elimina.test(texto)) return { aclaracion: "La recomendación incluye eliminaciones. Confirma explícitamente qué deseas eliminar." }
    if (/^(borralo|eliminalo|quitalo)/.test(texto) && !elimina.test(normalizar(recomendacion.normalizedInstruction))) return { aclaracion: "La recomendación previa no es una eliminación. Indica qué elemento deseas eliminar." }
    if (recomendacion.targetElementIds.some((id) => !existeElemento(modelo, id))) return { aclaracion: "El elemento recomendado ya no existe en el modelo actual. Revisa nuevamente antes de aplicar el cambio." }
    return { instruccion: recomendacion.normalizedInstruction, targetIds: recomendacion.targetElementIds }
  }
  return { aclaracion: /^(borralo|eliminalo|quitalo)/.test(texto)
    ? "No puedo determinar de forma inequivoca que elemento deseas eliminar. Indica su nombre o seleccion exacta."
    : propuestas.length ? "Indica el tema o la propuesta que deseas aplicar; no puedo distinguirla con seguridad en tu hilo."
      : "No encuentro una propuesta ejecutable en tu hilo. Indica las clases, atributos, relaciones o reglas de negocio que debe incluir el modelo." }
}

export class OrquestarInteraccionIA {
  private readonly asistente: AsistirColaborativamente
  private readonly enCurso = new Map<string, Promise<ResultadoOrquestacion>>()
  constructor(
    private readonly gestionarMensajes: GestionarMensajesProyecto,
    private readonly repositorioMensajes: RepositorioMensajes,
    private readonly construirContexto: ConstruirContextoAsistenteColaborativo,
    proveedorCU12: ProveedorAsistenteContextual,
    private readonly proveedorCU04: ProveedorModeloLenguaje,
    private readonly publicador: PublicadorMensajesProyecto,
  ) { this.asistente = new AsistirColaborativamente(gestionarMensajes, construirContexto, proveedorCU12, publicador) }

  async ejecutar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): Promise<ResultadoOrquestacion> {
    const clave = JSON.stringify([acceso.projectId, acceso.participantId, pregunta.requestId, pregunta.contenido])
    const pendiente = this.enCurso.get(clave)
    if (pendiente) {
      console.info("[CU12] request_lifecycle", { requestId: pregunta.requestId, phase: "inflight_reused" })
      return pendiente
    }
    const ejecucion = this.ejecutarUnaVez(acceso, pregunta).finally(() => this.enCurso.delete(clave))
    this.enCurso.set(clave, ejecucion)
    return ejecucion
  }

  private async ejecutarUnaVez(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): Promise<ResultadoOrquestacion> {
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
      console.info("[CU12] request_lifecycle", { requestId: pregunta.requestId, phase: humano.creado ? "first_request" : "existing_request" })
      const resultado = await this.asistente.ejecutar(acceso, pregunta)
      return { kind: "advisory", intent, ...resultado }
    }
    const respuestaExistente = await this.gestionarMensajes.obtenerPorRequestId(acceso.projectId, pregunta.requestId, "ai")
    if (respuestaExistente) return { kind: "clarification", intent: "CLARIFICATION_REQUIRED", mensajeHumano: humano.mensaje, mensajeIA: respuestaExistente }
    if (!pregunta.modeloEjecucion || pregunta.revisionEditor === undefined) return this.aclarar(acceso, pregunta, humano.mensaje, "Necesito una vista actual valida del modelo antes de preparar esa modificacion.")
    let instruccion = pregunta.contenido.trim()
    let targetIds: string[] = []
    if (intent === "CONTEXTUAL_MODIFICATION") {
      const [propuestas, recientes] = await Promise.all([
        this.repositorioMensajes.buscarRecomendaciones(acceso.projectId, acceso.participantId, 32),
        this.repositorioMensajes.listarPorProyecto({ projectId: acceso.projectId, limite: 16 }),
      ])
      const resuelta = resolverAccionContextual(acceso, pregunta, propuestas, recientes.items)
      if ("aclaracion" in resuelta) return this.aclarar(acceso, pregunta, humano.mensaje, resuelta.aclaracion)
      instruccion = resuelta.instruccion; targetIds = resuelta.targetIds
    }
    const plan = await interpretarInstruccionModelado({ instruccion, modelo: pregunta.modeloEjecucion, revision: pregunta.revisionEditor }, this.proveedorCU04, pregunta.requestId)
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
