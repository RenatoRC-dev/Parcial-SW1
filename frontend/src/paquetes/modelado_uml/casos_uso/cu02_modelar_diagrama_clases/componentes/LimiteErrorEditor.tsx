import { Component, type ErrorInfo, type ReactNode } from "react"

interface PropiedadesLimiteErrorEditor {
  children: ReactNode
  alDetectarError: (error: Error) => void
}

interface EstadoLimiteErrorEditor {
  error: Error | null
}

export class LimiteErrorEditor extends Component<
  PropiedadesLimiteErrorEditor,
  EstadoLimiteErrorEditor
> {
  state: EstadoLimiteErrorEditor = { error: null }

  static getDerivedStateFromError(error: Error): EstadoLimiteErrorEditor {
    return { error }
  }

  componentDidCatch(error: Error, _informacionError: ErrorInfo) {
    this.props.alDetectarError(error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="editor-failure" role="alert">
          <h2>No se pudo inicializar el editor UML</h2>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar editor
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

