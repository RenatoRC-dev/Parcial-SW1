import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { ProveedorPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import { PanelModeladoDesdeImagen } from "./PanelModeladoDesdeImagen"

const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "4.2.0", clases: [], relaciones: [] }
const respuesta = {
  resultado: "candidato",
  mensaje: "Candidato detectado.",
  modelo: "fake",
  candidato: {
    clases: [{ refTemporal: "tmp_factura", nombre: "Factura", atributos: [
      { refTemporal: "tmp_total", nombre: "total", tipoDato: "Double" },
      { refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: null },
      { refTemporal: "tmp_monto", nombre: "monto", tipoDato: "Money" },
    ] }],
    relaciones: [],
    advertencias: ["Texto parcialmente ilegible."],
  },
}
const archivo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "diagrama.png", { type: "image/png" })

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(respuesta), { status: 200 })))
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
})

afterEach(() => vi.unstubAllGlobals())

async function seleccionarYAnalizar() {
  fireEvent.change(screen.getByLabelText("Seleccionar imagen"), { target: { files: [archivo] } })
  fireEvent.click(screen.getByRole("button", { name: "Analizar imagen" }))
  await screen.findByRole("region", { name: "Modelo UML candidato" })
}

describe("PanelModeladoDesdeImagen", () => {
  it("selecciona sin analizar automáticamente y limpia el Object URL", () => {
    const vista = render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Seleccionar imagen"), { target: { files: [archivo] } })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByAltText("Vista previa de la imagen seleccionada")).toHaveAttribute("src", "blob:preview")
    vista.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview")
  })

  it("muestra estado de análisis, clases, atributos y advertencias sin mutar", async () => {
    let resolver!: (respuesta: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve }))
    const aplicar = vi.fn()
    render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={aplicar} />)
    fireEvent.change(screen.getByLabelText("Seleccionar imagen"), { target: { files: [archivo] } })
    fireEvent.click(screen.getByRole("button", { name: "Analizar imagen" }))
    expect(screen.getByRole("button", { name: "Analizando imagen..." })).toBeDisabled()
    expect(aplicar).not.toHaveBeenCalled()
    resolver(new Response(JSON.stringify(respuesta), { status: 200 }))
    expect(await screen.findByText("Factura")).toBeInTheDocument()
    expect(screen.getByText("total: Double")).toBeInTheDocument()
    expect(screen.getByText(/nombre — tipo no visible · no se importará/)).toBeInTheDocument()
    expect(screen.getByText(/monto: Money · tipo no soportado · no se importará/)).toBeInTheDocument()
    expect(screen.getByText("Texto parcialmente ilegible.")).toBeInTheDocument()
    expect(aplicar).not.toHaveBeenCalled()
  })

  it("cancela sin aplicar", async () => {
    const aplicar = vi.fn()
    render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={aplicar} />)
    await seleccionarYAnalizar()
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.queryByRole("region", { name: "Modelo UML candidato" })).not.toBeInTheDocument()
  })

  it("confirma y aplica exactamente una vez", async () => {
    const aplicar = vi.fn()
    render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={aplicar} />)
    await seleccionarYAnalizar()
    fireEvent.click(screen.getByRole("button", { name: "Agregar al diagrama" }))
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0]?.[0].clases[0]).toMatchObject({ nombre: "Factura", atributos: [{ nombre: "total", tipo: "Double" }] })
    expect(aplicar.mock.calls[0]?.[0].clases[0].atributos).toHaveLength(1)
  })

  it("bloquea colisión contra el modelo más reciente y conserva candidato", async () => {
    const aplicar = vi.fn()
    const { rerender } = render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={aplicar} />)
    await seleccionarYAnalizar()
    const existente = { ...modelo, clases: [{ id: "factura", nombre: "factura", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }] }
    rerender(<PanelModeladoDesdeImagen modelo={existente} alAplicarModelo={aplicar} />)
    fireEvent.click(screen.getByRole("button", { name: "Agregar al diagrama" }))
    expect(await screen.findByRole("status")).toHaveTextContent("ya existe la clase Factura")
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("region", { name: "Modelo UML candidato" })).toBeInTheDocument()
  })

  it("muestra error controlado y conserva el modelo", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Servicio no disponible" }), { status: 503 }))
    const aplicar = vi.fn()
    render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={aplicar} />)
    fireEvent.change(screen.getByLabelText("Seleccionar imagen"), { target: { files: [archivo] } })
    fireEvent.click(screen.getByRole("button", { name: "Analizar imagen" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Servicio no disponible")
    expect(aplicar).not.toHaveBeenCalled()
  })

  it("acumula otra imagen en el candidato sin aplicar cambios canónicos", async () => {
    const aplicar = vi.fn()
    render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={aplicar} />)
    await seleccionarYAnalizar()
    const nueva = new File([new Uint8Array([0xff, 0xd8, 0xff])], "otra.jpg", { type: "image/jpeg" })
    const segundaRespuesta = {
      ...respuesta,
      candidato: { clases: [{ refTemporal: "tmp_cliente", nombre: "Cliente", atributos: [] }], relaciones: [], advertencias: [] },
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(segundaRespuesta), { status: 200 }))
    fireEvent.change(screen.getByLabelText("Seleccionar imagen"), { target: { files: [nueva] } })
    expect(screen.getByRole("region", { name: "Modelo UML candidato" })).toBeInTheDocument()
    expect(screen.getByText(/otra.jpg/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Analizar otra imagen" }))
    expect(await screen.findByText("Cliente")).toBeInTheDocument()
    expect(screen.getByText(/Imágenes analizadas: 2 \/ 4/)).toBeInTheDocument()
    expect(aplicar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Agregar al diagrama" }))
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0]?.[0].clases.map((clase: ModeloUMLCanonico["clases"][number]) => clase.nombre)).toEqual(["Factura", "Cliente"])
  })

  it("limita una sesión progresiva a cuatro análisis visibles", async () => {
    render(<PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={vi.fn()} />)
    for (let indice = 1; indice <= 4; indice += 1) {
      fireEvent.change(screen.getByLabelText("Seleccionar imagen"), { target: { files: [archivo] } })
      fireEvent.click(screen.getByRole("button", { name: indice === 1 ? "Analizar imagen" : "Analizar otra imagen" }))
      await screen.findByText(new RegExp(`Imágenes analizadas: ${indice} / 4`))
    }
    expect(screen.getByLabelText("Seleccionar imagen")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Analizar otra imagen" })).toBeDisabled()
  })

  it("presenta en inglés la semántica estática del candidato sin mutar el modelo", async () => {
    localStorage.setItem("sw1.idioma", "en")
    const modeloAntes = JSON.stringify(modelo)
    render(<ProveedorPreferenciasUI><PanelModeladoDesdeImagen modelo={modelo} alAplicarModelo={vi.fn()} /></ProveedorPreferenciasUI>)
    fireEvent.change(screen.getByLabelText("Select image"), { target: { files: [archivo] } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze image" }))
    await screen.findByRole("region", { name: "Candidate UML model" })
    expect(screen.getByText(/Classes detected: 1/)).toBeInTheDocument()
    expect(screen.getByText(/nombre — type not visible · will not be imported/i)).toBeInTheDocument()
    expect(screen.getByText(/monto: Money · unsupported type · will not be imported/i)).toBeInTheDocument()
    expect(screen.getByText("Texto parcialmente ilegible.")).toBeInTheDocument()
    expect(JSON.stringify(modelo)).toBe(modeloAntes)
  })
})
