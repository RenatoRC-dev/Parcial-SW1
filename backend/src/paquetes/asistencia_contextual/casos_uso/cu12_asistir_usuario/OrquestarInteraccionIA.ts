import { conProcedencia, procedenciaActual, registrarPasoIA } from "../../../mensajeria_colaborativa/compartido/ProcedenciaIA.js"
import { consejoDeAdicionesCompatible, instruccionAsesoria, planAcotadoAlConsejo } from "./PropuestaAsesoriaLocal.js"
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
import { validarPlanLocal, type PlanificadorLocal } from "../../compartido/PlanificadorLocal.js"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"
import { evaluarAptitudGeneracionSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import { exportarModeloXmi } from "../../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import { ErrorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { detectarComandoFlujo, ErrorFlujoAsistente, type AdjuntoTurno, type EjecutarFlujosAsistente } from "./EjecutarFlujosAsistente.js"
import type { RespuestaFlujoAsistente } from "../../compartido/FlujoAsistente.js"

export type IntencionInteraccionIA = "PRODUCT_QUERY" | "CONCEPTUAL_QUERY" | "MODEL_QUERY" | "ACTIVITY_QUERY" | "REVIEW_REQUEST" | "EXPLICIT_MODIFICATION" | "CONTEXTUAL_MODIFICATION" | "CLARIFICATION_REQUIRED"

export type ResultadoOrquestacion =
  | RespuestaFlujoAsistente
  | { kind: "tool"; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto; operacion: "validar_uml" | "exportar_xmi"; baseEditorRevision: number; artifact?: { nombre: "modelo.xmi"; mime: "application/xml"; contenido: string } }
  | { kind: "advisory"; intent: IntencionInteraccionIA; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }
  | { kind: "clarification"; intent: "CLARIFICATION_REQUIRED"; mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }
  | { kind: "action"; intent: "EXPLICIT_MODIFICATION" | "CONTEXTUAL_MODIFICATION"; mensajeHumano: MensajeProyecto; actionId: string; sourceMessageId: string; normalizedInstruction: string; procedencia?: AccionIAModeladoPersistida["procedencia"]; plan: AccionIAModeladoPersistida["plan"]; baseEditorRevision: number }
  | { kind: "action_already_applied"; mensajeHumano: MensajeProyecto; actionId: string; mensajeIA: MensajeProyecto | null }
  | { kind: "action_already_finished"; mensajeHumano: MensajeProyecto; actionId: string; mensajeIA: MensajeProyecto | null }

function normalizar(texto: string): string { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/^[¿?¡!\s]+/, "") }

const IMPERATIVO_REFERENCIAL = /^(?:(?:bien|si|de acuerdo)[,! ]+)?(?:(?:esos?|esas?|esto)[, ]+)?(?:(?:lo que (?:tu )?me (?:sugeriste|recomendaste|dijiste|indicaste))[, ]+(?:ahora )?)?(?:crea|haz|aplica|agrega|anade|ejecuta)(?:lo|los|la|las)(?: entonces| ahora)?[.!]?$/

function normalizarAutorizacion(texto: string): string {
  // Reconocer el «sí» afirmativo antes de quitar tildes; «si ...» sigue siendo condicional.
  return normalizar(texto.trim().replace(/^(sí|de acuerdo)\s*[,!:]\s*/i, ""))
    .replace(/^por favor[, ]+/, "").replace(/^quiero que crees\b/, "crea")
    .replace(/^me referia a que agregues lo que me recomendaste[.!]?$/, "aplica lo que me recomendaste")
    .replace(/^(?:bien(?:[,!]\s*|\s+))?(?:agregalo|anadelo|ejecuta|ejecutalo)(?:\s+entonces)?[.!]?$/, "aplica eso")
}

