import { useCallback, useEffect, useRef, useState } from "react"
import { usarPreferenciasUI, type ClaveTexto } from "../../../../configuracion/PreferenciasUI"
import { conectarConversacionColaborativa } from "./conectarConversacionColaborativa"
import {
  cargarMensajesColaborativos,
  combinarMensajes,
  consultarAsistenteContextual,
  ErrorConsultaContextual,
  type MensajeColaborativo,
} from "./consultarAsistenteContextual"
import { obtenerGrupoPreguntasRapidas, obtenerOrientacionDeterminista, type ContextoAsistente } from "./ContextoAsistente"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { aplicarPlanIA } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/procesarInstruccionIA"
import { completarCambioIA } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/solicitarCambioIA"
import type { CambioAplicadoIA } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ComandoModeloUML"
import { GrabadorInstruccionVoz } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/voz/GrabadorInstruccionVoz"
import { PanelModeladoDesdeImagen } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/PanelModeladoDesdeImagen"

interface PropiedadesPanelAsistenteContextual {
  projectId: string
  credential: string
  participantId: string
  contexto: ContextoAsistente
  modelo: ModeloUMLCanonico
  revisionEditor: number
  alAplicarModelo: (modelo: ModeloUMLCanonico) => void
  alAplicarImagen?: (modelo: ModeloUMLCanonico) => void
  alCambiarEstadoCandidato?: (pendiente: boolean) => void
  consultar?: typeof consultarAsistenteContextual
  cargar?: typeof cargarMensajesColaborativos
  conectar?: typeof conectarConversacionColaborativa
}

