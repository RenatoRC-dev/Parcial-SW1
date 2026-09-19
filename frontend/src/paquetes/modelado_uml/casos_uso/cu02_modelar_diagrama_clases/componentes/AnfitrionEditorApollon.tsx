import { useCallback, useEffect, useRef } from "react"
import {
  Apollon,
  UMLDiagramType,
  type ApollonEditor,
  type ApollonLabels,
  type UMLModel,
} from "@tumaet/apollon"
import "@tumaet/apollon/style.css"
import { convertirAError, esUMLModel } from "../resumenModeloApollon"

export interface PropiedadesAnfitrionEditorApollon {
  alCambiarModelo: (modelo: UMLModel) => void
  alOcurrirError: (error: Error) => void
  modeloParaReemplazar?: UMLModel
  alCambiarEditor?: (editor: ApollonEditor | null) => void
  alAplicarModeloInicial?: () => void
  labels?: Partial<ApollonLabels>
  tema?: "light" | "dark"
}

export function AnfitrionEditorApollon({
  alCambiarModelo,
  alOcurrirError,
  modeloParaReemplazar,
  alCambiarEditor,
  alAplicarModeloInicial,
  labels,
  tema,
}: PropiedadesAnfitrionEditorApollon) {
  const editorActual = useRef<ApollonEditor | null>(null)
  const publicarModelo = useCallback(
    (candidato: unknown) => {
      if (!esUMLModel(candidato)) {
        alOcurrirError(
          new Error("Apollon devolvió un modelo UML ausente o inválido")
        )
        return
      }

      alCambiarModelo(candidato)
    },
    [alCambiarModelo, alOcurrirError]
  )

  const alMontarEditor = useCallback(
    (editor: ApollonEditor) => {
      try {
        editorActual.current = editor
        alCambiarEditor?.(editor)
        publicarModelo(editor.model)

        const idSuscripcion = editor.subscribeToModelChange((modeloActualizado) => {
          try {
            publicarModelo(modeloActualizado)
          } catch (error) {
            alOcurrirError(
              convertirAError(
                error,
                "No se pudo procesar una actualización del modelo de Apollon"
              )
            )
          }
        })

        return () => {
          alCambiarEditor?.(null)
          editorActual.current = null
          editor.unsubscribe(idSuscripcion)
        }
      } catch (error) {
        alOcurrirError(
          convertirAError(error, "No se pudo inicializar el editor Apollon")
        )
        return undefined
      }
    },
    [alCambiarEditor, alOcurrirError, publicarModelo]
  )

  useEffect(() => {
    if (!modeloParaReemplazar || !editorActual.current) return
    try {
      editorActual.current.updateDiagramTitle(modeloParaReemplazar.title)
      editorActual.current.model = modeloParaReemplazar
      publicarModelo(editorActual.current.model)
      alAplicarModeloInicial?.()
    } catch (error) {
      alOcurrirError(convertirAError(error, "No se pudo reemplazar el modelo de Apollon"))
    }
  }, [alAplicarModeloInicial, alOcurrirError, modeloParaReemplazar, publicarModelo])

  return (
    <Apollon
      className="apollon-host"
      defaultType={UMLDiagramType.ClassDiagram}
      enablePopups={false}
      labels={labels}
      dataTheme={tema}
      collaborationEnabled
      collaboration={{
        enabled: true,
        showPresence: true,
        showCursors: true,
        showSelectionHighlights: true,
      }}
      onMount={alMontarEditor}
    >
      <Apollon.Zoom history />
      <Apollon.MiniMap />
    </Apollon>
  )
}
