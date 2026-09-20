import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PanelInteroperabilidadXmi } from "./PanelInteroperabilidadXmi"

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
