import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DURACION_MAXIMA_GRABACION_MS, GrabadorInstruccionVoz } from "./GrabadorInstruccionVoz"

class MediaRecorderFalso {
  static instancias: MediaRecorderFalso[] = []
  static isTypeSupported(tipo: string) { return tipo.startsWith("audio/webm") }
  readonly mimeType: string
  state: RecordingState = "inactive"
  private readonly listeners = new Map<string, Array<(evento: Event) => void>>()

  constructor(_flujo: MediaStream, opciones?: MediaRecorderOptions) {
    this.mimeType = opciones?.mimeType ?? "audio/webm"
    MediaRecorderFalso.instancias.push(this)
  }

  addEventListener(tipo: string, listener: EventListenerOrEventListenerObject) {
    const funcion = typeof listener === "function" ? listener : (evento: Event) => listener.handleEvent(evento)
    this.listeners.set(tipo, [...(this.listeners.get(tipo) ?? []), funcion])
  }

  start() { this.state = "recording" }

  stop() {
    if (this.state !== "recording") return
    this.state = "inactive"
    const evento = new Event("dataavailable") as BlobEvent
    Object.defineProperty(evento, "data", { value: new Blob(["audio"], { type: this.mimeType }) })
    this.listeners.get("dataavailable")?.forEach((listener) => listener(evento))
    this.listeners.get("stop")?.forEach((listener) => listener(new Event("stop")))
  }
}

const detenerPista = vi.fn()
const obtenerMicrofono = vi.fn(async () => ({ getTracks: () => [{ stop: detenerPista }] }) as unknown as MediaStream)

beforeEach(() => {
  MediaRecorderFalso.instancias = []
  detenerPista.mockClear()
  obtenerMicrofono.mockClear()
  vi.stubGlobal("MediaRecorder", MediaRecorderFalso)
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: obtenerMicrofono } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("GrabadorInstruccionVoz", () => {
  it("solicita permiso, muestra Escuchando y sube un único Blob al detener", async () => {
    const fetchMock = vi.fn(async (_entrada: RequestInfo | URL, _opciones?: RequestInit) => new Response(JSON.stringify({ transcripcion: "Crea una clase Factura" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const reconocer = vi.fn(async () => undefined)
    render(<GrabadorInstruccionVoz deshabilitado={false} alReconocer={reconocer} alCambiarOcupado={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    expect(await screen.findByText("Escuchando...")).toBeInTheDocument()
    expect(obtenerMicrofono).toHaveBeenCalledWith({ audio: true })
    fireEvent.click(screen.getByRole("button", { name: "⏹ Detener" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const opciones = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(opciones.body).toBeInstanceOf(FormData)
    expect(await screen.findByText(/Crea una clase Factura/)).toBeInTheDocument()
    expect(reconocer).toHaveBeenCalledWith("Crea una clase Factura")
    expect(detenerPista).toHaveBeenCalled()
  })

  it("detiene automáticamente al alcanzar 30 segundos", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ transcripcion: "" }), { status: 200 })))
    render(<GrabadorInstruccionVoz deshabilitado={false} alReconocer={vi.fn()} alCambiarOcupado={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    await act(async () => { await Promise.resolve() })
    const instancia = MediaRecorderFalso.instancias[0]
    expect(instancia?.state).toBe("recording")
    await act(async () => { vi.advanceTimersByTime(DURACION_MAXIMA_GRABACION_MS); await Promise.resolve() })
    expect(instancia?.state).toBe("inactive")
  })

  it("no invoca el modelado cuando la transcripción está vacía", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ transcripcion: "   " }), { status: 200 })))
    const reconocer = vi.fn()
    render(<GrabadorInstruccionVoz deshabilitado={false} alReconocer={reconocer} alCambiarOcupado={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    await screen.findByText("Escuchando...")
    fireEvent.click(screen.getByRole("button", { name: "⏹ Detener" }))
    expect(await screen.findByText("No se detectó una instrucción de voz.")).toBeInTheDocument()
    expect(reconocer).not.toHaveBeenCalled()
  })

  it("informa permiso denegado sin transcribir", async () => {
    obtenerMicrofono.mockRejectedValueOnce(new Error("denegado"))
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<GrabadorInstruccionVoz deshabilitado={false} alReconocer={vi.fn()} alCambiarOcupado={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    expect(await screen.findByText("No se pudo acceder al micrófono.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("deshabilita sólo la voz cuando MediaRecorder no está disponible", () => {
    vi.stubGlobal("MediaRecorder", undefined)
    render(<GrabadorInstruccionVoz deshabilitado={false} alReconocer={vi.fn()} alCambiarOcupado={vi.fn()} />)
    expect(screen.getByRole("button", { name: "🎙 Hablar" })).toBeDisabled()
    expect(screen.getByText(/Entrada de voz no disponible/)).toBeInTheDocument()
  })

  it("impide otra grabación mientras transcribe", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)))
    render(<GrabadorInstruccionVoz deshabilitado={false} alReconocer={vi.fn()} alCambiarOcupado={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    await screen.findByText("Escuchando...")
    fireEvent.click(screen.getByRole("button", { name: "⏹ Detener" }))
    expect(await screen.findByText("Transcribiendo...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "🎙 Hablar" })).toBeDisabled()
  })
})
