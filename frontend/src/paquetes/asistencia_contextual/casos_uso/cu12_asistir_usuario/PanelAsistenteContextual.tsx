import { useCallback, useEffect, useRef, useState } from "react"
import { usarPreferenciasUI, type ClaveTexto } from "../../../../configuracion/PreferenciasUI"
import { conectarConversacionColaborativa } from "./conectarConversacionColaborativa"
import {
  cargarMensajesColaborativos,
  combinarMensajes,
  consultarAsistenteContextual,
  ErrorConsultaContextual,
  type MensajeColaborativo,
  type VistaFlujoAsistente,
  recuperarFlujosAsistente, confirmarFlujoAsistente, completarFlujoAsistente, descargarArchivoFlujo,
} from "./consultarAsistenteContextual"
import { obtenerGrupoPreguntasRapidas, obtenerOrientacionDeterminista, type ContextoAsistente } from "./ContextoAsistente"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { aplicarPlanIA } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/procesarInstruccionIA"
import { completarCambioIA } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/solicitarCambioIA"
import type { CambioAplicadoIA } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ComandoModeloUML"
import { GrabadorInstruccionVoz } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/voz/GrabadorInstruccionVoz"
import { ConfiguracionConectorEA } from "./ConfiguracionConectorEA"
import { cancelarFlujoEA } from "./consultarAsistenteContextual"
import { TarjetaFlujoAsistente } from "./TarjetaFlujoAsistente"

interface PropiedadesPanelAsistenteContextual {
  projectId: string
  credential: string
  participantId: string
  contexto: ContextoAsistente
  modelo: ModeloUMLCanonico
  revisionEditor: number
  alAplicarModelo: (modelo: ModeloUMLCanonico) => void
  alAplicarImagen?: (modelo: ModeloUMLCanonico) => void
  alAplicarXmi?: (modelo: ModeloUMLCanonico) => void
  alCambiarEstadoCandidato?: (pendiente: boolean) => void
  consultar?: typeof consultarAsistenteContextual
  cargar?: typeof cargarMensajesColaborativos
  conectar?: typeof conectarConversacionColaborativa
  recuperar?: typeof recuperarFlujosAsistente
  confirmar?: typeof confirmarFlujoAsistente
  completar?: typeof completarFlujoAsistente
  descargar?: typeof descargarArchivoFlujo
}

