import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ApollonEditor, UMLModel } from "@tumaet/apollon"
import {
  convertirAModeloCanonicoConAdvertencias,
  convertirDesdeModeloCanonico,
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

export function PaginaModeladoClases({ proyectoId, modeloInicial, alCambiarModeloCanonico }: {
  proyectoId: string
  modeloInicial: ModeloUMLCanonico
  alCambiarModeloCanonico: (modelo: ModeloUMLCanonico) => void
}) {
  const { idioma, temaAplicado, t } = usarPreferenciasUI()
  const [modelo, establecerModelo] = useState<UMLModel | null>(null)
  const [errorEditor, establecerErrorEditor] = useState<string | null>(null)
  const [modeloImportado, establecerModeloImportado] = useState<UMLModel | undefined>(() => convertirDesdeModeloCanonico(modeloInicial))
  const [editor, establecerEditor] = useState<ApollonEditor | null>(null)
  const [revisionModelo, establecerRevisionModelo] = useState(0)
  const [modeloInicialAplicado, establecerModeloInicialAplicado] = useState(false)
  const revisionActual = useRef(0)

  const recibirCambioModelo = useCallback((modeloActualizado: UMLModel) => {
    establecerModelo(modeloActualizado)
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

  useEffect(() => {
    if (resultadoCanonico) alCambiarModeloCanonico({
      ...resultadoCanonico.modelo,
      id: modeloInicial.id,
      nombre: modeloInicial.nombre,
      version: modeloInicial.version,
    })
  }, [resultadoCanonico, alCambiarModeloCanonico, modeloInicial.id, modeloInicial.nombre, modeloInicial.version])

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SW1 · CU02 / CU03 / CU04 / CU05 / CU08</p>
          <h1>{t("modelado.titulo")}</h1>
        </div>
        <p className="iteration-goal">
          {t("modelado.descripcion")}
        </p>
      </header>

      {errorEditor ? (
        <div className="error-banner" role="alert">
          <strong>{t("modelado.error")}</strong> {errorEditor}
        </div>
      ) : null}

      <section className="workspace" aria-label={t("modelado.espacio")}>
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

        <div className="workspace-sidebar">
          {resultadoCanonico ? <InspectorPropiedadesUML editor={editor} modelo={resultadoCanonico.modelo} alAplicar={aplicarDesdeInspector} /> : null}
          <PanelColaboracion editor={editor} proyectoId={proyectoId} habilitada={modeloInicialAplicado} />
          {resultadoCanonico ? (
            <>
              <PanelAsistenteModelado
                modelo={resultadoCanonico.modelo}
                revision={revisionModelo}
                alAplicarModelo={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))}
              />
              <PanelModeladoDesdeImagen
                modelo={resultadoCanonico.modelo}
                alAplicarModelo={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))}
              />
            </>
          ) : null}
          <InspectorModeloDesarrollo
            modeloApollon={modelo}
            resultadoCanonico={resultadoCanonico}
            resultadoValidacion={resultadoValidacion}
            error={errorEditor}
          />
          {resultadoCanonico && resultadoValidacion && aptitudGeneracion ? (
            <>
              <PanelInteroperabilidadXmi
                modelo={resultadoCanonico.modelo}
                alImportar={(modeloCanonico) => establecerModeloImportado(convertirDesdeModeloCanonico(modeloCanonico))}
              />
              <PanelGeneracionSpring
                modelo={resultadoCanonico.modelo}
                validacion={resultadoValidacion}
                aptitud={aptitudGeneracion}
              />
            </>
          ) : null}
        </div>
      </section>
    </main>
  )
}
