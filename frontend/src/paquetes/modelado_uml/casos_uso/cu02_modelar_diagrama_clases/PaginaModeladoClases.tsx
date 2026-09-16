import { useCallback, useMemo, useState } from "react"
import type { UMLModel } from "@tumaet/apollon"
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

export function PaginaModeladoClases() {
  const [modelo, establecerModelo] = useState<UMLModel | null>(null)
  const [errorEditor, establecerErrorEditor] = useState<string | null>(null)
  const [modeloImportado, establecerModeloImportado] = useState<UMLModel | undefined>()

  const recibirCambioModelo = useCallback((modeloActualizado: UMLModel) => {
    establecerModelo(modeloActualizado)
    establecerErrorEditor(null)
  }, [])

  const registrarErrorEditor = useCallback((error: Error) => {
    establecerErrorEditor(error.message)
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SW1 · Modelado UML · CU02 / CU08</p>
          <h1>Modelado manual de diagramas de clases</h1>
        </div>
        <p className="iteration-goal">
          Edición manual en Apollon y proyección a nuestro modelo UML canónico.
        </p>
      </header>

      {errorEditor ? (
        <div className="error-banner" role="alert">
          <strong>Error de integración del editor:</strong> {errorEditor}
        </div>
      ) : null}

      <section className="workspace" aria-label="Espacio de modelado UML">
        <div className="editor-panel">
          <LimiteErrorEditor alDetectarError={registrarErrorEditor}>
            <AnfitrionEditorApollon
              alCambiarModelo={recibirCambioModelo}
              alOcurrirError={registrarErrorEditor}
              modeloParaReemplazar={modeloImportado}
            />
          </LimiteErrorEditor>
        </div>

        <div className="workspace-sidebar">
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