export function clasificarIntencionInteraccion(texto: string): IntencionInteraccionIA {
  const entrada = normalizarAutorizacion(texto)
  if (/\b(no|nunca|jamas)\b/.test(entrada)) return "MODEL_QUERY"
  if (IMPERATIVO_REFERENCIAL.test(entrada)) return "CONTEXTUAL_MODIFICATION"
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
    || (/\b(crea|crear|hazme|haz|aplica)\b/.test(entrada) && /\b(que (tu )?(me )?(dijiste|indicaste|recomendaste|sugeriste)|anteriormente|hace rato me dijiste)\b/.test(entrada))) return "CONTEXTUAL_MODIFICATION"
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
  if (IMPERATIVO_REFERENCIAL.test(texto)) texto = "aplica eso"
  const temas = normalizar(texto).match(/[a-z0-9]+/g)?.filter((palabra) => palabra.length > 2 && !omitir.has(palabra))
    .map((palabra) => palabra.length > 5 && palabra.endsWith("es") ? palabra.slice(0, -2) : palabra.length > 4 && palabra.endsWith("s") ? palabra.slice(0, -1) : palabra) ?? []
  const clave = ({ mensaje }: PropuestaGuardada) => JSON.stringify([mensaje.recomendacion!.fuente === "asesoria_local" ? mensaje.contenido.trim().replace(/\s+/g, " ") : mensaje.recomendacion!.normalizedInstruction.trim().replace(/\s+/g, " "), [...new Set(mensaje.recomendacion!.targetElementIds)].sort()])
  const unicas = propuestas.filter((propuesta, indice) => propuestas.findIndex((otra) => clave(otra) === clave(propuesta)) === indice)
  const candidatas = temas.length ? unicas.filter(({ mensaje, solicitud }) => {
    const evidencia = normalizar(`${mensaje.recomendacion!.resumen} ${mensaje.recomendacion!.normalizedInstruction} ${mensaje.recomendacion!.fuente === "asesoria_local" ? mensaje.contenido : ""} ${solicitud.contenido}`)
    return temas.every((tema) => evidencia.includes(tema))
  }) : unicas
  if (candidatas.length === 1) return candidatas[0]
  if (!candidatas.length) return null
  if (candidatas.some(({ mensaje }) => mensaje.recomendacion?.fuente === "asesoria_local") && !/\b(ultima|ultimo)\b/.test(normalizar(texto))) return null
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
): { instruccion: string; targetIds: string[]; propuesta?: MensajeProyecto } | { aclaracion: string } {
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
    if (recomendacion.fuente === "asesoria_local") {
      if (recomendacion.revisionEditor !== pregunta.revisionEditor) return { aclaracion: "El UML ha cambiado desde ese consejo. Revisa la propuesta sobre la revisión actual antes de autorizarla." }
      if (!consejoDeAdicionesCompatible(propuesta!.mensaje)) return { aclaracion: "El consejo contiene campos incompletos, tipos no admitidos por CU04 o cambios destructivos. Precisa las adiciones; no se ejecutará parcialmente ni se inventarán relaciones." }
    }
    const instruccion = recomendacion.fuente === "asesoria_local" ? instruccionAsesoria(propuesta!.mensaje) : recomendacion.normalizedInstruction
    if (!instruccion) return { aclaracion: "El consejo es demasiado extenso para ejecutarlo íntegro. Precisa la propuesta sin perder sus nombres y tipos." }
    return { instruccion, targetIds: recomendacion.targetElementIds, propuesta: propuesta!.mensaje }
  }
  const propios = new Set(recientes.filter((m) => m.projectId === acceso.projectId && m.tipoRemitente === "human" && m.participantId === acceso.participantId).map((m) => m.id))
  if (!propuestas.length && recientes.some((m) => m.projectId === acceso.projectId && m.tipoRemitente === "ai" && !m.recomendacion && m.replyToMessageId && propios.has(m.replyToMessageId) && m.procedencia?.some((p) => p.nombre === "ollama" && p.estado === "completed"))) {
    return { aclaracion: "El historial anterior de Ollama no conserva una propuesta con revisión verificable. Solicita un consejo actualizado sobre el UML actual y después autoriza su aplicación; no puedo inventar la revisión de aquel mensaje." }
  }
  return { aclaracion: /^(borralo|eliminalo|quitalo)/.test(texto)
    ? "No puedo determinar de forma inequivoca que elemento deseas eliminar. Indica su nombre o seleccion exacta."
    : propuestas.length ? "Indica el tema o la propuesta que deseas aplicar; no puedo distinguirla con seguridad en tu hilo."
      : "No encuentro una propuesta ejecutable en tu hilo. Indica las clases, atributos, relaciones o reglas de negocio que debe incluir el modelo." }
}

