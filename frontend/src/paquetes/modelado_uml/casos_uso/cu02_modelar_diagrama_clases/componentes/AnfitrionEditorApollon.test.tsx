import { render, waitFor } from "@testing-library/react"
import { AnfitrionEditorApollon } from "./AnfitrionEditorApollon"

describe("AnfitrionEditorApollon", () => {
  it("inicializa el componente React público y publica su modelo de clases vacío", async () => {
    const alCambiarModelo = vi.fn()
    const alOcurrirError = vi.fn()

    const { container } = render(
      <AnfitrionEditorApollon
        alCambiarModelo={alCambiarModelo}
        alOcurrirError={alOcurrirError}
      />
    )

    await waitFor(() => expect(alCambiarModelo).toHaveBeenCalled())

    const modeloInicial = alCambiarModelo.mock.calls[0]?.[0]
    expect(modeloInicial).toMatchObject({
      version: "4.2.0",
      type: "ClassDiagram",
      nodes: [],
      edges: [],
      assessments: {},
    })
    expect(container.querySelector(".apollon-host")).not.toBeNull()
    await waitFor(() =>
      expect(container.querySelector(".react-flow")).not.toBeNull()
    )
    expect(alOcurrirError).not.toHaveBeenCalled()

  })
})
