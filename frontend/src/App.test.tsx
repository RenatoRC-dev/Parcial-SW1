import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App"

vi.mock("./paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases", () => ({
  PaginaModeladoClases: ({ modeloInicial, alCambiarModeloCanonico }: { modeloInicial: { clases: unknown[] }; alCambiarModeloCanonico: (modelo: unknown) => void }) => <div data-testid="editor-simulado">
    Clases: {modeloInicial.clases.length}
    <button onClick={() => alCambiarModeloCanonico({ ...modeloInicial, clases: [{ id: "c", nombre: "Cliente", atributos: [{ id: "a", nombre: "borrador", tipo: null }], posicion: { x: 0, y: 0 }, abstracta: false }] })}>Modificar</button>
  </div>,
}))

const proyecto = { id: "11111111-1111-4111-8111-111111111111", nombre: "Ventas", creadoEn: "2026-01-01T00:00:00.000Z", actualizadoEn: "2026-01-01T00:00:00.000Z", modelo: { id: "m", nombre: "Ventas", version: "4.2.0", clases: [], relaciones: [] } }

function respuesta(cuerpo: unknown, estado = 200) {
  return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } }))
}

describe("ciclo de proyecto", () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it("lista, abre, detecta cambios y guarda el modelo más reciente incluso con atributo sin tipo", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => respuesta([{ ...proyecto, modelo: undefined }]))
      .mockImplementationOnce(() => respuesta(proyecto))
      .mockImplementationOnce((_entrada, init) => {
        expect(JSON.parse(String(init?.body)).modelo.clases[0].atributos[0].tipo).toBeNull()
        return respuesta({ ...proyecto, actualizadoEn: "2026-01-02T00:00:00.000Z" })
      })
    render(<App />)
    await screen.findByText("Ventas")
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))
    await screen.findByTestId("editor-simulado")
    fireEvent.click(screen.getByRole("button", { name: "Modificar" }))
    expect(screen.getByTestId("estado-guardado")).toHaveTextContent("Cambios sin guardar")
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await screen.findByText("Proyecto guardado correctamente.")
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("crea un proyecto y muestra errores controlados", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => respuesta([])).mockImplementationOnce(() => respuesta(proyecto, 201))
    const { unmount } = render(<App />)
    await screen.findByText("No hay proyectos guardados.")
    fireEvent.change(screen.getByLabelText("Nombre del proyecto"), { target: { value: "Ventas" } })
    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }))
    await screen.findByTestId("editor-simulado")
    unmount()

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => respuesta({ error: "Fallo de lectura" }, 500))
    render(<App />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Fallo de lectura"))
  })

  it("avisa antes de abandonar cambios sin guardar", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => respuesta([])).mockImplementationOnce(() => respuesta(proyecto, 201))
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<App />)
    await screen.findByText("No hay proyectos guardados.")
    fireEvent.change(screen.getByLabelText("Nombre del proyecto"), { target: { value: "Ventas" } })
    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }))
    await screen.findByTestId("editor-simulado")
    fireEvent.click(screen.getByRole("button", { name: "Modificar" }))
    fireEvent.click(screen.getByRole("button", { name: "Mis proyectos" }))
    expect(confirmar).toHaveBeenCalled()
    expect(screen.getByTestId("editor-simulado")).toBeVisible()
  })
})
