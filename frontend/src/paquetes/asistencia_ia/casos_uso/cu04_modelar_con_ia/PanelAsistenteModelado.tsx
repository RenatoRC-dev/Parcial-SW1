import { useRef, useState } from "react"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { procesarInstruccionIA, type EstadoProcesoIA } from "./procesarInstruccionIA"
import { solicitarCambioIA } from "./solicitarCambioIA"
import { GrabadorInstruccionVoz } from "./voz/GrabadorInstruccionVoz"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export interface PropiedadesPanelAsistenteModelado {
  modelo: ModeloUMLCanonico
  revision: number
  alAplicarModelo: (modelo: ModeloUMLCanonico) => void
}

export function PanelAsistenteModelado({ modelo, revision, alAplicarModelo }: PropiedadesPanelAsistenteModelado) {
  const { t } = usarPreferenciasUI()
  const [instruccion, establecerInstruccion] = useState("")
  const [estado, establecerEstado] = useState<EstadoProcesoIA | "listo" | "error" | null>(null)
  const [mensaje, establecerMensaje] = useState<string | null>(null)
  const [procesando, establecerProcesando] = useState(false)
  const [vozOcupada, establecerVozOcupada] = useState(false)
  const estadoActual = useRef({ modelo, revision })
  estadoActual.current = { modelo, revision }

  const enviar = async (textoRecibido?: string, conservarTexto = false) => {
    const texto = (textoRecibido ?? instruccion).trim()
    if (!texto) {
      establecerEstado("error")
      establecerMensaje(t("ia.instruccionRequerida"))
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
      if (resultado.resultado === "aplicado" && !conservarTexto) establecerInstruccion("")
    } catch (error) {
      establecerEstado("error")
      establecerMensaje(error instanceof Error ? error.message : t("ia.errorProcesamiento"))
    } finally {
      establecerProcesando(false)
    }
  }

  const procesarTranscripcion = async (transcripcion: string) => {
    establecerInstruccion(transcripcion)
    await enviar(transcripcion, true)
  }

  const ocupado = procesando || vozOcupada

  return (
    <aside className="ai-panel" data-testid="panel-asistente-ia">
      <h2>{t("ia.titulo")}</h2>
      <label htmlFor="instruccion-ia">{t("ia.instruccion")}</label>
      <textarea
        id="instruccion-ia"
        value={instruccion}
        maxLength={2000}
        disabled={ocupado}
        placeholder={t("ia.placeholder")}
        onChange={(evento) => establecerInstruccion(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" && !evento.shiftKey) {
            evento.preventDefault()
            void enviar()
          }
        }}
      />
      <button type="button" disabled={ocupado} onClick={() => void enviar()}>{t("ia.enviar")}</button>
      <GrabadorInstruccionVoz
        deshabilitado={procesando}
        alCambiarOcupado={establecerVozOcupada}
        alReconocer={procesarTranscripcion}
      />
      {estado ? <p role="status"><strong>{estado === "interpretando" ? t("ia.interpretando") : estado === "aplicando" ? t("ia.aplicando") : estado === "listo" ? t("ia.listo") : t("ia.error")}</strong>{mensaje ? `: ${mensaje}` : ""}</p> : null}
      <p className="ai-note">{t("ia.nota")}</p>
    </aside>
  )
}
