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

interface PropiedadesPanelAsistenteContextual {
  projectId: string
  credential: string
  contexto: ContextoAsistente
  consultar?: typeof consultarAsistenteContextual
  cargar?: typeof cargarMensajesColaborativos
  conectar?: typeof conectarConversacionColaborativa
}

export function PanelAsistenteContextual({ projectId, credential, contexto, consultar = consultarAsistenteContextual, cargar = cargarMensajesColaborativos, conectar = conectarConversacionColaborativa }: PropiedadesPanelAsistenteContextual) {
  const { t } = usarPreferenciasUI()
  const [pregunta, establecerPregunta] = useState("")
  const [mensajes, establecerMensajes] = useState<MensajeColaborativo[]>([])
  const [cursorAnterior, establecerCursorAnterior] = useState<string | null>(null)
  const [error, establecerError] = useState<string | null>(null)
  const [consultando, establecerConsultando] = useState(false)
  const [cargando, establecerCargando] = useState(true)
  const solicitudPendiente = useRef<{ contenido: string; requestId: string } | null>(null)
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
    if (!limpia || consultando) return
    const pendiente = solicitudPendiente.current
    const requestId = pendiente?.contenido === limpia ? pendiente.requestId : crypto.randomUUID()
    solicitudPendiente.current = { contenido: limpia, requestId }
    establecerConsultando(true); establecerError(null)
    try {
      const resultado = await consultar(projectId, credential, requestId, limpia, contexto)
      establecerMensajes((actuales) => combinarMensajes(actuales, [resultado.mensajeHumano, resultado.mensajeIA]))
      solicitudPendiente.current = null
      establecerPregunta("")
    } catch (fallo) {
      establecerError(fallo instanceof ErrorConsultaContextual || fallo instanceof Error ? fallo.message : t("contextual.errorInterno"))
    } finally { establecerConsultando(false) }
  }

  return <aside className="contextual-assistant-panel" data-testid="panel-asistente-colaborativo">
    <h2>{t("contextual.titulo")}</h2>
    <p className="contextual-hint"><strong>{t("contextual.orientacionSistema")}:</strong> {t(claveOrientacion[orientacion])}</p>
    <div className="contextual-conversation" aria-live="polite" aria-busy={cargando}>
      {cursorAnterior ? <button type="button" disabled={cargando} onClick={() => { establecerCargando(true); void cargarHistoria(cursorAnterior) }}>{t("contextual.cargarAnteriores")}</button> : null}
      {mensajes.map((mensaje) => <article className={mensaje.tipoRemitente === "ai" ? "contextual-answer" : "contextual-message"} key={mensaje.id} data-message-id={mensaje.id}>
        <strong>{mensaje.tipoRemitente === "ai" ? t("contextual.ia") : mensaje.nombreVisibleSnapshot ?? t("contextual.sistema")}:</strong> {mensaje.contenido}
      </article>)}
      {!cargando && mensajes.length === 0 ? <p>{t("contextual.sinMensajes")}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
    <label htmlFor="pregunta-contextual">{t("contextual.pregunta")}</label>
    <input id="pregunta-contextual" value={pregunta} placeholder={t("contextual.placeholder")} onChange={(evento) => establecerPregunta(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter" && !evento.shiftKey) void preguntar() }} />
    <button type="button" disabled={consultando || !pregunta.trim()} onClick={() => void preguntar()}>{consultando ? t("contextual.consultando") : t("contextual.preguntar")}</button>
    <div className="contextual-quick-prompts">
      {preguntasPorEstado[obtenerGrupoPreguntasRapidas(contexto)].map((clave) => <button type="button" disabled={consultando} key={clave} onClick={() => void preguntar(t(clave))}>{t(clave)}</button>)}
    </div>
    <p className="ai-note">{t("contextual.noMuta")}</p>
  </aside>
}
