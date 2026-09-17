import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { PanelAsistenteModelado } from "./PanelAsistenteModelado"

const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "4.2.0", clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }], relaciones: [] }

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
})
