import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { PanelAsistenteModelado } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/PanelAsistenteModelado"
import { PanelModeladoDesdeImagen } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/PanelModeladoDesdeImagen"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { etiquetasApollon, usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import { InspectorPropiedadesUML } from "./componentes/InspectorPropiedadesUML"
import { construirContextoAsistente } from "../../../asistencia_contextual/casos_uso/cu12_asistir_usuario/ContextoAsistente"
import { PanelAsistenteContextual } from "../../../asistencia_contextual/casos_uso/cu12_asistir_usuario/PanelAsistenteContextual"

type HerramientaModelado = "ia" | "imagen" | "validacion" | "xmi" | "generacion"

export function PaginaModeladoClases({ proyectoId, proyectoNombre, modeloInicial, cambiosSinGuardar = false, alCambiarModeloCanonico }: {
  proyectoId: string
  proyectoNombre?: string
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
  const [herramientaActiva, establecerHerramientaActiva] = useState<HerramientaModelado | null>(null)
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
          candidatoImagenPendiente,
          seleccionIds,
          revisionModelo,
          idioma,
        })
      : null,
    [aptitudGeneracion, cambiosSinGuardar, candidatoImagenPendiente, idioma, proyectoId, proyectoNombre, resultadoCanonico, resultadoValidacion, revisionModelo, seleccionIds]
  )

  useEffect(() => {
    if (resultadoCanonico) alCambiarModeloCanonico({
      ...resultadoCanonico.modelo,
      id: modeloInicial.id,
      nombre: modeloInicial.nombre,
      version: modeloInicial.version,
    })
  }, [resultadoCanonico, alCambiarModeloCanonico, modeloInicial.id, modeloInicial.nombre, modeloInicial.version])

  const alternarHerramienta = (herramienta: HerramientaModelado) => {
    establecerHerramientaActiva((actual) => actual === herramienta ? null : herramienta)
  }

  return (
    <main className="app-shell">
      {errorEditor ? (
        <div className="error-banner" role="alert">
          <strong>{t("modelado.error")}</strong> {errorEditor}
        </div>
      ) : null}

      <section className="modeling-workspace" aria-label={t("modelado.espacio")}>
        <nav className="tool-rail" aria-label={t("shell.herramientas")}>
          <button type="button" className={herramientaActiva === null ? "active" : ""} aria-pressed={herramientaActiva === null} onClick={() => establecerHerramientaActiva(null)}><span aria-hidden="true">◇</span>{t("shell.modelo")}</button>
          <button type="button" className={herramientaActiva === "ia" ? "active" : ""} aria-pressed={herramientaActiva === "ia"} onClick={() => alternarHerramienta("ia")}><span aria-hidden="true">✦</span>{t("shell.ia")}</button>
          <button type="button" className={herramientaActiva === "imagen" ? "active" : ""} aria-pressed={herramientaActiva === "imagen"} onClick={() => alternarHerramienta("imagen")}><span aria-hidden="true">▧</span>{t("shell.imagen")}</button>
          <button type="button" className={herramientaActiva === "validacion" ? "active" : ""} aria-pressed={herramientaActiva === "validacion"} onClick={() => alternarHerramienta("validacion")}><span aria-hidden="true">✓</span>{t("shell.validacion")}</button>
          <button type="button" className={herramientaActiva === "xmi" ? "active" : ""} aria-pressed={herramientaActiva === "xmi"} onClick={() => alternarHerramienta("xmi")}><span aria-hidden="true">⇄</span>{t("shell.xmi")}</button>
          <button type="button" className={herramientaActiva === "generacion" ? "active" : ""} aria-pressed={herramientaActiva === "generacion"} onClick={() => alternarHerramienta("generacion")}><span aria-hidden="true">⌘</span>{t("shell.generar")}</button>
        </nav>

        <div className="canvas-stage">
          <div className="editor-panel">
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

          <aside className={`tool-drawer ${herramientaActiva ? "is-open" : ""}`} aria-hidden={!herramientaActiva} aria-label={t("shell.panelHerramientas")}>
            <div className="tool-drawer-heading"><strong>{herramientaActiva ? t(`shell.${herramientaActiva}`) : t("shell.herramientas")}</strong><button type="button" aria-label={t("shell.cerrarPanel")} title={t("shell.cerrarPanel")} onClick={() => establecerHerramientaActiva(null)}>×</button></div>
            <div className="tool-drawer-content">
              <div hidden={herramientaActiva !== "ia"}>
                {resultadoCanonico ? <PanelAsistenteModelado modelo={resultadoCanonico.modelo} revision={revisionModelo} alAplicarModelo={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))} /> : null}
                {contextoAsistente ? <PanelAsistenteContextual contexto={contextoAsistente} /> : null}
              </div>
              <div hidden={herramientaActiva !== "imagen"}>
                {resultadoCanonico ? <PanelModeladoDesdeImagen modelo={resultadoCanonico.modelo} alAplicarModelo={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))} alCambiarEstadoCandidato={establecerCandidatoImagenPendiente} /> : null}
              </div>
              <div hidden={herramientaActiva !== "validacion"}>
                {resultadoValidacion ? <PanelResumenValidacion resultado={resultadoValidacion} /> : null}
              </div>
              <div hidden={herramientaActiva !== "xmi"}>
                {resultadoCanonico ? <PanelInteroperabilidadXmi modelo={resultadoCanonico.modelo} alImportar={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))} /> : null}
              </div>
              <div hidden={herramientaActiva !== "generacion"}>
                {resultadoCanonico && resultadoValidacion && aptitudGeneracion ? <PanelGeneracionSpring modelo={resultadoCanonico.modelo} validacion={resultadoValidacion} aptitud={aptitudGeneracion} /> : null}
              </div>
            </div>
          </aside>
        </div>

        <aside className="workspace-inspector" aria-label={t("propiedades.titulo")}>
          {resultadoCanonico ? <InspectorPropiedadesUML editor={editor} modelo={resultadoCanonico.modelo} alAplicar={aplicarDesdeInspector} alCambiarSeleccion={establecerSeleccionIds} /> : <p className="inspector-empty">{t("propiedades.seleccioneElemento")}</p>}
          <PanelColaboracion editor={editor} proyectoId={proyectoId} habilitada={modeloInicialAplicado} />
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

function PanelResumenValidacion({ resultado }: { resultado: NonNullable<ReturnType<typeof validarModelo>> }) {
  const { t } = usarPreferenciasUI()
  const errores = resultado.diagnosticos.filter((item) => item.severidad === "error")
  const advertencias = resultado.diagnosticos.filter((item) => item.severidad === "advertencia")
  return <section className="validation-tool-panel" data-testid="panel-validacion-producto">
    <p className="eyebrow">CU08</p><h2>{t("inspector.validacion")}</h2>
    <div className={`product-status-card ${resultado.valido ? "is-success" : "is-danger"}`}><strong>{resultado.valido ? t("shell.modeloValido") : t("shell.modeloConErrores")}</strong><span>{errores.length} {t("inspector.errores").toLocaleLowerCase()} · {advertencias.length} {t("inspector.advertencias").toLocaleLowerCase()}</span></div>
    {resultado.diagnosticos.length > 0 ? <ul className="product-diagnostics">{resultado.diagnosticos.map((diagnostico, indice) => <li className={`diagnostic-${diagnostico.severidad}`} key={`${diagnostico.codigo}-${diagnostico.elementoId ?? indice}`}>{diagnostico.mensaje}</li>)}</ul> : <p className="tool-empty-state">{t("shell.sinDiagnosticos")}</p>}
  </section>
}
