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
    const archivo = new File(["<xml/>"] , "modelo.xmi", { type: "application/xml" })
    fireEvent.change(screen.getByTestId("selector-xmi"), { target: { files: [archivo] } })
    expect(alImportar).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
