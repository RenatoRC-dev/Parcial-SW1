import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ContextoAsistente } from "./ContextoAsistente"
import type { MensajeConversacionContextual } from "./ContextoAsistente"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Modelo" }, area: "modelado_uml", elementoSeleccionado: null,
  elementosRelevantes: [{ id: "r", tipo: "relacion", nombre: "Usuario — Rol" }],
  resumenModelo: { clases: 2, relaciones: 1 }, estadoUml: { estado: "valido", problemas: [] },
  generacion: { estado: "no_apto", bloqueos: ["Usuario (0..*) ↔ Rol (0..*) representa un N:M directo."], advertencias: [] },
  cambiosSinGuardar: true, candidatoImagenPendiente: false,
  accionesDisponibles: ["NINGUNA", "IR_A_GENERACION"],
}

describe("PanelAsistenteContextual", () => {
  it("mantiene visible la orientación determinista cuando Groq falla", async () => {
    const consultar = vi.fn(async () => { throw new Error("El asistente IA no está disponible temporalmente. La orientación del sistema continúa disponible.") })
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    expect(screen.getByText(/Puedes convertir la relación N:M/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "¿Por qué no puedo generar?" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("orientación del sistema continúa disponible")
    expect(screen.getByText(/Puedes convertir la relación N:M/)).toBeInTheDocument()
  })

  it("conserva una conversación corta y no recibe ninguna función de mutación", async () => {
    const consultar = vi.fn(async (_pregunta: string, _contexto: ContextoAsistente, _conversacion: MensajeConversacionContextual[]) => ({ respuesta: "Convierte la relación en una clase asociativa.", accionSugerida: "IR_A_GENERACION" as const, elementoRelacionadoId: null, nivel: "sugerencia" as const }))
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    fireEvent.change(screen.getByLabelText("Pregunta sobre tu modelo o sobre SW1"), { target: { value: "¿Qué hago?" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledOnce())
    expect(screen.getByText(/Convierte la relación/)).toBeInTheDocument()
    expect(consultar.mock.calls[0][1]).toBe(contexto)
  })
})
