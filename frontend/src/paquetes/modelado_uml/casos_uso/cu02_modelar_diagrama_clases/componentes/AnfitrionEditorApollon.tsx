import { useCallback, useEffect, useRef } from "react"
import {
  Apollon,
  UMLDiagramType,
  type ApollonEditor,
  type UMLModel,
} from "@tumaet/apollon"
import "@tumaet/apollon/style.css"
import { convertirAError, esUMLModel } from "../resumenModeloApollon"

export interface PropiedadesAnfitrionEditorApollon {
  alCambiarModelo: (modelo: UMLModel) => void
  alOcurrirError: (error: Error) => void
  modeloParaReemplazar?: UMLModel
}

export function AnfitrionEditorApollon({
  alCambiarModelo,
  alOcurrirError,
  modeloParaReemplazar,
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
    [alOcurrirError, publicarModelo]
  )

  useEffect(() => {
    if (!modeloParaReemplazar || !editorActual.current) return
    try {
      editorActual.current.updateDiagramTitle(modeloParaReemplazar.title)
      editorActual.current.model = modeloParaReemplazar
    } catch (error) {
      alOcurrirError(convertirAError(error, "No se pudo reemplazar el modelo de Apollon"))
    }
  }, [alOcurrirError, modeloParaReemplazar])

  return (
    <Apollon
      className="apollon-host"
      defaultType={UMLDiagramType.ClassDiagram}
      onMount={alMontarEditor}
    />
  )
}