export function PanelAsistenteContextual({ projectId, credential, participantId, contexto, modelo, revisionEditor, alAplicarModelo, alAplicarImagen = alAplicarModelo, alAplicarXmi = alAplicarModelo, alCambiarEstadoCandidato, consultar = consultarAsistenteContextual, cargar = cargarMensajesColaborativos, conectar = conectarConversacionColaborativa, recuperar = recuperarFlujosAsistente, confirmar = confirmarFlujoAsistente, completar = completarFlujoAsistente, descargar = descargarArchivoFlujo }: PropiedadesPanelAsistenteContextual) {
  const { t } = usarPreferenciasUI()
  const [pregunta, establecerPregunta] = useState("")
  const [mensajes, establecerMensajes] = useState<MensajeColaborativo[]>([])
  const [archivos, establecerArchivos] = useState<Record<string, string>>({})
  const [flujos, establecerFlujos] = useState<Record<string, VistaFlujoAsistente>>({})
  const [adjuntosEnviados, establecerAdjuntosEnviados] = useState<Record<string, File>>({})
  const [cursorAnterior, establecerCursorAnterior] = useState<string | null>(null)
  const [error, establecerError] = useState<string | null>(null)
  const [consultando, establecerConsultando] = useState(false)
  const [espera, establecerEspera] = useState(0)
  const [estadoAccion, establecerEstadoAccion] = useState<"interpretando" | "aplicando" | "listo" | "aclaracion" | null>(null)
  const [cargando, establecerCargando] = useState(true)
  const [vozOcupada, establecerVozOcupada] = useState(false)
  const [imagen, establecerImagen] = useState<File | null>(null)
  const imagenOcupada = consultando && imagen?.type.startsWith("image/") === true
  const [vistaPrevia, establecerVistaPrevia] = useState<string | null>(null)
  const [estadoVoz, establecerEstadoVoz] = useState(false)
  const historial = useRef<HTMLDivElement>(null)
  const seguirFinal = useRef(true)
  const entrada = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!imagen?.type.startsWith("image/") || typeof URL.createObjectURL !== "function") { establecerVistaPrevia(null); return }
    const url = URL.createObjectURL(imagen)
    establecerVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [imagen])
  useEffect(() => {
    const contenedor = historial.current
    if (contenedor && seguirFinal.current) contenedor.scrollTop = contenedor.scrollHeight
  }, [mensajes, imagenOcupada])
  const solicitudPendiente = useRef<{ contenido: string; requestId: string; archivo?: File; base: { modelo: ModeloUMLCanonico; revision: number } } | null>(null)
  const enviando = useRef(false)
  const estadoModelo = useRef({ modelo, revision: revisionEditor })
  const identidadActual = useRef({ projectId, participantId })
  identidadActual.current = { projectId, participantId }
  const accionesAplicadas = useRef(new Map<string, CambioAplicadoIA[]>())
  const flujosAplicados = useRef(new Map<string, ModeloUMLCanonico>())
  estadoModelo.current = { modelo, revision: revisionEditor }
  useEffect(() => { alCambiarEstadoCandidato?.(Object.values(flujos).some((f) => f.estado === "review" || f.estado === "issued")) }, [flujos, alCambiarEstadoCandidato])
  useEffect(() => {
    const pendientes = Object.values(flujos).filter((f) => ["automatizar_ea", "importar_desde_ea"].includes(f.operacion) && ["queued", "importing"].includes(f.estado)).map((f) => f.requestId)
    if (!pendientes.length) return
    let cancelado = false, enVuelo = false
    const timer = setInterval(async () => {
      if (enVuelo) return
      enVuelo = true
      try {
        const resultados = await recuperar(projectId, credential, pendientes)
        if (!cancelado && identidadActual.current.projectId === projectId && identidadActual.current.participantId === participantId) establecerFlujos((actuales) => ({ ...actuales, ...Object.fromEntries(resultados.map((f) => [f.requestId, f])) }))
      } catch (fallo) { if (!cancelado) establecerError(fallo instanceof Error ? fallo.message : "No se pudo consultar el conector EA.") }
      finally { enVuelo = false }
    }, 2000)
    return () => { cancelado = true; clearInterval(timer) }
  }, [flujos, recuperar, projectId, credential, participantId])
  useEffect(() => {
    if (!espera) return
    const temporizador = setTimeout(() => establecerEspera((actual) => Math.max(0, actual - 1)), 1000)
    return () => clearTimeout(temporizador)
  }, [espera])
  const orientacion = obtenerOrientacionDeterminista(contexto)
  const claveOrientacion: Record<typeof orientacion, ClaveTexto> = {
    SIN_CLASES: "contextual.hintSinClases", UML_INVALIDO: "contextual.hintInvalido", IMAGEN_PENDIENTE: "contextual.hintImagen",
    NM_DIRECTO: "contextual.hintNm", LISTO_GENERAR: "contextual.hintListo", REVISAR_GENERACION: "contextual.hintRevisar",
  }
  const preguntasPorEstado: Record<ReturnType<typeof obtenerGrupoPreguntasRapidas>, ClaveTexto[]> = {
    MODELO_INVALIDO: ["contextual.rapidaProblemas", "contextual.rapidaCorregir", "contextual.rapidaBloquea"],
    MODELO_VALIDO: ["contextual.rapidaListoGenerar", "contextual.rapidaRiesgos", "contextual.rapidaCardinalidades", "contextual.rapidaUsarIa"],
    CLASE_SELECCIONADA: ["contextual.rapidaExplicarClase", "contextual.rapidaQuienCreo", "contextual.rapidaRelacionesClase"],
    RELACION_SELECCIONADA: ["contextual.rapidaExplicarRelacion", "contextual.rapidaQuienModifico", "contextual.rapidaSignificadoMultiplicidad"],
  }

  const cargarHistoria = useCallback(async (cursor?: string) => {
    try {
      const pagina = await cargar(projectId, credential, cursor)
      if (identidadActual.current.projectId !== projectId || identidadActual.current.participantId !== participantId) return
      establecerMensajes((actuales) => combinarMensajes(actuales, pagina.items))
      establecerCursorAnterior(pagina.siguienteCursor)
      const recuperados = await recuperar(projectId, credential, pagina.items.filter((m) => m.tipoRemitente === "human" && m.participantId === participantId && m.requestId).map((m) => m.requestId!))
      if (identidadActual.current.projectId !== projectId || identidadActual.current.participantId !== participantId) return
      establecerFlujos((actuales) => ({ ...actuales, ...Object.fromEntries(recuperados.map((f) => [f.requestId, f])) }))
    } catch (fallo) {
      establecerError(fallo instanceof Error ? fallo.message : t("contextual.errorInterno"))
    } finally { establecerCargando(false) }
  }, [cargar, recuperar, credential, projectId, participantId, t])

  useEffect(() => {
    establecerMensajes([]); establecerArchivos({}); establecerFlujos({}); establecerAdjuntosEnviados({}); establecerError(null); solicitudPendiente.current = null; flujosAplicados.current.clear(); establecerCargando(true)
    const conexion = conectar({
      projectId, credential,
      alAutenticar: () => { void cargarHistoria() },
      alMensaje: (mensaje) => establecerMensajes((actuales) => combinarMensajes(actuales, [mensaje])),
      alError: (mensaje) => { establecerError(mensaje); void cargarHistoria() },
    })
    return () => conexion.desconectar()
  }, [cargarHistoria, conectar, credential, projectId])

  const preguntar = async (texto = pregunta, archivo: File | undefined = imagen ?? undefined) => {
    const limpia = texto.trim() || (archivo ? /\.(xmi|xml)$/i.test(archivo.name) ? "Importa este archivo XMI" : "Analiza esta imagen" : "")
    if (!limpia || enviando.current || espera || vozOcupada || imagenOcupada) return
    enviando.current = true
    const pendiente = solicitudPendiente.current
    const repetido = pendiente?.contenido === limpia && pendiente.archivo === archivo
    const requestId = repetido ? pendiente.requestId : crypto.randomUUID()
    const base = repetido ? pendiente.base : structuredClone(estadoModelo.current)
    solicitudPendiente.current = { contenido: limpia, requestId, archivo, base }
    if (archivo) establecerAdjuntosEnviados((actuales) => ({ ...actuales, [requestId]: archivo }))
    establecerConsultando(true); establecerError(null); establecerEstadoAccion("interpretando")
    try {
      const resultado = await consultar(projectId, credential, requestId, limpia, contexto, base.modelo, base.revision, archivo)
      if (identidadActual.current.projectId !== projectId || identidadActual.current.participantId !== participantId) return
      establecerMensajes((actuales) => combinarMensajes(actuales, [resultado.mensajeHumano, ...resultadoMensajes(resultado)]))
      if (resultado.kind === "workflow") {
        if (resultado.flujo.participantId !== participantId || resultado.mensajeHumano.projectId !== projectId || resultado.flujo.sourceMessageId !== resultado.mensajeHumano.id) throw new Error(t("contextual.accionAjena"))
        establecerFlujos((actuales) => ({ ...actuales, [resultado.flujo.requestId]: resultado.flujo }))
      }
      if (resultado.kind === "tool" && resultado.artifact) {
        if (resultado.mensajeHumano.projectId !== projectId || resultado.mensajeHumano.participantId !== participantId
          || resultado.artifact.nombre !== "modelo.xmi" || resultado.artifact.mime !== "application/xml" || typeof resultado.artifact.contenido !== "string") throw new Error(t("contextual.accionAjena"))
        const contenido = resultado.artifact.contenido
        establecerArchivos((actuales) => ({ ...actuales, [resultado.mensajeIA.id]: contenido }))
      }
      if (resultado.kind === "action") {
        if (resultado.mensajeHumano.projectId !== projectId || resultado.mensajeHumano.participantId !== participantId || resultado.sourceMessageId !== resultado.mensajeHumano.id) throw new Error(t("contextual.accionAjena"))
        establecerEstadoAccion("aplicando")
        const cambiosPrevios = accionesAplicadas.current.get(resultado.actionId)
        const ejecucion = cambiosPrevios
          ? { resultado: "aplicado" as const, mensaje: "El cambio ya fue aplicado localmente.", cambios: cambiosPrevios }
          : aplicarPlanIA({ plan: resultado.plan, baseEditorRevision: resultado.baseEditorRevision, obtenerEstado: () => estadoModelo.current, aplicar: alAplicarModelo })
        if (!cambiosPrevios && ejecucion.resultado === "aplicado") accionesAplicadas.current.set(resultado.actionId, ejecucion.cambios)
        const cierre = await completarCambioIA(projectId, credential, resultado.actionId, ejecucion.resultado === "aplicado" ? "applied" : "failed", ejecucion.cambios, ejecucion.mensaje)
        if (cierre.mensajeIA) establecerMensajes((actuales) => combinarMensajes(actuales, [cierre.mensajeIA as MensajeColaborativo]))
        if (ejecucion.resultado !== "aplicado") { establecerError(ejecucion.mensaje); establecerEstadoAccion(null) }
        else establecerEstadoAccion("listo")
      } else establecerEstadoAccion(resultado.kind === "clarification" ? "aclaracion" : resultado.kind === "action_already_applied" ? "listo" : null)
      solicitudPendiente.current = null
      establecerPregunta("")
      establecerImagen(null)
      establecerEstadoVoz(false)
    } catch (fallo) {
      establecerEstadoAccion(null)
      if (fallo instanceof ErrorConsultaContextual && fallo.tipo === "limite") establecerEspera(fallo.retryAfterSeconds ?? 30)
      establecerError(fallo instanceof ErrorConsultaContextual || fallo instanceof Error ? fallo.message : t("contextual.errorInterno"))
    } finally { enviando.current = false; establecerConsultando(false) }
  }

  const enviar = async () => { await preguntar() }

  const decidir = async (flujo: VistaFlujoAsistente, decision: "confirmar" | "rechazar") => {
    if (enviando.current || flujo.participantId !== participantId) return
    enviando.current = true; establecerConsultando(true); establecerError(null)
    try {
      const yaAplicado = flujosAplicados.current.get(flujo.requestId)
      if (yaAplicado) {
        const cierre = await completar(projectId, credential, flujo.requestId, "applied", yaAplicado)
        establecerFlujos((actuales) => ({ ...actuales, [flujo.requestId]: cierre.flujo }))
        establecerMensajes((actuales) => combinarMensajes(actuales, resultadoMensajes(cierre)))
        return
      }
      const base = structuredClone(estadoModelo.current)
      const salida = await confirmar(projectId, credential, flujo.requestId, decision, base.modelo, base.revision)
      if (identidadActual.current.projectId !== projectId || identidadActual.current.participantId !== participantId || salida.flujo.participantId !== participantId || salida.flujo.requestId !== flujo.requestId) throw new Error(t("contextual.accionAjena"))
      establecerFlujos((actuales) => ({ ...actuales, [flujo.requestId]: salida.flujo }))
      if (!salida.modeloResultado) return
      // Última barrera contra cambios de Yjs ocurridos mientras responde HTTP.
      if (salida.flujo.revision !== estadoModelo.current.revision || base.revision !== estadoModelo.current.revision || JSON.stringify(base.modelo) !== JSON.stringify(estadoModelo.current.modelo)) {
        const fallida = await completar(projectId, credential, flujo.requestId, "failed")
        establecerFlujos((actuales) => ({ ...actuales, [flujo.requestId]: fallida.flujo }))
        throw new Error("El UML cambió antes de aplicar la propuesta. Vuelve a analizar sobre la revisión actual.")
      }
      try { (flujo.operacion === "analizar_imagen" ? alAplicarImagen : alAplicarXmi)(salida.modeloResultado) }
      catch (fallo) {
        const fallida = await completar(projectId, credential, flujo.requestId, "failed")
        establecerFlujos((actuales) => ({ ...actuales, [flujo.requestId]: fallida.flujo }))
        throw fallo
      }
      flujosAplicados.current.set(flujo.requestId, salida.modeloResultado)
      const cierre = await completar(projectId, credential, flujo.requestId, "applied", salida.modeloResultado)
      establecerFlujos((actuales) => ({ ...actuales, [flujo.requestId]: cierre.flujo }))
      establecerMensajes((actuales) => combinarMensajes(actuales, resultadoMensajes(cierre)))
    } catch (fallo) { establecerError(fallo instanceof Error ? fallo.message : t("contextual.errorInterno")) }
    finally { enviando.current = false; establecerConsultando(false) }
  }

  // Solo metadatos durables correlacionados al último turno propio; el backend
  // sigue siendo la autoridad sobre vigencia, autorización y validez del cambio.
  const recientes = [...mensajes].reverse()
  const ultimoTurno = recientes.find((mensaje) => mensaje.projectId === projectId && mensaje.tipoRemitente === "human" && mensaje.participantId === participantId)
  const propuesta = ultimoTurno && recientes.find((mensaje) => mensaje.projectId === projectId && mensaje.tipoRemitente === "ai" && mensaje.replyToMessageId === ultimoTurno.id && mensaje.requestId === ultimoTurno.requestId)
  const idsActuales = new Set([
    ...modelo.relaciones.map(({ id }) => id),
    ...modelo.clases.flatMap((clase) => [clase.id, ...clase.atributos.map(({ id }) => id), ...(clase.metodos ?? []).flatMap((metodo) => [metodo.id, ...metodo.parametros.map(({ id }) => id)])]),
  ])
  const recomendacion = propuesta?.recomendacion
  const propuestaPendiente = recomendacion && recomendacion.resumen.trim() && recomendacion.normalizedInstruction.trim()
    && recomendacion.targetElementIds.every((id) => idsActuales.has(id))
    && !/\b(elimina\w*|borra\w*|quita\w*|reemplaza\w*|delete|remove|drop|replace)\b/i.test(recomendacion.normalizedInstruction)
    ? propuesta.id : null

  return <aside className="contextual-assistant-panel" data-testid="panel-asistente-colaborativo">
    <h2>{t("contextual.titulo")}</h2>
    <ConfiguracionConectorEA key={`${projectId}:${participantId}`} projectId={projectId} credential={credential} solicitar={!!error && /conector|connector|Enterprise Architect/i.test(error)} />
    <div ref={historial} className="contextual-conversation" role="log" aria-label={t("chat.historial")} aria-live="polite" aria-busy={cargando} tabIndex={0} onScroll={(evento) => { const nodo = evento.currentTarget; seguirFinal.current = nodo.scrollHeight - nodo.scrollTop - nodo.clientHeight < 100 }}>
      {cursorAnterior ? <button type="button" disabled={cargando} onClick={() => { seguirFinal.current = false; establecerCargando(true); void cargarHistoria(cursorAnterior) }}>{t("contextual.cargarAnteriores")}</button> : null}
      {mensajes.map((mensaje) => <article className={mensaje.tipoRemitente === "ai" ? "contextual-answer" : "contextual-message"} key={mensaje.id} data-message-id={mensaje.id}>
        <strong>{mensaje.tipoRemitente === "ai" ? t("contextual.ia") : mensaje.nombreVisibleSnapshot ?? t("contextual.sistema")}:</strong>
        {mensaje.tipoRemitente === "ai" && mensaje.procedencia?.length ? <small className="ai-note" data-testid="procedencia-ia">{mensaje.procedencia.map((paso) => `${({ ollama: "Ollama · Qwen3", groq_cu04: "Groq · CU04", groq_cu05: "Groq · CU05", groq_cu12: "Groq · CU12", determinista: "NexoCASE", cu08: "CU08", cu06: "CU06 · XMI", cu07: "CU07 · XMI", spring: "Spring" })[paso.nombre] ?? "NexoCASE"}${paso.estado === "failed" ? " ⚠" : ""}`).join(" / ")}</small> : null}
        <div className="contextual-message-body">{mensaje.tipoRemitente === "ai" ? formatearMensaje(mensaje.contenido) : mensaje.contenido}</div>
        {mensaje.tipoRemitente === "human" && mensaje.requestId && adjuntosEnviados[mensaje.requestId] ? <VistaAdjunto archivo={adjuntosEnviados[mensaje.requestId]} /> : null}
        {mensaje.tipoRemitente === "human" && mensaje.requestId && flujos[mensaje.requestId]?.sourceMessageId === mensaje.id && flujos[mensaje.requestId]?.participantId === participantId ? <TarjetaFlujoAsistente flujo={flujos[mensaje.requestId]} ocupado={consultando} alCancelar={() => {
          if (enviando.current) return
          enviando.current = true; establecerConsultando(true)
          void cancelarFlujoEA(projectId, credential, mensaje.requestId!).then(({ flujo }) => {
            if (identidadActual.current.projectId === projectId && identidadActual.current.participantId === participantId) establecerFlujos((actual) => ({ ...actual, [flujo.requestId]: flujo }))
          }).catch((e: unknown) => establecerError(e instanceof Error ? e.message : t("contextual.errorInterno"))).finally(() => { enviando.current = false; establecerConsultando(false) })
        }} alDecidir={(d) => void decidir(flujos[mensaje.requestId!], d)} alDescargar={() => {
          establecerConsultando(true); establecerError(null)
          void descargar(projectId, credential, flujos[mensaje.requestId!]).catch((e: unknown) => establecerError(e instanceof Error ? e.message : t("contextual.errorInterno"))).finally(() => establecerConsultando(false))
        }} /> : null}
        {archivos[mensaje.id] !== undefined ? <button type="button" onClick={() => {
          const url = URL.createObjectURL(new Blob([archivos[mensaje.id]], { type: "application/xml" }))
          const enlace = document.createElement("a")
          enlace.href = url; enlace.download = "modelo.xmi"; enlace.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>↓ modelo.xmi</button> : null}
        {mensaje.id === propuestaPendiente ? <button type="button" disabled={consultando || vozOcupada || imagenOcupada || espera > 0} title={t("contextual.validarPropuesta")} onClick={() => {
          // Instrucción explícita para el clasificador existente; nunca ejecutar
          // directamente ni reinterpretar una propuesta desde su texto visible.
          void preguntar(`Aplica la propuesta: ${recomendacion!.normalizedInstruction}`)
        }}>{t("contextual.aplicarCambio")}</button> : null}
      </article>)}
      {!cargando && mensajes.length === 0 ? <p>{t("contextual.sinMensajes")}</p> : null}
    </div>
    <div className="contextual-composer">
    {error ? <p role="alert">{error}</p> : null}
    {estadoAccion ? <p className="assistant-action-status" role="status">{t(estadoAccion === "aclaracion" ? "contextual.aclaracion" : `ia.${estadoAccion}`)}</p> : null}
    {espera ? <p role="status">{espera}s</p> : null}
    {error && solicitudPendiente.current ? <button type="button" disabled={consultando || espera > 0} onClick={() => void preguntar(solicitudPendiente.current?.contenido, solicitudPendiente.current?.archivo)}>↻ {t("contextual.preguntar")}</button> : null}
    <label htmlFor="pregunta-contextual">{t("contextual.pregunta")}</label>
    <textarea ref={entrada} rows={3} id="pregunta-contextual" value={pregunta} placeholder={t("contextual.placeholder")} onChange={(evento) => establecerPregunta(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) { evento.preventDefault(); void enviar() } }} />
    {imagen ? <div className="chat-attachment">{vistaPrevia ? <img src={vistaPrevia} alt={t("imagen.vistaPrevia")} /> : null}<span>{imagen.name}</span><button type="button" disabled={consultando} onClick={() => establecerImagen(null)}>{t("chat.quitarImagen")}</button><p>PNG/JPEG ≤10 MB · XMI/XML ≤5 MB. La instrucción se envía junto al archivo; aplicar requiere confirmación.</p></div> : null}
    <div className="contextual-composer-controls">
    <label className="chat-attach-control">{t("chat.adjuntarImagen")} · XMI<input type="file" accept="image/png,image/jpeg,.xmi,.xml" aria-label={t("chat.adjuntarImagen")} disabled={consultando || imagenOcupada || vozOcupada} onChange={(evento) => {
      const archivo = evento.target.files?.[0]; evento.target.value = ""
      if (!archivo) return
      const xmi = /\.(xmi|xml)$/i.test(archivo.name)
      if ((!xmi && !["image/png", "image/jpeg"].includes(archivo.type)) || archivo.size === 0 || archivo.size > (xmi ? 5 : 10) * 1024 * 1024) { establecerError(xmi ? "XMI/XML: archivo vacío o mayor a 5 MB." : t("chat.imagenInvalida")); return }
      establecerError(null); establecerImagen(archivo)
    }} /></label>
    <GrabadorInstruccionVoz mostrarTranscripcion={false} deshabilitado={consultando || imagenOcupada} alCambiarOcupado={establecerVozOcupada} alReconocer={async (texto) => {
      establecerPregunta((actual) => actual ? `${actual}\n${texto}` : texto)
      establecerEstadoVoz(true); entrada.current?.focus()
    }} />
    <button type="button" disabled={consultando || vozOcupada || imagenOcupada || espera > 0 || (!pregunta.trim() && !imagen)} onClick={() => void enviar()}>{consultando ? t("contextual.consultando") : imagenOcupada ? t("imagen.analizando") : t("contextual.preguntar")}</button>
    </div>
    {estadoVoz ? <p className="chat-compose-note" role="status">{t("chat.revisarVoz")}</p> : null}
    <details className="contextual-suggestions"><summary>{t("chat.sugerencias")}</summary>
    <p className="contextual-hint">{t(claveOrientacion[orientacion])}</p>
    <div className="contextual-quick-prompts">
      {preguntasPorEstado[obtenerGrupoPreguntasRapidas(contexto)].map((clave) => <button type="button" disabled={consultando || vozOcupada || imagenOcupada || espera > 0} key={clave} onClick={() => void preguntar(t(clave))}>{t(clave)}</button>)}
    </div>
    <p className="ai-note">{t("contextual.noMuta")}</p></details>
    </div>
  </aside>
}

