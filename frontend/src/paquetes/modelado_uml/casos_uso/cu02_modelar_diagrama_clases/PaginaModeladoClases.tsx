import { useCallback, useState } from "react"
import type { UMLModel } from "@tumaet/apollon"
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SW1 · Iteración 01 · Modelado UML · CU02</p>
          <h1>Modelado manual de diagramas de clases</h1>
        </div>
        <p className="iteration-goal">
          Edición manual en Apollon con acceso al modelo UML estructurado desde
          nuestra aplicación.
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

        <InspectorModeloDesarrollo modelo={modelo} error={errorEditor} />
      </section>
    </main>
  )
}

