import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { ProveedorPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import { PanelAsistenteModelado } from "./PanelAsistenteModelado"

const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "4.2.0", clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }], relaciones: [] }

class MediaRecorderPanelFalso {
  static isTypeSupported(tipo: string) { return tipo.startsWith("audio/webm") }
  readonly mimeType = "audio/webm"
  state: RecordingState = "inactive"
  private readonly listeners = new Map<string, Array<(evento: Event) => void>>()
  addEventListener(tipo: string, listener: EventListenerOrEventListenerObject) {
    const funcion = typeof listener === "function" ? listener : (evento: Event) => listener.handleEvent(evento)
    this.listeners.set(tipo, [...(this.listeners.get(tipo) ?? []), funcion])
  }
  start() { this.state = "recording" }
  stop() {
    this.state = "inactive"
    const evento = new Event("dataavailable") as BlobEvent
    Object.defineProperty(evento, "data", { value: new Blob(["audio"], { type: this.mimeType }) })
    this.listeners.get("dataavailable")?.forEach((listener) => listener(evento))
    this.listeners.get("stop")?.forEach((listener) => listener(new Event("stop")))
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("MediaRecorder", MediaRecorderPanelFalso)
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream) } })
})

afterEach(() => vi.unstubAllGlobals())

describe("PanelAsistenteModelado", () => {
  it("rechaza instrucción vacía y no contiene confirmación", async () => {
    render(<PanelAsistenteModelado modelo={modelo} revision={1} alAplicarModelo={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("alert").catch(() => null)).toBeNull()
    expect(screen.getByRole("status")).toHaveTextContent("Escribe una instrucción")
    expect(screen.queryByRole("button", { name: /confirmar|aplicar|aceptar/i })).toBeNull()
  })

  it("muestra Interpretando y aplica automáticamente al responder", async () => {
    let resolver!: (valor: Response) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve })))
    const aplicar = vi.fn()
    render(<PanelAsistenteModelado modelo={modelo} revision={3} alAplicarModelo={aplicar} />)
    fireEvent.change(screen.getByLabelText("Instrucción UML"), { target: { value: "Agrega correo" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(screen.getByRole("status")).toHaveTextContent("Interpretando")
    resolver(new Response(JSON.stringify({ resultado: "aplicar", mensaje: "Correo agregado.", comandos: [{ tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_correo", nombre: "correo", tipoDato: "String", visibilidad: "privada" }], revision: 3 }), { status: 200, headers: { "Content-Type": "application/json" } }))
    await waitFor(() => expect(aplicar).toHaveBeenCalledOnce())
    expect(screen.getByRole("status")).toHaveTextContent("Listo: Correo agregado")
  })

  it("preserva la instrucción, evita duplicados y recupera controles tras un timeout", async () => {
    let resolver!: (valor: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve }))
    vi.stubGlobal("fetch", fetchMock)
    const aplicar = vi.fn()
    render(<PanelAsistenteModelado modelo={modelo} revision={3} alAplicarModelo={aplicar} />)
    const entrada = screen.getByLabelText(/Instrucci.n UML/)
    const enviar = screen.getByRole("button", { name: "Enviar" })
    fireEvent.change(entrada, { target: { value: "Agrega telefono" } })
    fireEvent.click(enviar)
    fireEvent.click(enviar)

    expect(enviar).toBeDisabled()
    expect(entrada).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledOnce()
    resolver(new Response(JSON.stringify({
      tipo: "timeout",
      error: "La IA tardó demasiado en responder. Intenta nuevamente. El modelo no fue modificado.",
    }), { status: 504, headers: { "Content-Type": "application/json" } }))

    expect(await screen.findByText(/La IA tardó demasiado en responder/)).toHaveTextContent("El modelo no fue modificado")
    expect(entrada).toHaveValue("Agrega telefono")
    expect(enviar).toBeEnabled()
    expect(entrada).toBeEnabled()
    expect(aplicar).not.toHaveBeenCalled()
  })

  it("presenta los estados estáticos de IA en inglés sin traducir el mensaje dinámico", async () => {
    localStorage.setItem("sw1.idioma", "en")
    let resolver!: (valor: Response) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve })))
    const aplicar = vi.fn()
    const modeloAntes = JSON.stringify(modelo)
    render(<ProveedorPreferenciasUI><PanelAsistenteModelado modelo={modelo} revision={3} alAplicarModelo={aplicar} /></ProveedorPreferenciasUI>)
    fireEvent.change(screen.getByLabelText("UML instruction"), { target: { value: "Add email" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(screen.getByRole("status")).toHaveTextContent("Interpreting...")
    resolver(new Response(JSON.stringify({ resultado: "aplicar", mensaje: "Correo agregado.", comandos: [{ tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_correo", nombre: "correo", tipoDato: "String", visibilidad: "privada" }], revision: 3 }), { status: 200, headers: { "Content-Type": "application/json" } }))
    await waitFor(() => expect(aplicar).toHaveBeenCalledOnce())
    expect(screen.getByRole("status")).toHaveTextContent("Ready: Correo agregado.")
    expect(JSON.stringify(modelo)).toBe(modeloAntes)
  })

  it("muestra la voz reconocida y la envía automáticamente por el flujo CU04 existente", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ transcripcion: "Agrega a cliente un atributo id de tipo long" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ resultado: "aplicar", mensaje: "Identificador agregado.", comandos: [{ tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_id", nombre: "id", tipoDato: "Long", visibilidad: "privada" }], revision: 3 }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const aplicar = vi.fn()
    render(<PanelAsistenteModelado modelo={modelo} revision={3} alAplicarModelo={aplicar} />)
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    await screen.findByText("Escuchando...")
    fireEvent.click(screen.getByRole("button", { name: "⏹ Detener" }))
    await waitFor(() => expect(aplicar).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText("Instrucción UML")).toHaveValue("Agrega a cliente un atributo id de tipo long")
    expect(screen.getByText(/Voz reconocida:/).parentElement).toHaveTextContent("Agrega a cliente un atributo id de tipo long")
    expect(aplicar.mock.calls[0][0].clases[0].atributos).toContainEqual(expect.objectContaining({ nombre: "id", tipo: "Long", visibilidad: "privada" }))
    expect(screen.queryByRole("button", { name: /confirmar|aplicar|aceptar/i })).toBeNull()
  })

  it("conserva el texto escrito cuando falla la transcripción", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Servicio no disponible" }), { status: 503 })))
    render(<PanelAsistenteModelado modelo={modelo} revision={1} alAplicarModelo={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Instrucción UML"), { target: { value: "Texto pendiente" } })
    fireEvent.click(screen.getByRole("button", { name: "🎙 Hablar" }))
    await screen.findByText("Escuchando...")
    fireEvent.click(screen.getByRole("button", { name: "⏹ Detener" }))
    expect(await screen.findByText("Servicio no disponible")).toBeInTheDocument()
    expect(screen.getByLabelText("Instrucción UML")).toHaveValue("Texto pendiente")
  })

  it("mantiene disponible el asistente de texto cuando MediaRecorder no existe", () => {
    vi.stubGlobal("MediaRecorder", undefined)
    render(<PanelAsistenteModelado modelo={modelo} revision={1} alAplicarModelo={vi.fn()} />)
    expect(screen.getByRole("button", { name: "🎙 Hablar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled()
    expect(screen.getByLabelText("Instrucción UML")).toBeEnabled()
  })
})
