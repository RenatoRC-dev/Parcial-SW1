import { useCallback } from "react"
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
}

export function AnfitrionEditorApollon({
  alCambiarModelo,
  alOcurrirError,
}: PropiedadesAnfitrionEditorApollon) {
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

        return () => editor.unsubscribe(idSuscripcion)
      } catch (error) {
        alOcurrirError(
          convertirAError(error, "No se pudo inicializar el editor Apollon")
        )
        return undefined
      }
    },
    [alOcurrirError, publicarModelo]
  )

  return (
    <Apollon
      className="apollon-host"
      defaultType={UMLDiagramType.ClassDiagram}
      onMount={alMontarEditor}
    />
  )
}

