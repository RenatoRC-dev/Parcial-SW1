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
    expect(container.querySelector('[data-apollon-control="apollon:palette"]')).toBeNull()
    expect(container.querySelector('[data-apollon-control="apollon:zoom"]')).not.toBeNull()
    expect(alOcurrirError).not.toHaveBeenCalled()

  })

  it("confirma explícitamente que el modelo persistido fue instalado antes de habilitar colaboración", async () => {
    const alCambiarModelo = vi.fn()
    const alAplicarModeloInicial = vi.fn()
    render(<AnfitrionEditorApollon
      alCambiarModelo={alCambiarModelo}
      alOcurrirError={vi.fn()}
      alAplicarModeloInicial={alAplicarModeloInicial}
      modeloParaReemplazar={{
        version: "4.2.0", id: "modelo-proyecto", title: "Persistido", type: "ClassDiagram",
        nodes: [], edges: [], assessments: {},
      }}
    />)
    await waitFor(() => expect(alAplicarModeloInicial).toHaveBeenCalledTimes(1))
    expect(alCambiarModelo).toHaveBeenCalledWith(expect.objectContaining({ title: "Persistido" }))
    expect(alAplicarModeloInicial.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.min(...alCambiarModelo.mock.invocationCallOrder),
    )
  })
})
