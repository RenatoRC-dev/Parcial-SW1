import { useEffect, useRef, useState } from "react"
import { transcribirAudio } from "./transcribirAudio"
import { usarPreferenciasUI } from "../../../../../configuracion/PreferenciasUI"

export const DURACION_MAXIMA_GRABACION_MS = 30_000

export interface PropiedadesGrabadorInstruccionVoz {
  deshabilitado: boolean
  alReconocer: (transcripcion: string) => Promise<void>
  alCambiarOcupado: (ocupado: boolean) => void
  mostrarTranscripcion?: boolean
}

export function seleccionarMimeGrabacion(): string | null {
  if (typeof MediaRecorder === "undefined") return null
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
  return candidatos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? null
}

export function GrabadorInstruccionVoz({
  deshabilitado,
  alReconocer,
  alCambiarOcupado,
  mostrarTranscripcion = true,
}: PropiedadesGrabadorInstruccionVoz) {
  const { t } = usarPreferenciasUI()
  const [estado, establecerEstado] = useState<"inactivo" | "solicitando" | "grabando" | "transcribiendo" | "procesando" | "error">("inactivo")
  const [mensaje, establecerMensaje] = useState<string | null>(null)
  const [transcripcion, establecerTranscripcion] = useState<string | null>(null)
  const grabador = useRef<MediaRecorder | null>(null)
  const flujo = useRef<MediaStream | null>(null)
  const fragmentos = useRef<Blob[]>([])
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelada = useRef(false)
  const mimeType = seleccionarMimeGrabacion()
  const disponible = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && mimeType !== null

  const liberar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    flujo.current?.getTracks().forEach((pista) => pista.stop())
    flujo.current = null
    grabador.current = null
  }

  useEffect(() => () => { cancelada.current = true; if (grabador.current?.state === "recording") grabador.current.stop(); liberar() }, [])

  const procesarGrabacion = async (tipo: string) => {
    const audio = new Blob(fragmentos.current, { type: tipo })
    fragmentos.current = []
    liberar()
    if (cancelada.current) { alCambiarOcupado(false); return }
    establecerEstado("transcribiendo")
    establecerMensaje(t("voz.transcribiendo"))
    try {
      const resultado = await transcribirAudio(audio)
      if (cancelada.current) return
      if (!resultado.transcripcion) {
        establecerEstado("inactivo")
        establecerMensaje(t("voz.sinInstruccion"))
        return
      }
      establecerTranscripcion(resultado.transcripcion)
      establecerEstado("procesando")
      establecerMensaje(null)
      await alReconocer(resultado.transcripcion)
      establecerEstado("inactivo")
    } catch (error) {
      establecerEstado("error")
      establecerMensaje(error instanceof Error ? error.message : t("voz.errorTranscripcion"))
    } finally {
      alCambiarOcupado(false)
    }
  }

  const iniciar = async () => {
    if (!disponible || deshabilitado || (estado !== "inactivo" && estado !== "error")) return
    establecerEstado("solicitando")
    cancelada.current = false
    establecerTranscripcion(null)
    establecerMensaje(t("voz.solicitando"))
    alCambiarOcupado(true)
    try {
      const nuevoFlujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (cancelada.current) { nuevoFlujo.getTracks().forEach((pista) => pista.stop()); return }
      const nuevoGrabador = new MediaRecorder(nuevoFlujo, { mimeType })
      flujo.current = nuevoFlujo
      grabador.current = nuevoGrabador
      fragmentos.current = []
      nuevoGrabador.addEventListener("dataavailable", (evento) => {
        if (evento.data.size > 0) fragmentos.current.push(evento.data)
      })
      nuevoGrabador.addEventListener("stop", () => { void procesarGrabacion(nuevoGrabador.mimeType || mimeType) }, { once: true })
      nuevoGrabador.start()
      establecerEstado("grabando")
      establecerMensaje(t("voz.escuchando"))
      temporizador.current = setTimeout(() => {
        if (nuevoGrabador.state === "recording") nuevoGrabador.stop()
      }, DURACION_MAXIMA_GRABACION_MS)
    } catch {
      liberar()
      establecerEstado("error")
      establecerMensaje(t("voz.errorMicrofono"))
      alCambiarOcupado(false)
    }
  }

  const detener = () => {
    if (grabador.current?.state === "recording") grabador.current.stop()
  }

  const cancelar = () => {
    cancelada.current = true
    if (grabador.current?.state === "recording") grabador.current.stop()
    liberar(); fragmentos.current = []
    establecerEstado("inactivo"); establecerMensaje(null); establecerTranscripcion(null)
    alCambiarOcupado(false)
  }

  return (
    <div className="voice-input" data-testid="entrada-voz">
      <button
        type="button"
        disabled={deshabilitado || !disponible || estado === "solicitando" || estado === "transcribiendo" || estado === "procesando"}
        onClick={estado === "grabando" ? detener : () => void iniciar()}
      >
        {estado === "grabando" ? t("voz.detener") : t("voz.hablar")}
      </button>
      {estado === "grabando" ? <button type="button" onClick={cancelar}>{t("voz.cancelar")}</button> : null}
      {!disponible ? <p className="voice-message">{t("voz.noDisponible")}</p> : null}
      {mensaje ? <p className={estado === "error" ? "voice-message voice-error" : "voice-message"} aria-live="polite">{mensaje}</p> : null}
      {mostrarTranscripcion && transcripcion ? <p className="voice-transcript"><strong>{t("voz.reconocida")}</strong> “{transcripcion}”</p> : null}
    </div>
  )
}