export class OrquestarInteraccionIA {
  ejecutarHerramienta?: (acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo) => Promise<ResultadoOrquestacion | null>
  private readonly asistente: AsistirColaborativamente
  private readonly enCurso = new Map<string, Promise<ResultadoOrquestacion>>()
  constructor(
    private readonly gestionarMensajes: GestionarMensajesProyecto,
    private readonly repositorioMensajes: RepositorioMensajes,
    private readonly construirContexto: ConstruirContextoAsistenteColaborativo,
    proveedorCU12: ProveedorAsistenteContextual,
    private readonly proveedorCU04: ProveedorModeloLenguaje,
    private readonly publicador: PublicadorMensajesProyecto,
    private readonly planificadorLocal?: PlanificadorLocal,
    private readonly flujos?: EjecutarFlujosAsistente,
  ) { this.asistente = new AsistirColaborativamente(gestionarMensajes, construirContexto, proveedorCU12, publicador) }

  async ejecutar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo, adjunto?: AdjuntoTurno): Promise<ResultadoOrquestacion> {
    return conProcedencia(pregunta.requestId, () => this.ejecutarConProcedencia(acceso, pregunta, adjunto))
  }

  private async ejecutarConProcedencia(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo, adjunto?: AdjuntoTurno): Promise<ResultadoOrquestacion> {
    if (!adjunto && this.ejecutarHerramienta) {
      const resultado = await this.ejecutarHerramienta(acceso, pregunta)
      if (resultado) return resultado
    }
    // El adjunto no pasa jamás al proveedor CU12 ni se interpreta como texto visual.
    if (adjunto && this.flujos) {
      const operacion = adjunto.tipo === "imagen" ? "analizar_imagen" : "importar_xmi"
      const existente = await this.repositorioMensajes.obtenerFlujo(acceso.projectId, pregunta.requestId)
      if (!existente && this.planificadorLocal) {
        const solicitud = await this.construirContexto.construir(acceso, pregunta)
        const plan = validarPlanLocal(await registrarPasoIA("ollama", () => this.planificadorLocal!.planificar({ ...solicitud, pregunta: `${pregunta.contenido}\nAdjunto: ${adjunto.tipo}, ${adjunto.nombre}. Interpreta este turno con el servicio especializado, no tienes contexto visual.` })))
        if (plan.operacion !== operacion) throw new ErrorFlujoAsistente(400, "La intención no corresponde al archivo. Precisa analizar la imagen o importar el XMI; no se ejecutó otra operación.")
      }
      return this.flujos.ejecutar(acceso, pregunta, operacion, adjunto)
    }
    if (this.flujos && !this.planificadorLocal) {
      const operacion = detectarComandoFlujo(pregunta.contenido)
      if (operacion) return this.flujos.ejecutar(acceso, pregunta, operacion)
    }
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
    const flujo = this.flujos && await this.repositorioMensajes.obtenerFlujo(acceso.projectId, pregunta.requestId)
    if (flujo && this.flujos) return this.flujos.ejecutar(acceso, pregunta, flujo.operacion)
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
    // Reutilizar primero el resultado durable: ni el planner ni Groq se repiten.
    const respuestaPrevia = await this.gestionarMensajes.obtenerPorRequestId(acceso.projectId, pregunta.requestId, "ai")
    if (this.planificadorLocal && respuestaPrevia) return { kind: "advisory", intent, mensajeHumano: humano.mensaje, mensajeIA: respuestaPrevia }
    if (this.planificadorLocal && intent !== "CONTEXTUAL_MODIFICATION") {
      // Se valida incluso el proveedor inyectado. El LLM no otorga autorización.
      const plan = validarPlanLocal(await registrarPasoIA("ollama", async () => this.planificadorLocal!.planificar(await this.construirContexto.construir(acceso, pregunta))))
      console.info("[IA] routing", JSON.stringify({ requestId: pregunta.requestId, selectedOperation: plan.operacion, authorization: intent }))
      if ((plan.operacion === "exportar_xmi" || plan.operacion === "generar_spring") && this.flujos) {
        if (detectarComandoFlujo(pregunta.contenido) !== plan.operacion) return this.aclarar(acceso, pregunta, humano.mensaje, "Confirma explícitamente exportar XMI o generar el backend Spring.")
        return this.flujos.ejecutar(acceso, pregunta, plan.operacion)
      }
      if (plan.operacion === "modificar_uml") {
        if (!["EXPLICIT_MODIFICATION", "CONTEXTUAL_MODIFICATION"].includes(intent)) return this.aclarar(acceso, pregunta, humano.mensaje, "Indica explícitamente el cambio UML que autorizas; la interpretación local no constituye autorización.")
      } else if (plan.operacion === "conversar") {
        if (["EXPLICIT_MODIFICATION", "CONTEXTUAL_MODIFICATION"].includes(intent)) return this.aclarar(acceso, pregunta, humano.mensaje, "No pude confirmar el servicio solicitado. Precisa qué cambio deseas realizar.")
        return { kind: "advisory", intent, ...await this.asistente.ejecutar(acceso, pregunta, plan.respuesta) }
      } else if (plan.operacion === "validar_uml" || plan.operacion === "exportar_xmi") {
        const texto = normalizar(pregunta.contenido).replace(/^por favor[, ]+/, "")
        const autorizado = plan.operacion === "validar_uml"
          ? /^(valida|validar|validate|comprueba|verifica)\b/.test(texto)
          : /^(exporta|exportar|export)\b/.test(texto) && /\bxmi\b/.test(texto)
        if (!autorizado || /\b(no|not|si|if|pero|but)\b/.test(texto)) return this.aclarar(acceso, pregunta, humano.mensaje, "Confirma la operación con «valida el modelo» o «exporta XMI».")
        if (!pregunta.modeloEjecucion || pregunta.revisionEditor === undefined) return this.aclarar(acceso, pregunta, humano.mensaje, "Necesito la vista actual del UML para ejecutar esta operación.")
        const modelo = pregunta.modeloEjecucion
        let artifact: { nombre: "modelo.xmi"; mime: "application/xml"; contenido: string } | undefined
        let contenido: string
        if (plan.operacion === "validar_uml") {
          const validacion = await registrarPasoIA("cu08", () => validarModelo(modelo))
          const spring = evaluarAptitudGeneracionSpring(modelo, validacion)
          contenido = `Validación completada sobre la revisión local ${pregunta.revisionEditor}. UML ${validacion.valido ? "válido" : "inválido"}. Spring: ${spring.apto ? "apto" : "no apto"}.\n${validacion.diagnosticos.slice(0, 12).map((d) => d.mensaje).join("\n")}\n${spring.motivos.slice(0, 8).join("\n")}`
        } else {
          try { artifact = { nombre: "modelo.xmi", mime: "application/xml", contenido: (await registrarPasoIA("cu07", () => exportarModeloXmi(modelo))).toString("utf8") } }
          catch { throw new ErrorAsistenteContextual("no_disponible", "El servicio XMI no pudo producir el archivo; no se ha exportado.") }
          contenido = `Archivo XMI generado sobre la revisión local ${pregunta.revisionEditor}. Disponible para descargar en esta respuesta; no se importó en Enterprise Architect.`
        }
        const ia = await this.gestionarMensajes.registrarMensajeIAIdempotente(acceso.projectId, contenido, pregunta.requestId, humano.mensaje.id, [])
        if (ia.creado) this.publicador.publicar(ia.mensaje)
        return { kind: "tool", mensajeHumano: humano.mensaje, mensajeIA: ia.mensaje, operacion: plan.operacion, baseEditorRevision: pregunta.revisionEditor, ...(artifact ? { artifact } : {}) }
      } else {
        const mensajes = {
          analizar_imagen: "Adjunta la imagen en este mismo asistente. El análisis existente usa Groq y presenta un candidato; debes confirmar Agregar antes de modificar el UML.",
          importar_xmi: "Adjunta el archivo .xmi o .xml en este mismo asistente. Se analizará con CU06 y verás una vista previa y advertencias antes de confirmar explícitamente el reemplazo del diagrama.",
          generar_spring: "Solicita explícitamente generar el backend Spring Boot. CU08/CU09 comprobarán el perfil y CU10 entregará el ZIP en esta conversación. No se generó un backend en este turno.",
          automatizar_ea: "Enterprise Architect no está disponible en este asistente: no hay un conector instalado y autorizado registrado en el backend. No se ejecutó automatización.",
          aclarar: "Precisa una sola operación y su objetivo. Las solicitudes ambiguas no se ejecutan.",
        }
        return this.aclarar(acceso, pregunta, humano.mensaje, mensajes[plan.operacion])
      }
    }
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
    let propuesta: MensajeProyecto | undefined
    if (intent === "CONTEXTUAL_MODIFICATION") {
      const [propuestas, recientes] = await Promise.all([
        this.repositorioMensajes.buscarRecomendaciones(acceso.projectId, acceso.participantId, 32),
        this.repositorioMensajes.listarPorProyecto({ projectId: acceso.projectId, limite: 16 }),
      ])
      const resuelta = resolverAccionContextual(acceso, pregunta, propuestas, recientes.items)
      if ("aclaracion" in resuelta) return this.aclarar(acceso, pregunta, humano.mensaje, resuelta.aclaracion)
      instruccion = resuelta.instruccion; targetIds = resuelta.targetIds; propuesta = resuelta.propuesta
    }
    const plan = await registrarPasoIA("groq_cu04", () => interpretarInstruccionModelado({ instruccion, modelo: pregunta.modeloEjecucion!, revision: pregunta.revisionEditor! }, this.proveedorCU04, pregunta.requestId))
    if (plan.resultado !== "aplicar") return this.aclarar(acceso, pregunta, humano.mensaje, plan.mensaje, targetIds)
    if (propuesta?.recomendacion?.fuente === "asesoria_local" && !planAcotadoAlConsejo(propuesta, pregunta.modeloEjecucion, plan.comandos)) return this.aclarar(acceso, pregunta, humano.mensaje, "El plan excede las adiciones comprobables del consejo. Precisa las clases, atributos y tipos; no se aplicó ningún cambio.")
    const accion = await this.repositorioMensajes.reservarAccionIA({
      ...(propuesta ? { proposalMessageId: propuesta.id } : {}), procedencia: procedenciaActual(),
      actionId: randomUUID(), projectId: acceso.projectId, requestId: pregunta.requestId, sourceMessageId: humano.mensaje.id,
      requestingParticipantId: acceso.participantId, origen: "collaborative", normalizedInstruction: instruccion,
      baseEditorRevision: pregunta.revisionEditor, modeloBase: structuredClone(pregunta.modeloEjecucion), plan,
      estado: "planned", creadoEn: new Date().toISOString(), completadoEn: null,
    })
    return this.salidaAccion(humano.mensaje, accion, intent)
  }

  private salidaAccion(mensajeHumano: MensajeProyecto, accion: AccionIAModeladoPersistida, intent: IntencionInteraccionIA): ResultadoOrquestacion {
    return { kind: "action", intent: intent === "CONTEXTUAL_MODIFICATION" ? intent : "EXPLICIT_MODIFICATION", mensajeHumano, actionId: accion.actionId,
      sourceMessageId: accion.sourceMessageId, procedencia: accion.procedencia, normalizedInstruction: accion.normalizedInstruction, plan: accion.plan, baseEditorRevision: accion.baseEditorRevision }
  }

  private async aclarar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo, humano: MensajeProyecto, contenido: string, ids: string[] = []): Promise<ResultadoOrquestacion> {
    await registrarPasoIA("determinista", () => undefined)
    const ia = await this.gestionarMensajes.registrarMensajeIAIdempotente(acceso.projectId, contenido, pregunta.requestId, humano.id, ids)
    if (ia.creado) this.publicador.publicar(ia.mensaje)
    return { kind: "clarification", intent: "CLARIFICATION_REQUIRED", mensajeHumano: humano, mensajeIA: ia.mensaje }
  }
}
