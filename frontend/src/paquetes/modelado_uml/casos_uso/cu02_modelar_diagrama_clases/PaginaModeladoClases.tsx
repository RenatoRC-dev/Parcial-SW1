import { useCallback, useMemo, useState } from "react"
import type { UMLModel } from "@tumaet/apollon"
import { convertirAModeloCanonicoConAdvertencias } from "../../compartido/integracion_apollon/AdaptadorApollon"
import { AnfitrionEditorApollon } from "./componentes/AnfitrionEditorApollon"
import { InspectorModeloDesarrollo } from "./componentes/InspectorModeloDesarrollo"
import { LimiteErrorEditor } from "./componentes/LimiteErrorEditor"

export function PaginaModeladoClases() {
  const [modelo, establecerModelo] = useState<UMLModel | null>(null)
  const [errorEditor, establecerErrorEditor] = useState<string | null>(null)

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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SW1 · Iteración 02 · Modelado UML · CU02</p>
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
            />
          </LimiteErrorEditor>
        </div>

        <InspectorModeloDesarrollo
          modeloApollon={modelo}
          resultadoCanonico={resultadoCanonico}
          error={errorEditor}
        />
      </section>
    </main>
  )
}
