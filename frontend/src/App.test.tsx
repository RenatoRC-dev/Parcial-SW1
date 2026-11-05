import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App"
import { guardarProyectoReciente, listarProyectosRecientes } from "./paquetes/gestion_proyectos/compartido/AlmacenProyectosRecientes"

vi.mock("./paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases", () => ({
  PaginaModeladoClases: ({ modeloInicial, alCambiarModeloCanonico }: { modeloInicial: { clases: unknown[] }; alCambiarModeloCanonico: (modelo: unknown) => void }) => <div data-testid="editor-simulado">
    Clases: {modeloInicial.clases.length}
    <button onClick={() => alCambiarModeloCanonico({ ...modeloInicial, clases: [...modeloInicial.clases, { id: `c-${modeloInicial.clases.length}`, nombre: "Cliente", atributos: [{ id: "a", nombre: "borrador", tipo: null }], posicion: { x: 0, y: 0 }, abstracta: false }] })}>Modificar</button>
  </div>,
}))

const proyecto = { id: "11111111-1111-4111-8111-111111111111", nombre: "Ventas", creadoEn: "2026-01-01T00:00:00.000Z", actualizadoEn: "2026-01-01T00:00:00.000Z", revisionModelo: 0, modelo: { id: "m", nombre: "Ventas", version: "4.2.0", clases: [], relaciones: [] } }
const accesoCreado = { proyecto, participante: { id: "participante-1", nombreVisible: "Renato" }, codigoAcceso: "NX-2345-6789-ABCD", credencial: "A".repeat(43) }

function respuesta(cuerpo: unknown, estado = 200) {
  return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } }))
}

function registrarReciente() {
  guardarProyectoReciente({
    projectId: proyecto.id, projectName: proyecto.nombre, participantId: "participante-1",
    displayName: "Renato", credential: "A".repeat(43), lastOpenedAt: "2026-11-05T00:00:00.000Z",
  })
}

async function crearDesdePantalla() {
  fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }))
  fireEvent.change(screen.getByLabelText("Nombre del proyecto"), { target: { value: "Ventas" } })
  fireEvent.change(screen.getByLabelText("Tu nombre o apodo"), { target: { value: "Renato" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }))
  await screen.findByText("NX-2345-6789-ABCD")
  fireEvent.click(screen.getByRole("button", { name: "Entrar al proyecto" }))
  await screen.findByTestId("editor-simulado")
}

describe("ciclo seguro de proyecto", () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear() })

  it("crea con participante, muestra código y conserva acceso reciente al volver", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => respuesta(accesoCreado, 201))
    render(<App />)
    expect(screen.getByRole("heading", { name: "Proyectos recientes" })).toBeVisible()
    await crearDesdePantalla()
    const cuerpo = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(cuerpo).toEqual({ nombre: "Ventas", nombreParticipante: "Renato" })
    expect(localStorage.getItem("nexocase.proyectosRecientes.v1")).not.toContain("NX-2345-6789-ABCD")
    fireEvent.click(screen.getByRole("button", { name: "Volver" }))
    expect(await screen.findByText("Ventas")).toBeVisible()
    expect(listarProyectosRecientes()).toHaveLength(1)
  })

  it("abre reciente con Bearer, guarda revisionBase y actualiza la revisión", async () => {
    registrarReciente()
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => respuesta(proyecto))
      .mockImplementationOnce((_entrada, init) => {
        expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${"A".repeat(43)}`)
        const cuerpo = JSON.parse(String(init?.body))
        expect(cuerpo.revisionBase).toBe(0)
        expect(cuerpo.modelo.clases[0].atributos[0].tipo).toBeNull()
        return respuesta({ ...proyecto, actualizadoEn: "2026-01-02T00:00:00.000Z", revisionModelo: 1 })
      })
      .mockImplementationOnce((_entrada, init) => {
        expect(JSON.parse(String(init?.body)).revisionBase).toBe(1)
        return respuesta({ ...proyecto, revisionModelo: 2 })
      })
    render(<App />)
    fireEvent.click(await screen.findByRole("button", { name: "Abrir" }))
    await screen.findByTestId("editor-simulado")
    fireEvent.click(screen.getByRole("button", { name: "Modificar" }))
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await screen.findByText("Proyecto guardado correctamente.")
    fireEvent.click(screen.getByRole("button", { name: "Modificar" }))
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  })

  it("invalida localmente un acceso 401 y conserva la entrada ante 503", async () => {
    registrarReciente()
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => respuesta({ codigo: "CREDENCIAL_INVALIDA", error: "no" }, 401))
    const { unmount } = render(<App />)
    fireEvent.click(await screen.findByRole("button", { name: "Abrir" }))
    await screen.findByRole("heading", { name: "Unirse con código" })
    expect(listarProyectosRecientes()).toEqual([])
    unmount()

    registrarReciente()
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => respuesta({ codigo: "PERSISTENCIA_NO_DISPONIBLE" }, 503))
    render(<App />)
    fireEvent.click(await screen.findByRole("button", { name: "Abrir" }))
    await screen.findByRole("alert")
    expect(listarProyectosRecientes()).toHaveLength(1)
  })

  it("muestra conflicto de revisión sin reintentar ni sobrescribir", async () => {
    registrarReciente()
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => respuesta(proyecto))
      .mockImplementationOnce(() => respuesta({ codigo: "REVISION_CONFLICTIVA" }, 409))
    render(<App />)
    fireEvent.click(await screen.findByRole("button", { name: "Abrir" }))
    await screen.findByTestId("editor-simulado")
    fireEvent.click(screen.getByRole("button", { name: "Modificar" }))
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await screen.findByText(/El proyecto cambió desde la última versión guardada/)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
