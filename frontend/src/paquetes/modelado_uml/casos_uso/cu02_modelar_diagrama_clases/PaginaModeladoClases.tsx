import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import type { ApollonEditor, UMLModel } from "@tumaet/apollon"
import {
  convertirAModeloCanonicoConAdvertencias,
  convertirDesdeModeloCanonico,
  normalizarAsociacionesSinNavegabilidad,
} from "../../compartido/integracion_apollon/AdaptadorApollon"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { evaluarAptitudGeneracionSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/EvaluadorAptitudGeneracionSpring"
import { PanelGeneracionSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PanelGeneracionSpring"
import { AnfitrionEditorApollon } from "./componentes/AnfitrionEditorApollon"
import { InspectorModeloDesarrollo } from "./componentes/InspectorModeloDesarrollo"
import { LimiteErrorEditor } from "./componentes/LimiteErrorEditor"
import { PanelInteroperabilidadXmi } from "../../../interoperabilidad/compartido/PanelInteroperabilidadXmi"
import { PanelColaboracion } from "../../../colaboracion/casos_uso/cu03_colaborar_modelo/PanelColaboracion"
import { PanelModeladoDesdeImagen } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/PanelModeladoDesdeImagen"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { etiquetasApollon, usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import { InspectorPropiedadesUML } from "./componentes/InspectorPropiedadesUML"
import { construirContextoAsistente } from "../../../asistencia_contextual/casos_uso/cu12_asistir_usuario/ContextoAsistente"
import { PanelAsistenteContextual } from "../../../asistencia_contextual/casos_uso/cu12_asistir_usuario/PanelAsistenteContextual"
import type { AccesoProyectoActivo, ActividadModeladoManual } from "../../../gestion_proyectos/compartido/Proyecto"
import { registrarActividadIntegracion, registrarActividadModelado } from "../../../gestion_proyectos/compartido/clienteProyectos"

type HerramientaModelado = "ia" | "imagen" | "validacion" | "xmi" | "generacion"

export function PaginaModeladoClases({ proyectoId, proyectoNombre, accesoColaboracion, modeloInicial, cambiosSinGuardar = false, alCambiarModeloCanonico }: {
  proyectoId: string
  proyectoNombre?: string
  accesoColaboracion: AccesoProyectoActivo
  modeloInicial: ModeloUMLCanonico
  cambiosSinGuardar?: boolean
  alCambiarModeloCanonico: (modelo: ModeloUMLCanonico) => void
}) {
  const { idioma, temaAplicado, t } = usarPreferenciasUI()
  const [modelo, establecerModelo] = useState<UMLModel | null>(null)
  const [errorEditor, establecerErrorEditor] = useState<string | null>(null)
  const [modeloImportado, establecerModeloImportado] = useState<UMLModel | undefined>(() => convertirDesdeModeloCanonico(modeloInicial))
  const [editor, establecerEditor] = useState<ApollonEditor | null>(null)
  const [revisionModelo, establecerRevisionModelo] = useState(0)
  const [modeloInicialAplicado, establecerModeloInicialAplicado] = useState(false)
  const [candidatoImagenPendiente, establecerCandidatoImagenPendiente] = useState(false)
  const [candidatoChatPendiente, establecerCandidatoChatPendiente] = useState(false)
  const [anchoAsistente, establecerAnchoAsistente] = useState(400)
  const [herramientaActiva, establecerHerramientaActiva] = useState<HerramientaModelado>("ia")
  const [assistantOpen, setAssistantOpen] = useState(() => window.innerWidth >= 960)
  const [propertiesOpen, setPropertiesOpen] = useState(() => window.innerWidth >= 960)
  const [modoFoco, establecerModoFoco] = useState(false)
  const asistenteVisible = assistantOpen && !modoFoco
  const propiedadesVisibles = propertiesOpen && !modoFoco
  const controlAsistente = useRef<HTMLButtonElement>(null)
  const controlInspector = useRef<HTMLButtonElement>(null)
  const [seleccionIds, establecerSeleccionIds] = useState<string[]>([])
  const revisionActual = useRef(0)

  const recibirCambioModelo = useCallback((modeloActualizado: UMLModel) => {
    const modeloNormalizado = normalizarAsociacionesSinNavegabilidad(modeloActualizado)
    establecerModelo(modeloNormalizado)
    if (modeloNormalizado !== modeloActualizado) {
      establecerModeloImportado(modeloNormalizado)
    }
    revisionActual.current += 1
    establecerRevisionModelo(revisionActual.current)
    establecerErrorEditor(null)
  }, [])

  const registrarErrorEditor = useCallback((error: Error) => {
    establecerErrorEditor(error.message)
  }, [])
  const registrarModeloInicialAplicado = useCallback(() => {
    establecerModeloInicialAplicado(true)
  }, [])
  const aplicarDesdeInspector = useCallback((modeloCanonico: ModeloUMLCanonico) => {
    const modeloApollon = convertirDesdeModeloCanonico(modeloCanonico)
    establecerModelo(modeloApollon)
    establecerModeloImportado(modeloApollon)
  }, [])
  const registrarActividadLocal = useCallback((actividad: ActividadModeladoManual) => {
    const clientChangeId = crypto.randomUUID()
    void registrarActividadModelado(proyectoId, accesoColaboracion.credential, clientChangeId, actividad).catch(() => undefined)
  }, [accesoColaboracion.credential, proyectoId])
  const registrarAplicacionImagen = useCallback((anterior: ModeloUMLCanonico, aplicado: ModeloUMLCanonico) => {
    const clasesAnteriores = new Set(anterior.clases.map((clase) => clase.id))
    const relacionesAnteriores = new Set(anterior.relaciones.map((relacion) => relacion.id))
    const nombresClases = new Map(aplicado.clases.map((clase) => [clase.id, clase.nombre]))
    const elementos = [
      ...aplicado.clases.filter((clase) => !clasesAnteriores.has(clase.id)).map((clase) => ({ id: clase.id, tipo: "class" as const, nombreSnapshot: clase.nombre })),
      ...aplicado.relaciones.filter((relacion) => !relacionesAnteriores.has(relacion.id)).map((relacion) => ({ id: relacion.id, tipo: "relationship" as const, nombreSnapshot: (relacion.nombre?.trim() || `${nombresClases.get(relacion.claseOrigenId) ?? relacion.claseOrigenId} - ${nombresClases.get(relacion.claseDestinoId) ?? relacion.claseDestinoId}`).slice(0, 120) })),
    ]
    for (const elemento of elementos) {
      void registrarActividadIntegracion(proyectoId, accesoColaboracion.credential, crypto.randomUUID(), {
        mecanismo: "image_cu05", tipo: "UML_ELEMENT_CREATED", elemento,
      }).catch(() => undefined)
    }
  }, [accesoColaboracion.credential, proyectoId])
  const registrarImportacionXmi = useCallback(() => {
    void registrarActividadIntegracion(proyectoId, accesoColaboracion.credential, crypto.randomUUID(), {
      mecanismo: "xmi", tipo: "XMI_IMPORTED", elemento: null,
    }).catch(() => undefined)
  }, [accesoColaboracion.credential, proyectoId])

  const resultadoCanonico = useMemo(
    () =>
      modelo ? convertirAModeloCanonicoConAdvertencias(modelo) : null,
    [modelo]
  )
  const resultadoValidacion = useMemo(
    () =>
      resultadoCanonico ? validarModelo(resultadoCanonico.modelo) : null,
    [resultadoCanonico]
  )
  const aptitudGeneracion = useMemo(
    () =>
      resultadoCanonico && resultadoValidacion
        ? evaluarAptitudGeneracionSpring(
            resultadoCanonico.modelo,
            resultadoValidacion
          )
        : null,
    [resultadoCanonico, resultadoValidacion]
  )
  const contextoAsistente = useMemo(
    () => resultadoCanonico && resultadoValidacion && aptitudGeneracion
      ? construirContextoAsistente({
          proyectoId,
          proyectoNombre,
          modelo: resultadoCanonico.modelo,
          validacion: resultadoValidacion,
          aptitud: aptitudGeneracion,
          cambiosSinGuardar,
          candidatoImagenPendiente: candidatoImagenPendiente || candidatoChatPendiente,
          seleccionIds,
          revisionModelo,
          idioma,
        })
      : null,
    [aptitudGeneracion, cambiosSinGuardar, candidatoImagenPendiente, candidatoChatPendiente, idioma, proyectoId, proyectoNombre, resultadoCanonico, resultadoValidacion, revisionModelo, seleccionIds]
  )

  useEffect(() => {
    if (resultadoCanonico) alCambiarModeloCanonico({
      ...resultadoCanonico.modelo,
      id: modeloInicial.id,
      nombre: modeloInicial.nombre,
      version: modeloInicial.version,
    })
  }, [resultadoCanonico, alCambiarModeloCanonico, modeloInicial.id, modeloInicial.nombre, modeloInicial.version])

  const cerrarHerramienta = () => {
    setAssistantOpen(false)
    controlAsistente.current?.focus()
  }
  const cerrarInspector = () => {
    setPropertiesOpen(false)
    controlInspector.current?.focus()
  }
  const alternarAsistente = () => {
    setAssistantOpen((actual) => modoFoco ? true : !actual)
    establecerModoFoco(false)
  }
  const alternarInspector = () => {
    setPropertiesOpen((actual) => modoFoco ? true : !actual)
    establecerModoFoco(false)
  }

  return (
    <main className="app-shell">
      {errorEditor ? (
        <div className="error-banner" role="alert">
          <strong>{t("modelado.error")}</strong> {errorEditor}
        </div>
      ) : null}

      <section style={{ "--assistant-preferred-width": `${anchoAsistente}px` } as CSSProperties} className={`modeling-workspace${asistenteVisible ? " has-tool-panel" : ""}${propiedadesVisibles ? " has-inspector-panel" : ""}`} data-focus-mode={modoFoco || (!assistantOpen && !propertiesOpen)} aria-label={t("modelado.espacio")}>
        <nav className="tool-rail" aria-label={t("shell.herramientas")}>
          {([['ia', 'modelo', '◇'], ['imagen', 'imagen', '▧'], ['validacion', 'validacion', '✓'], ['xmi', 'xmi', '⇄'], ['generacion', 'generar', '⌘']] as const).map(([vista, etiqueta, icono]) => <button key={vista} type="button" className={herramientaActiva === vista ? "active" : ""} aria-current={herramientaActiva === vista ? "page" : undefined} aria-controls="workspace-main" onClick={() => establecerHerramientaActiva(vista)}><span aria-hidden="true">{icono}</span>{t(`shell.${etiqueta}`)}</button>)}
        </nav>

          <aside id="workspace-tools" className="tool-drawer" hidden={!asistenteVisible} aria-label={t("shell.panelHerramientas")} onKeyDown={(evento) => { if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); cerrarHerramienta() } }}>
            <div className="tool-drawer-heading"><strong>{t("contextual.titulo")}</strong><button type="button" aria-label={t("shell.cerrarPanel")} title={t("shell.cerrarPanel")} onClick={cerrarHerramienta}>×</button></div>
            <input className="assistant-width-control" type="range" min={280} max={520} step={20} value={anchoAsistente} aria-label={t("chat.ancho")} title={t("chat.ancho")} onChange={(evento) => establecerAnchoAsistente(Number(evento.target.value))} />
            <div className="tool-drawer-content assistant-active">
              <div>
                {contextoAsistente && resultadoCanonico ? <PanelAsistenteContextual projectId={proyectoId} credential={accesoColaboracion.credential} participantId={accesoColaboracion.participantId} contexto={contextoAsistente} modelo={resultadoCanonico.modelo} revisionEditor={revisionModelo} alAplicarModelo={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))} alAplicarImagen={(modeloCanonico) => { establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico)); registrarAplicacionImagen(resultadoCanonico.modelo, modeloCanonico) }} alAplicarXmi={(modeloCanonico) => { establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico)); registrarImportacionXmi() }} alCambiarEstadoCandidato={establecerCandidatoChatPendiente} /> : null}
              </div>
            </div>
          </aside>

        <div className="canvas-stage" id="workspace-main">
          <div className="workspace-panel-controls" role="group" aria-label={t("workspace.paneles")}>
            <button ref={controlAsistente} type="button" aria-controls="workspace-tools" aria-expanded={asistenteVisible} onClick={alternarAsistente}>{t("workspace.asistente")}</button>
            <button ref={controlInspector} type="button" aria-controls="workspace-properties" aria-expanded={propiedadesVisibles} onClick={alternarInspector}>{t("propiedades.titulo")}</button>
            <button type="button" aria-controls="workspace-tools workspace-properties" aria-pressed={modoFoco} onClick={() => establecerModoFoco((actual) => !actual)}>{t(modoFoco ? "workspace.restaurarPaneles" : "workspace.modoFoco")}</button>
          </div>
          <div className="editor-panel" hidden={herramientaActiva !== "ia"}>
            <LimiteErrorEditor alDetectarError={registrarErrorEditor} titulo={t("editor.fallo")} etiquetaRecargar={t("editor.recargar")}>
              <AnfitrionEditorApollon
                alCambiarModelo={recibirCambioModelo}
                alOcurrirError={registrarErrorEditor}
                modeloParaReemplazar={modeloImportado}
                alCambiarEditor={establecerEditor}
                alAplicarModeloInicial={registrarModeloInicialAplicado}
                labels={etiquetasApollon(idioma)}
                tema={temaAplicado}
              />
            </LimiteErrorEditor>
          </div>
          <div className="feature-surface" hidden={herramientaActiva !== "imagen"}>
            {resultadoCanonico ? <PanelModeladoDesdeImagen modelo={resultadoCanonico.modelo} alAplicarModelo={(modeloCanonico) => { establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico)); registrarAplicacionImagen(resultadoCanonico.modelo, modeloCanonico) }} alCambiarEstadoCandidato={establecerCandidatoImagenPendiente} /> : null}
          </div>
          <div className="feature-surface" hidden={herramientaActiva !== "validacion"}>
            {resultadoValidacion && resultadoCanonico && aptitudGeneracion ? <PanelResumenValidacion resultado={resultadoValidacion} modelo={resultadoCanonico.modelo} aptitud={aptitudGeneracion} /> : null}
          </div>
          <div className="feature-surface" hidden={herramientaActiva !== "xmi"}>
            {resultadoCanonico ? <PanelInteroperabilidadXmi modelo={resultadoCanonico.modelo} alImportar={(modeloCanonico) => { establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico)); registrarImportacionXmi() }} /> : null}
          </div>
          <div className="feature-surface" hidden={herramientaActiva !== "generacion"}>
            {resultadoCanonico && resultadoValidacion && aptitudGeneracion ? <PanelGeneracionSpring modelo={resultadoCanonico.modelo} validacion={resultadoValidacion} aptitud={aptitudGeneracion} /> : null}
          </div>
        </div>

        <aside id="workspace-properties" className="workspace-inspector" hidden={!propiedadesVisibles} aria-label={t("propiedades.titulo")} onKeyDown={(evento) => { if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); cerrarInspector() } }}>
          <button className="workspace-inspector-close" type="button" aria-label={t("workspace.cerrarPropiedades")} title={t("workspace.cerrarPropiedades")} onClick={cerrarInspector}>×</button>
          {resultadoCanonico ? <InspectorPropiedadesUML editor={editor} modelo={resultadoCanonico.modelo} alAplicar={aplicarDesdeInspector} alRegistrarActividad={registrarActividadLocal} alCambiarSeleccion={establecerSeleccionIds} /> : <p className="inspector-empty">{t("propiedades.seleccioneElemento")}</p>}
          <PanelColaboracion editor={editor} acceso={accesoColaboracion} habilitada={modeloInicialAplicado} />
          <details className="technical-diagnostics"><summary>{t("shell.diagnostico")}</summary><InspectorModeloDesarrollo modeloApollon={modelo} resultadoCanonico={resultadoCanonico} resultadoValidacion={resultadoValidacion} error={errorEditor} /></details>
        </aside>
      </section>
      <footer className="workspace-statusbar">
        <span>{resultadoValidacion?.valido ? t("shell.modeloValido") : t("shell.modeloConErrores")}</span>
        <span>{resultadoCanonico?.modelo.clases.length ?? 0} {t("inspector.clases").toLocaleLowerCase()}</span>
        <span>{resultadoCanonico?.modelo.relaciones.length ?? 0} {t("inspector.relaciones").toLocaleLowerCase()}</span>
        <span>{aptitudGeneracion?.apto ? t("shell.generadorListo") : t("shell.generadorBloqueado")}</span>
      </footer>
    </main>
  )
}