function VistaAdjunto({ archivo }: { archivo: File }) {
  const [url, establecerUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!archivo.type.startsWith("image/") || typeof URL.createObjectURL !== "function") return
    const actual = URL.createObjectURL(archivo); establecerUrl(actual)
    return () => URL.revokeObjectURL(actual)
  }, [archivo])
  return <div className="chat-attachment">{url ? <img src={url} alt={archivo.name} /> : null}<span>{archivo.name}</span></div>
}

// Solo párrafos, listas y énfasis; React escapa todo el texto, incluido HTML generado.
function formatearMensaje(contenido: string) {
  return contenido.split(/\n\s*\n/).flatMap((bloque, bloqueIndice) => {
    const grupos: Array<{ tipo: "p" | "ul" | "ol"; lineas: string[] }> = []
    for (const linea of bloque.split("\n")) {
      const item = /^\s*(-|\*|\d+[.)])\s+(.+)$/.exec(linea)
      const tipo = item ? /^\d/.test(item[1]) ? "ol" : "ul" : "p"
      if (grupos.at(-1)?.tipo !== tipo) grupos.push({ tipo, lineas: [] })
      grupos.at(-1)!.lineas.push(item ? item[2] : linea)
    }
    return grupos.map(({ tipo, lineas }, indice) => {
      const clave = `${bloqueIndice}-${indice}`
      if (tipo === "p") return <p key={clave}>{formatearEnfasis(lineas.join("\n"))}</p>
      const Lista = tipo
      return <Lista key={clave}>{lineas.map((linea, item) => <li key={item}>{formatearEnfasis(linea)}</li>)}</Lista>
    })
  })
}

function formatearEnfasis(contenido: string) {
  return contenido.split(/(\*\*[^*]+\*\*)/g).map((parte, indice) => parte.startsWith("**") && parte.endsWith("**")
    ? <strong key={indice}>{parte.slice(2, -2)}</strong> : parte)
}

function resultadoMensajes(resultado: Awaited<ReturnType<typeof consultarAsistenteContextual>>): MensajeColaborativo[] {
  return "mensajeIA" in resultado && resultado.mensajeIA ? [resultado.mensajeIA] : []
}
