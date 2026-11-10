import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PanelInteroperabilidadXmi } from "./PanelInteroperabilidadXmi"
import { ProveedorPreferenciasUI } from "../../../configuracion/PreferenciasUI"

const modelo = {
  id: "modelo",
  nombre: "Modelo",
  version: "4.2.0",
  clases: [],
  relaciones: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("PanelInteroperabilidadXmi", () => {
  it("mantiene el estado de importación y bloquea acciones hasta confirmar el resultado", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    let resolver!: (respuesta: unknown) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolver = resolve })))
    const importar = vi.fn()
    render(<PanelInteroperabilidadXmi modelo={modelo} alImportar={importar} />)
    const archivo = { name: "modelo.xmi", text: async () => "<xml/>" } as File
    fireEvent.change(screen.getByTestId("selector-xmi"), { target: { files: [archivo] } })
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(screen.getByRole("region", { name: "Interoperabilidad XMI" })).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("button", { name: "Importar XMI" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Exportar XMI" })).toBeDisabled()
    expect(importar).not.toHaveBeenCalled()
    resolver({ ok: true, json: async () => ({ modelo, advertencias: [] }) })
    expect(await screen.findByText("Importado correctamente")).toBeVisible()
    expect(importar).toHaveBeenCalledExactlyOnceWith(modelo)
    expect(screen.getByRole("region", { name: "Interoperabilidad XMI" })).toHaveAttribute("aria-busy", "false")
  })

  it("explica selección, Guardar y compatibilidad en inglés", () => {
    localStorage.setItem("sw1.idioma", "en")
    try {
      render(<ProveedorPreferenciasUI><PanelInteroperabilidadXmi modelo={modelo} alImportar={vi.fn()} /></ProveedorPreferenciasUI>)
      expect(screen.getByRole("button", { name: "Import XMI" })).toBeVisible()
      expect(screen.getByText(/Select an .xmi or .xml file/)).toBeVisible()
      expect(screen.getByText(/Export does not replace Save/)).toBeVisible()
      expect(screen.getByText(/Universal Enterprise Architect/)).toBeInTheDocument()
    } finally { localStorage.clear() }
  })
  it("explica el límite de interoperabilidad de la marca asociativa sin llamadas IA", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<PanelInteroperabilidadXmi modelo={{ ...modelo, clases: [{ id: "a", nombre: "Inscripcion", tipoClase: "asociativa", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }] }} alImportar={vi.fn()} />)
    expect(screen.getByText(/extensión propia/)).toHaveTextContent("métodos UML siguen fuera del perfil XMI")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("muestra un error controlado del servicio de exportación", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Modelo no apto para exportación XMI." }),
    }))
    render(<PanelInteroperabilidadXmi modelo={modelo} alImportar={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Exportar XMI" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Modelo no apto"))
  })

  it("cancela la importación sin reemplazar el modelo", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(window, "confirm").mockReturnValue(false)
    const alImportar = vi.fn()
    render(<PanelInteroperabilidadXmi modelo={modelo} alImportar={alImportar} />)
    const archivo = { name: "modelo.xmi", type: "application/xml", text: async () => "<xml/>" } as File
    fireEvent.change(screen.getByTestId("selector-xmi"), { target: { files: [archivo] } })
    expect(alImportar).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("presenta una advertencia agregada sin ids técnicos", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        modelo,
        advertencias: [{ codigo: "ATRIBUTOS_SIN_TIPO", mensaje: "315 atributos sin tipo definido. Se conservaron como incompletos para su edición." }],
      }),
    }))
    render(<PanelInteroperabilidadXmi modelo={modelo} alImportar={vi.fn()} />)
    const archivo = { name: "modelo.xmi", type: "application/xml", text: async () => "<xml/>" } as File
    fireEvent.change(screen.getByTestId("selector-xmi"), { target: { files: [archivo] } })

    await waitFor(() => expect(screen.getByText(/315 atributos sin tipo definido/)).toBeVisible())
    expect(screen.queryByText(/EAID_/)).toBeNull()
  })
})