export function PanelResumenValidacion({ resultado, modelo, aptitud }: { resultado: NonNullable<ReturnType<typeof validarModelo>>; modelo: ModeloUMLCanonico; aptitud: ReturnType<typeof evaluarAptitudGeneracionSpring> }) {
  const { t } = usarPreferenciasUI()
  const errores = resultado.diagnosticos.filter((item) => item.severidad === "error")
  const advertencias = resultado.diagnosticos.filter((item) => item.severidad === "advertencia")
  const nombres = new Map<string, string>([[modelo.id, modelo.nombre]])
  for (const clase of modelo.clases) {
    nombres.set(clase.id, clase.nombre)
    for (const atributo of clase.atributos) nombres.set(atributo.id, `${clase.nombre}.${atributo.nombre}`)
    for (const metodo of clase.metodos ?? []) {
      nombres.set(metodo.id, `${clase.nombre}.${metodo.nombre}()`)
      for (const parametro of metodo.parametros) nombres.set(parametro.id, `${clase.nombre}.${metodo.nombre}(${parametro.nombre})`)
    }
  }
  for (const relacion of modelo.relaciones) nombres.set(relacion.id, relacion.nombre || `${nombres.get(relacion.claseOrigenId) ?? "?"} ↔ ${nombres.get(relacion.claseDestinoId) ?? "?"}`)
  return <section className="validation-tool-panel" data-testid="panel-validacion-producto" aria-labelledby="titulo-validacion">
    <h2 id="titulo-validacion">{t("inspector.validacion")}</h2>
    <p className="feature-intro">{t("ux.validacionAyuda")}</p>
    <div className="feature-status-grid">
      <div className={`product-status-card ${resultado.valido ? "is-success" : "is-danger"}`}><span>{t("generacion.modelo")}</span><strong>{resultado.valido ? t("shell.modeloValido") : t("shell.modeloConErrores")}</strong><span>{errores.length} {t("inspector.errores").toLocaleLowerCase()} · {advertencias.length} {t("inspector.advertencias").toLocaleLowerCase()}</span></div>
      <div className={`product-status-card ${aptitud.apto ? "is-success" : "is-danger"}`}><span>{t("ux.aptitudSpring")}</span><strong>{aptitud.apto ? t("generacion.apto") : t("generacion.noApto")}</strong></div>
    </div>
    {resultado.diagnosticos.length > 0 ? [errores, advertencias].map((grupo, indiceGrupo) => grupo.length ? <section className="diagnostic-group" key={indiceGrupo} aria-label={t(indiceGrupo === 0 ? "inspector.errores" : "inspector.advertencias")}><h3>{t(indiceGrupo === 0 ? "inspector.errores" : "inspector.advertencias")} ({grupo.length})</h3><ul className="product-diagnostics">{grupo.map((diagnostico, indice) => <li className={`diagnostic-${diagnostico.severidad}`} key={`${diagnostico.codigo}-${indice}`}><p>{diagnostico.mensaje}</p>{diagnostico.elementoId && nombres.has(diagnostico.elementoId) ? <small>{nombres.get(diagnostico.elementoId)}</small> : null}</li>)}</ul></section> : null) : <p className="tool-empty-state">{t("shell.sinDiagnosticos")}</p>}
    {aptitud.motivos.length ? <details className="feature-details"><summary>{t("ux.bloqueosSpring")} ({aptitud.motivos.length})</summary><ul>{aptitud.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul></details> : null}
  </section>
}