export function PanelAsistenteContextual({ projectId, credential, participantId, contexto, modelo, revisionEditor, alAplicarModelo, alAplicarImagen = alAplicarModelo, alCambiarEstadoCandidato, consultar = consultarAsistenteContextual, cargar = cargarMensajesColaborativos, conectar = conectarConversacionColaborativa }: PropiedadesPanelAsistenteContextual) {
  const { t } = usarPreferenciasUI()
  const [pregunta, establecerPregunta] = useState("")
  const [mensajes, establecerMensajes] = useState<MensajeColaborativo[]>([])
  const [cursorAnterior, establecerCursorAnterior] = useState<string | null>(null)
  const [error, establecerError] = useState<string | null>(null)
  const [consultando, establecerConsultando] = useState(false)
  const [espera, establecerEspera] = useState(0)
  const [estadoAccion, establecerEstadoAccion] = useState<"interpretando" | "aplicando" | "listo" | "aclaracion" | null>(null)
  const [cargando, establecerCargando] = useState(true)
  const [vozOcupada, establecerVozOcupada] = useState(false)
  const [imagenOcupada, establecerImagenOcupada] = useState(false)
  const [imagen, establecerImagen] = useState<File | null>(null)
  const [vistaPrevia, establecerVistaPrevia] = useState<string | null>(null)
  const [estadoVoz, establecerEstadoVoz] = useState(false)
  const panelImagen = useRef<{ analizar: () => Promise<void> }>(null)
  const historial = useRef<HTMLDivElement>(null)
  const seguirFinal = useRef(true)
  const entrada = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!imagen || typeof URL.createObjectURL !== "function") { establecerVistaPrevia(null); return }
    const url = URL.createObjectURL(imagen)
    establecerVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [imagen])
  useEffect(() => {
    const contenedor = historial.current
    if (contenedor && seguirFinal.current) contenedor.scrollTop = contenedor.scrollHeight
  }, [mensajes, imagenOcupada])
  const solicitudPendiente = useRef<{ contenido: string; requestId: string } | null>(null)
  const enviando = useRef(false)
  const estadoModelo = useRef({ modelo, revision: revisionEditor })
  const accionesAplicadas = useRef(new Map<string, CambioAplicadoIA[]>())
  estadoModelo.current = { modelo, revision: revisionEditor }
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
      establecerMensajes((actuales) => combinarMensajes(actuales, pagina.items))
      establecerCursorAnterior(pagina.siguienteCursor)
      establecerError(null)
    } catch (fallo) {
      establecerError(fallo instanceof Error ? fallo.message : t("contextual.errorInterno"))
    } finally { establecerCargando(false) }
  }, [cargar, credential, projectId, t])

  useEffect(() => {
    establecerMensajes([]); establecerCargando(true)
    const conexion = conectar({
      projectId, credential,
      alAutenticar: () => { void cargarHistoria() },
      alMensaje: (mensaje) => establecerMensajes((actuales) => combinarMensajes(actuales, [mensaje])),
      alError: (mensaje) => { establecerError(mensaje); void cargarHistoria() },
    })
    return () => conexion.desconectar()
  }, [cargarHistoria, conectar, credential, projectId])

  const preguntar = async (texto = pregunta) => {
    const limpia = texto.trim()
    if (!limpia || enviando.current || espera || vozOcupada || imagenOcupada) return
    enviando.current = true
    const pendiente = solicitudPendiente.current
    const requestId = pendiente?.contenido === limpia ? pendiente.requestId : crypto.randomUUID()
    solicitudPendiente.current = { contenido: limpia, requestId }
    establecerConsultando(true); establecerError(null); establecerEstadoAccion("interpretando")
    try {
      const resultado = await consultar(projectId, credential, requestId, limpia, contexto, estadoModelo.current.modelo, estadoModelo.current.revision)
      establecerMensajes((actuales) => combinarMensajes(actuales, [resultado.mensajeHumano, ...resultadoMensajes(resultado)]))
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
      establecerEstadoVoz(false)
    } catch (fallo) {
      establecerEstadoAccion(null)
      if (fallo instanceof ErrorConsultaContextual && fallo.tipo === "limite") establecerEspera(fallo.retryAfterSeconds ?? 30)
      establecerError(fallo instanceof ErrorConsultaContextual || fallo instanceof Error ? fallo.message : t("contextual.errorInterno"))
    } finally { enviando.current = false; establecerConsultando(false) }
  }

  const enviar = async () => {
    if (!imagen) { await preguntar(); return }
    if (enviando.current || vozOcupada || imagenOcupada || espera) return
    enviando.current = true
    try { await panelImagen.current?.analizar() }
    finally { enviando.current = false }
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
    <div ref={historial} className="contextual-conversation" role="log" aria-label={t("chat.historial")} aria-live="polite" aria-busy={cargando} tabIndex={0} onScroll={(evento) => { const nodo = evento.currentTarget; seguirFinal.current = nodo.scrollHeight - nodo.scrollTop - nodo.clientHeight < 100 }}>
      {cursorAnterior ? <button type="button" disabled={cargando} onClick={() => { seguirFinal.current = false; establecerCargando(true); void cargarHistoria(cursorAnterior) }}>{t("contextual.cargarAnteriores")}</button> : null}
      {mensajes.map((mensaje) => <article className={mensaje.tipoRemitente === "ai" ? "contextual-answer" : "contextual-message"} key={mensaje.id} data-message-id={mensaje.id}>
        <strong>{mensaje.tipoRemitente === "ai" ? t("contextual.ia") : mensaje.nombreVisibleSnapshot ?? t("contextual.sistema")}:</strong>
        <div className="contextual-message-body">{mensaje.tipoRemitente === "ai" ? formatearMensaje(mensaje.contenido) : mensaje.contenido}</div>
        {mensaje.id === propuestaPendiente ? <button type="button" disabled={consultando || vozOcupada || imagenOcupada || espera > 0} title={t("contextual.validarPropuesta")} onClick={() => {
          // Instrucción explícita para el clasificador existente; nunca ejecutar
          // directamente ni reinterpretar una propuesta desde su texto visible.
          void preguntar(`Aplica la propuesta: ${recomendacion!.normalizedInstruction}`)
        }}>{t("contextual.aplicarCambio")}</button> : null}
      </article>)}
      {!cargando && mensajes.length === 0 ? <p>{t("contextual.sinMensajes")}</p> : null}
      <PanelModeladoDesdeImagen ref={panelImagen} integrado imagenAdjunta={imagen} modelo={modelo} alAplicarModelo={alAplicarImagen} alConsumirImagen={() => establecerImagen(null)} alCambiarOcupado={establecerImagenOcupada} alCambiarEstadoCandidato={alCambiarEstadoCandidato} />
    </div>
    <div className="contextual-composer">
    {error ? <p role="alert">{error}</p> : null}
    {estadoAccion ? <p className="assistant-action-status" role="status">{t(estadoAccion === "aclaracion" ? "contextual.aclaracion" : `ia.${estadoAccion}`)}</p> : null}
    {espera ? <p role="status">{espera}s</p> : null}
    {error && solicitudPendiente.current ? <button type="button" disabled={consultando || espera > 0} onClick={() => void preguntar(solicitudPendiente.current?.contenido)}>↻ {t("contextual.preguntar")}</button> : null}
    <label htmlFor="pregunta-contextual">{t("contextual.pregunta")}</label>
    <textarea ref={entrada} rows={3} id="pregunta-contextual" value={pregunta} placeholder={t("contextual.placeholder")} onChange={(evento) => establecerPregunta(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) { evento.preventDefault(); void enviar() } }} />
    {imagen ? <div className="chat-attachment">{vistaPrevia ? <img src={vistaPrevia} alt={t("imagen.vistaPrevia")} /> : null}<span>{imagen.name}</span><button type="button" disabled={imagenOcupada} onClick={() => establecerImagen(null)}>{t("chat.quitarImagen")}</button><p>{t("chat.limiteContextoImagen")}</p></div> : null}
    <div className="contextual-composer-controls">
    <label className="chat-attach-control">{t("chat.adjuntarImagen")}<input type="file" accept="image/png,image/jpeg" aria-label={t("chat.adjuntarImagen")} disabled={consultando || imagenOcupada || vozOcupada} onChange={(evento) => {
      const archivo = evento.target.files?.[0]; evento.target.value = ""
      if (!archivo) return
      if (!["image/png", "image/jpeg"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) { establecerError(t("chat.imagenInvalida")); return }
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
