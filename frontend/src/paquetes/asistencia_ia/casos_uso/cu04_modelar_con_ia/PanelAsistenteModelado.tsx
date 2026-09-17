import { useRef, useState } from "react"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { procesarInstruccionIA, type EstadoProcesoIA } from "./procesarInstruccionIA"
import { solicitarCambioIA } from "./solicitarCambioIA"

export interface PropiedadesPanelAsistenteModelado {
  modelo: ModeloUMLCanonico
  revision: number
  alAplicarModelo: (modelo: ModeloUMLCanonico) => void
}

export function PanelAsistenteModelado({ modelo, revision, alAplicarModelo }: PropiedadesPanelAsistenteModelado) {
  const [instruccion, establecerInstruccion] = useState("")
  const [estado, establecerEstado] = useState<EstadoProcesoIA | "listo" | "error" | null>(null)
  const [mensaje, establecerMensaje] = useState<string | null>(null)
  const [procesando, establecerProcesando] = useState(false)
  const estadoActual = useRef({ modelo, revision })
  estadoActual.current = { modelo, revision }

  const enviar = async () => {
    const texto = instruccion.trim()
    if (!texto) {
      establecerEstado("error")
      establecerMensaje("Escribe una instrucción de modelado.")
      return
    }
    establecerProcesando(true)
    establecerMensaje(null)
    try {
      const resultado = await procesarInstruccionIA({
        instruccion: texto,
        obtenerEstado: () => estadoActual.current,
        solicitar: solicitarCambioIA,
        aplicar: alAplicarModelo,
        alCambiarEstado: establecerEstado,
      })
      establecerEstado(resultado.resultado === "aplicado" ? "listo" : resultado.resultado === "error" ? "error" : "listo")
      establecerMensaje(resultado.mensaje)
      if (resultado.resultado === "aplicado") establecerInstruccion("")
    } catch (error) {
      establecerEstado("error")
      establecerMensaje(error instanceof Error ? error.message : "No se pudo procesar la instrucción con IA.")
    } finally {
      establecerProcesando(false)
    }
  }

  return (
    <aside className="ai-panel" data-testid="panel-asistente-ia">
      <h2>Asistente IA</h2>
      <label htmlFor="instruccion-ia">Instrucción UML</label>
      <textarea
        id="instruccion-ia"
        value={instruccion}
        maxLength={2000}
        disabled={procesando}
        placeholder="Ej.: Crea una clase Cliente"
        onChange={(evento) => establecerInstruccion(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" && !evento.shiftKey) {
            evento.preventDefault()
            void enviar()
          }
        }}
      />
      <button type="button" disabled={procesando} onClick={() => void enviar()}>Enviar</button>
      {estado ? <p role="status"><strong>{estado === "interpretando" ? "Interpretando..." : estado === "aplicando" ? "Aplicando..." : estado === "listo" ? "Listo" : "Error"}</strong>{mensaje ? `: ${mensaje}` : ""}</p> : null}
      <p className="ai-note">Los cambios claros y válidos se aplican automáticamente, sin confirmación.</p>
    </aside>
  )
}
