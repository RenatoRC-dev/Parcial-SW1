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

interface PropiedadesPanelAsistenteContextual {
  projectId: string
  credential: string
  contexto: ContextoAsistente
  modelo: ModeloUMLCanonico
  revisionEditor: number
  alAplicarModelo: (modelo: ModeloUMLCanonico) => void
  consultar?: typeof consultarAsistenteContextual
  cargar?: typeof cargarMensajesColaborativos
  conectar?: typeof conectarConversacionColaborativa
}

export function PanelAsistenteContextual({ projectId, credential, contexto, modelo, revisionEditor, alAplicarModelo, consultar = consultarAsistenteContextual, cargar = cargarMensajesColaborativos, conectar = conectarConversacionColaborativa }: PropiedadesPanelAsistenteContextual) {
  const { t } = usarPreferenciasUI()
  const [pregunta, establecerPregunta] = useState("")
  const [mensajes, establecerMensajes] = useState<MensajeColaborativo[]>([])
  const [cursorAnterior, establecerCursorAnterior] = useState<string | null>(null)
  const [error, establecerError] = useState<string | null>(null)
  const [consultando, establecerConsultando] = useState(false)
  const [espera, establecerEspera] = useState(0)
  const [estadoAccion, establecerEstadoAccion] = useState<"interpretando" | "aplicando" | "listo" | "aclaracion" | null>(null)
  const [cargando, establecerCargando] = useState(true)
  const solicitudPendiente = useRef<{ contenido: string; requestId: string } | null>(null)
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
    if (!limpia || consultando || espera) return
    const pendiente = solicitudPendiente.current
    const requestId = pendiente?.contenido === limpia ? pendiente.requestId : crypto.randomUUID()
    solicitudPendiente.current = { contenido: limpia, requestId }
    establecerConsultando(true); establecerError(null); establecerEstadoAccion("interpretando")
    try {
      const resultado = await consultar(projectId, credential, requestId, limpia, contexto, estadoModelo.current.modelo, estadoModelo.current.revision)
      establecerMensajes((actuales) => combinarMensajes(actuales, [resultado.mensajeHumano, ...resultadoMensajes(resultado)]))
      if (resultado.kind === "action") {
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
    } catch (fallo) {
      establecerEstadoAccion(null)
      if (fallo instanceof ErrorConsultaContextual && fallo.tipo === "limite") establecerEspera(fallo.retryAfterSeconds ?? 30)
      establecerError(fallo instanceof ErrorConsultaContextual || fallo instanceof Error ? fallo.message : t("contextual.errorInterno"))
    } finally { establecerConsultando(false) }
  }

  return <aside className="contextual-assistant-panel" data-testid="panel-asistente-colaborativo">
    <h2>{t("contextual.titulo")}</h2>
    <p className="contextual-hint"><strong>{t("contextual.orientacionSistema")}:</strong> {t(claveOrientacion[orientacion])}</p>
    <div className="contextual-conversation" aria-live="polite" aria-busy={cargando}>
      {cursorAnterior ? <button type="button" disabled={cargando} onClick={() => { establecerCargando(true); void cargarHistoria(cursorAnterior) }}>{t("contextual.cargarAnteriores")}</button> : null}
      {mensajes.map((mensaje) => <article className={mensaje.tipoRemitente === "ai" ? "contextual-answer" : "contextual-message"} key={mensaje.id} data-message-id={mensaje.id}>
        <strong>{mensaje.tipoRemitente === "ai" ? t("contextual.ia") : mensaje.nombreVisibleSnapshot ?? t("contextual.sistema")}:</strong>
        <div className="contextual-message-body">{mensaje.tipoRemitente === "ai" ? formatearMensaje(mensaje.contenido) : mensaje.contenido}</div>
      </article>)}
      {!cargando && mensajes.length === 0 ? <p>{t("contextual.sinMensajes")}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
    {estadoAccion ? <p className="assistant-action-status" role="status">{t(estadoAccion === "aclaracion" ? "contextual.aclaracion" : `ia.${estadoAccion}`)}</p> : null}
    {espera ? <p role="status">{espera}s</p> : null}
    {error && solicitudPendiente.current ? <button type="button" disabled={consultando || espera > 0} onClick={() => void preguntar(solicitudPendiente.current?.contenido)}>↻ {t("contextual.preguntar")}</button> : null}
    <label htmlFor="pregunta-contextual">{t("contextual.pregunta")}</label>
    <input id="pregunta-contextual" value={pregunta} placeholder={t("contextual.placeholder")} onChange={(evento) => establecerPregunta(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter" && !evento.shiftKey) void preguntar() }} />
    <button type="button" disabled={consultando || espera > 0 || !pregunta.trim()} onClick={() => void preguntar()}>{consultando ? t("contextual.consultando") : t("contextual.preguntar")}</button>
    <div className="contextual-quick-prompts">
      {preguntasPorEstado[obtenerGrupoPreguntasRapidas(contexto)].map((clave) => <button type="button" disabled={consultando || espera > 0} key={clave} onClick={() => void preguntar(t(clave))}>{t(clave)}</button>)}
    </div>
    <p className="ai-note">{t("contextual.noMuta")}</p>
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
