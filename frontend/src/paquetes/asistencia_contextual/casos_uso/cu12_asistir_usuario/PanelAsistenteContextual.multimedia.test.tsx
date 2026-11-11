import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"
import type { ContextoAsistente } from "./ContextoAsistente"
import type { MensajeColaborativo, RespuestaInteraccionColaborativa, VistaFlujoAsistente } from "./consultarAsistenteContextual"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

class GrabadorFalso extends EventTarget {
  static isTypeSupported = () => true
  state = "inactive"
  mimeType = "audio/webm"
  start() { this.state = "recording" }
  stop() {
    this.state = "inactive"
    const evento = new Event("dataavailable")
    Object.defineProperty(evento, "data", { value: new Blob(["audio"]) })
    this.dispatchEvent(evento); this.dispatchEvent(new Event("stop"))
  }
}
const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [] }
const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Modelo" }, area: "modelado_uml", idioma: "es", revisionModelo: 0,
  modeloActual: { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [], truncado: false }, elementoSeleccionado: null, elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 },
  estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] }, generacion: { estado: "apto", bloqueos: [], advertencias: [] },
  cambiosSinGuardar: true, candidatoImagenPendiente: false, accionesDisponibles: ["NINGUNA"],
}
const mensaje = (id: string, tipoRemitente: "human" | "ai", contenido: string): MensajeColaborativo => ({
  id, projectId: "p", tipoRemitente, participantId: tipoRemitente === "human" ? "u" : null, nombreVisibleSnapshot: tipoRemitente === "human" ? "Ana" : "Asistente",
  contenido, requestId: "request", replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: `2026-11-10T12:00:0${id}Z`,
})
const detenerPista = vi.fn()
const microfono = vi.fn()
const respuesta = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const archivo = new File(["png"], "modelo.png", { type: "image/png" })
function mostrar() {
  const consultar = vi.fn(async (..._args: Parameters<NonNullable<Parameters<typeof PanelAsistenteContextual>[0]["consultar"]>>): Promise<RespuestaInteraccionColaborativa> => ({ kind: "advisory" as const, mensajeHumano: mensaje("3", "human", "Pregunta"), mensajeIA: mensaje("4", "ai", "Respuesta") }))
  const aplicar = vi.fn(); const candidatoPendiente = vi.fn()
  const cargar = vi.fn(async () => ({ items: [mensaje("2", "ai", "Recomendación anterior"), mensaje("1", "human", "Hola")], siguienteCursor: null }))
  const conectar = ({ alAutenticar }: { alAutenticar: () => void }) => { alAutenticar(); return { desconectar: vi.fn() } }
  const flujo: VistaFlujoAsistente = { requestId: "request", sourceMessageId: "3", participantId: "u", operacion: "analizar_imagen", estado: "review", revision: 0, resumen: "Candidato local", advertencias: [], candidato: { clases: [{ refTemporal: "tmp_prestamo", nombre: "Prestamo", atributos: [] }], relaciones: [], advertencias: [] } }
  const modeloResultado = { ...modelo, clases: [{ id: "prestamo", nombre: "Prestamo", abstracta: false, atributos: [], posicion: { x: 0, y: 0 } }] }
  const confirmar = vi.fn(async () => ({ flujo: { ...flujo, estado: "issued" as const }, modeloResultado }))
  const completar = vi.fn(async () => ({ kind: "workflow" as const, mensajeHumano: mensaje("3", "human", "Pregunta"), mensajeIA: mensaje("5", "ai", "Aplicado tras confirmar"), flujo: { ...flujo, estado: "applied" as const } }))
  const vista = render(<PanelAsistenteContextual projectId="p" credential="cred" participantId="u" contexto={contexto} modelo={modelo} revisionEditor={0} alAplicarModelo={aplicar} alCambiarEstadoCandidato={candidatoPendiente} consultar={consultar} cargar={cargar} conectar={conectar} recuperar={async () => []} confirmar={confirmar} completar={completar} />)
  return { ...vista, consultar, aplicar, candidatoPendiente, flujo, confirmar, completar }
}
beforeEach(() => {
  localStorage.clear(); detenerPista.mockClear()
  microfono.mockReset().mockResolvedValue({ getTracks: () => [{ stop: detenerPista }] })
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: microfono } })
  vi.stubGlobal("MediaRecorder", GrabadorFalso); vi.stubGlobal("fetch", vi.fn())
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:imagen") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("F8-UX03 compositor multimedia", () => {
  it("mantiene cronología, autores, log independiente y un compositor multilínea", async () => {
    const { container, consultar } = mostrar()
    await screen.findByText("Recomendación anterior")
    expect(screen.getByRole("log", { name: "Conversación de modelado" })).toHaveAttribute("tabindex", "0")
    expect([...container.querySelectorAll("article")].map((n) => n.textContent)).toEqual(["Ana:Hola", "Asistente:Recomendación anterior"])
    const entrada = screen.getByRole("textbox")
    expect(entrada.tagName).toBe("TEXTAREA")
    expect(entrada.closest(".contextual-composer")).not.toBeNull()
    expect(screen.getByRole("log").contains(entrada)).toBe(false)
    fireEvent.change(entrada, { target: { value: "Una pregunta\ncon contexto" } })
    fireEvent.keyDown(entrada, { key: "Enter", shiftKey: true })
    expect(consultar).not.toHaveBeenCalled()
    fireEvent.keyDown(entrada, { key: "Enter" })
    expect(await screen.findByText("Respuesta")).toBeVisible()
    expect(consultar).toHaveBeenCalledOnce()
  })

  it("transcribe con el servicio real, conserva el borrador y espera Enviar", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta({ transcripcion: "Crea Prestamo" }))
    const { consultar, aplicar } = mostrar()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Contexto" } })
    fireEvent.click(screen.getByRole("button", { name: /Hablar/ }))
    await screen.findByText("Escuchando...")
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Detener/ }))
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("Contexto\nCrea Prestamo"))
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/api/ia/voz/transcribir")
    expect(consultar).not.toHaveBeenCalled(); expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByText(/Revisa la transcripción/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByText("Respuesta")).toBeVisible()
    expect(consultar).toHaveBeenCalledOnce()
  })

  it("cancela la grabación sin transcribir ni ejecutar", async () => {
    const { consultar } = mostrar()
    fireEvent.click(screen.getByRole("button", { name: /Hablar/ }))
    await screen.findByText("Escuchando...")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar grabación" }))
    expect(fetch).not.toHaveBeenCalled(); expect(consultar).not.toHaveBeenCalled()
    expect(detenerPista).toHaveBeenCalled()
    expect(screen.queryByText("Escuchando...")).not.toBeInTheDocument()
  })

  it("permiso denegado no bloquea el texto", async () => {
    microfono.mockRejectedValueOnce(new Error("denegado"))
    mostrar()
    fireEvent.click(screen.getByRole("button", { name: /Hablar/ }))
    await screen.findByText("No se pudo acceder al micrófono.")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pregunta" } })
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("conserva texto cuando falla la transcripción", async () => {
    vi.mocked(fetch).mockResolvedValue(respuesta({ error: "Voz no disponible" }, 503))
    const { consultar } = mostrar()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Borrador" } })
    fireEvent.click(screen.getByRole("button", { name: /Hablar/ })); await screen.findByText("Escuchando...")
    fireEvent.click(screen.getByRole("button", { name: /Detener/ }))
    expect(await screen.findByText("Voz no disponible")).toBeVisible()
    expect(screen.getByRole("textbox")).toHaveValue("Borrador")
    expect(consultar).not.toHaveBeenCalled()
  })

  it("adjunta y quita vista previa sin solicitudes; libera la URL", async () => {
    mostrar()
    fireEvent.change(screen.getByLabelText("Adjuntar imagen"), { target: { files: [archivo] } })
    expect(await screen.findByAltText("Vista previa de la imagen seleccionada")).toHaveAttribute("src", "blob:imagen")
    fireEvent.click(screen.getByRole("button", { name: "Quitar imagen" }))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:imagen")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([new File(["svg"], "x.svg", { type: "image/svg+xml" }), new File([new Uint8Array(10 * 1024 * 1024 + 1)], "x.png", { type: "image/png" }), new File([], "x.png", { type: "image/png" })])("rechaza adjunto inválido $name antes de llamar al servicio", async (file) => {
    mostrar()
    fireEvent.change(screen.getByLabelText("Adjuntar imagen"), { target: { files: [file] } })
    expect(await screen.findByRole("alert")).toHaveTextContent("hasta 10 MB")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("envía imagen y texto atómicamente, conserva historial y exige confirmar el candidato", async () => {
    const { consultar, aplicar, candidatoPendiente, flujo, confirmar } = mostrar()
    consultar.mockImplementationOnce(async (...args) => ({ kind: "workflow", mensajeHumano: { ...mensaje("3", "human", "Agrega esta imagen"), requestId: args[2] }, mensajeIA: mensaje("4", "ai", "Pendiente de revisión"), flujo: { ...flujo, requestId: args[2] } }))
    await screen.findByText("Recomendación anterior")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Agrega esta imagen" } })
    fireEvent.change(screen.getByLabelText("Adjuntar imagen"), { target: { files: [archivo] } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByText("Candidato local")).toBeVisible()
    expect(consultar.mock.calls[0][3]).toBe("Agrega esta imagen")
    expect(consultar.mock.calls[0][7]).toBe(archivo)
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("textbox")).toHaveValue("")
    expect(screen.getByText("Recomendación anterior")).toBeVisible()
    expect(candidatoPendiente).toHaveBeenCalledWith(true)
    confirmar.mockImplementationOnce(async (...args: unknown[]) => ({ flujo: { ...flujo, requestId: args[2] as string, estado: "issued" }, modeloResultado: { ...modelo, clases: [{ id: "prestamo", nombre: "Prestamo", abstracta: false, atributos: [], posicion: { x: 0, y: 0 } }] } }))
    fireEvent.click(screen.getByRole("button", { name: "Agregar al diagrama" }))
    await waitFor(() => expect(aplicar).toHaveBeenCalledOnce())
    expect(aplicar.mock.calls[0][0].clases[0].nombre).toBe("Prestamo")
  })

  it("fallo de imagen mantiene adjunto y permite reintento explícito sin CU12", async () => {
    const { aplicar, consultar } = mostrar()
    consultar.mockRejectedValueOnce(new Error("Imagen no disponible"))
    fireEvent.change(screen.getByLabelText("Adjuntar imagen"), { target: { files: [archivo] } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByText("Imagen no disponible")).toBeVisible()
    expect(screen.getAllByText("modelo.png").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled()
    expect(fetch).not.toHaveBeenCalled(); expect(aplicar).not.toHaveBeenCalled(); expect(consultar).toHaveBeenCalledOnce()
  })
})
