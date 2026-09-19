import { Component, type ErrorInfo, type ReactNode } from "react"

interface PropiedadesLimiteErrorEditor {
  children: ReactNode
  alDetectarError: (error: Error) => void
  titulo: string
  etiquetaRecargar: string
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
          <h2>{this.props.titulo}</h2>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {this.props.etiquetaRecargar}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
