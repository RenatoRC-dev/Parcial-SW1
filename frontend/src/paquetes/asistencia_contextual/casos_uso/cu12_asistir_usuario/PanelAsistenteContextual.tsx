import { useState } from "react"
import { usarPreferenciasUI, type ClaveTexto } from "../../../../configuracion/PreferenciasUI"
import { consultarAsistenteContextual } from "./consultarAsistenteContextual"
import { obtenerOrientacionDeterminista, type ContextoAsistente, type MensajeConversacionContextual, type RespuestaAsistenteContextual } from "./ContextoAsistente"

interface PropiedadesPanelAsistenteContextual {
  contexto: ContextoAsistente
  consultar?: typeof consultarAsistenteContextual
}

export function PanelAsistenteContextual({ contexto, consultar = consultarAsistenteContextual }: PropiedadesPanelAsistenteContextual) {
  const { t } = usarPreferenciasUI()
  const [pregunta, establecerPregunta] = useState("")
  const [conversacion, establecerConversacion] = useState<MensajeConversacionContextual[]>([])
  const [respuesta, establecerRespuesta] = useState<RespuestaAsistenteContextual | null>(null)
  const [error, establecerError] = useState<string | null>(null)
  const [consultando, establecerConsultando] = useState(false)
  const orientacion = obtenerOrientacionDeterminista(contexto)
  const claveOrientacion: Record<typeof orientacion, ClaveTexto> = {
    SIN_CLASES: "contextual.hintSinClases", UML_INVALIDO: "contextual.hintInvalido", IMAGEN_PENDIENTE: "contextual.hintImagen",
    NM_DIRECTO: "contextual.hintNm", LISTO_GENERAR: "contextual.hintListo", REVISAR_GENERACION: "contextual.hintRevisar",
  }
  const claveAccion: Record<RespuestaAsistenteContextual["accionSugerida"], ClaveTexto> = {
    NINGUNA: "contextual.accionNinguna", ENFOCAR_ELEMENTO: "contextual.accionEnfocar", IR_A_VALIDACION: "contextual.accionValidacion",
    IR_A_GENERACION: "contextual.accionGeneracion", IR_A_XMI: "contextual.accionXmi", MOSTRAR_IMAGEN_CANDIDATA: "contextual.accionImagen",
  }
  const preguntasRapidas: ClaveTexto[] = ["contextual.rapidaAhora", "contextual.rapidaListo", "contextual.rapidaGenerar"]

  const preguntar = async (texto = pregunta) => {
    const limpia = texto.trim()
    if (!limpia || consultando) return
    establecerConsultando(true); establecerError(null)
    try {
      const obtenida = await consultar(limpia, contexto, conversacion)
      establecerRespuesta(obtenida)
      establecerConversacion((actual) => [
        ...actual,
        { rol: "usuario" as const, contenido: limpia },
        { rol: "asistente" as const, contenido: obtenida.respuesta },
      ].slice(-8))
      establecerPregunta("")
    } catch (fallo) {
      establecerError(fallo instanceof Error ? fallo.message : t("contextual.noDisponible"))
    } finally { establecerConsultando(false) }
  }

  return <aside className="contextual-assistant-panel" data-testid="panel-asistente-contextual">
    <h2>{t("contextual.titulo")}</h2>
    <p className="contextual-hint"><strong>{t("contextual.orientacionSistema")}:</strong> {t(claveOrientacion[orientacion])}</p>
    <div className="contextual-conversation" aria-live="polite">
      {conversacion.map((mensaje, indice) => <p key={`${indice}-${mensaje.rol}`}><strong>{mensaje.rol === "usuario" ? t("contextual.tu") : t("contextual.ia")}:</strong> {mensaje.contenido}</p>)}
      {respuesta && respuesta.accionSugerida !== "NINGUNA" ? <p><strong>{t("contextual.accion")}:</strong> {t(claveAccion[respuesta.accionSugerida])}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
    <label htmlFor="pregunta-contextual">{t("contextual.pregunta")}</label>
    <input id="pregunta-contextual" value={pregunta} placeholder={t("contextual.placeholder")} onChange={(evento) => establecerPregunta(evento.target.value)} />
    <button type="button" disabled={consultando || !pregunta.trim()} onClick={() => void preguntar()}>{consultando ? t("contextual.consultando") : t("contextual.preguntar")}</button>
    <div className="contextual-quick-prompts">
      {preguntasRapidas.map((clave) => <button type="button" disabled={consultando} key={clave} onClick={() => void preguntar(t(clave))}>{t(clave)}</button>)}
    </div>
    <p className="ai-note">{t("contextual.noMuta")}</p>
  </aside>
}
