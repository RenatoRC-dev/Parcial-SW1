import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProveedorPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import type { ContextoAsistente } from "./ContextoAsistente"
import type { MensajeConversacionContextual } from "./ContextoAsistente"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"
import { ErrorConsultaContextual } from "./consultarAsistenteContextual"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Modelo" }, area: "modelado_uml", idioma: "es", revisionModelo: 1,
  modeloActual: { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [], truncado: false }, elementoSeleccionado: null,
  elementosRelevantes: [{ id: "r", tipo: "relacion", nombre: "Usuario — Rol" }],
  resumenModelo: { clases: 2, relaciones: 1 }, estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
  generacion: { estado: "no_apto", bloqueos: ["Usuario (0..*) ↔ Rol (0..*) representa un N:M directo."], advertencias: [] },
  cambiosSinGuardar: true, candidatoImagenPendiente: false,
  accionesDisponibles: ["NINGUNA", "IR_A_GENERACION"],
}

describe("PanelAsistenteContextual", () => {
  it("mantiene visible la orientación determinista cuando Groq falla", async () => {
    const consultar = vi.fn(async () => { throw new ErrorConsultaContextual("no_disponible", "Servicio no disponible") })
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    expect(screen.getByText(/Puedes convertir la relación N:M/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "¿Mi modelo está listo para generar?" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Orientación avanzada temporalmente no disponible")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText(/Puedes convertir la relación N:M/)).toBeInTheDocument()
  })

  it("mantiene la degradación con ayuda local y la limpia después de recuperar Groq", async () => {
    const consultar = vi.fn()
      .mockRejectedValueOnce(new ErrorConsultaContextual("no_disponible", "Servicio no disponible"))
      .mockResolvedValueOnce({ respuesta: "Ayuda local de producto.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", origen: "determinista" })
      .mockResolvedValueOnce({ respuesta: "Explicación contextual recuperada.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", origen: "groq" })
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)

    fireEvent.click(screen.getByRole("button", { name: "¿Mi modelo está listo para generar?" }))
    expect(await screen.findByRole("status")).toBeInTheDocument()

    const entrada = screen.getByLabelText("Pregunta sobre tu modelo o sobre SW1")
    fireEvent.change(entrada, { target: { value: "¿Cómo uso el asistente IA?" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    expect(await screen.findByText(/Ayuda local de producto/)).toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()

    fireEvent.change(entrada, { target: { value: "Explícame esta situación" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    expect(await screen.findByText(/Explicación contextual recuperada/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  })

  it("presenta el límite temporal como degradación y no como error destructivo", async () => {
    const consultar = vi.fn(async () => { throw new ErrorConsultaContextual("limite", "Límite temporal") })
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    fireEvent.click(screen.getByRole("button", { name: "¿Mi modelo está listo para generar?" }))
    expect(await screen.findByRole("status")).toHaveTextContent("ayuda de uso, validación y orientación local siguen disponibles")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("mantiene los fallos de contrato como errores reales", async () => {
    const consultar = vi.fn(async () => { throw new ErrorConsultaContextual("respuesta_invalida", "Respuesta estructurada inválida") })
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    fireEvent.click(screen.getByRole("button", { name: "¿Mi modelo está listo para generar?" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Respuesta estructurada inválida")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("conserva una conversación corta y no recibe ninguna función de mutación", async () => {
    const consultar = vi.fn(async (_pregunta: string, _contexto: ContextoAsistente, _conversacion: MensajeConversacionContextual[]) => ({ respuesta: "Convierte la relación en una clase asociativa.", accionSugerida: "IR_A_GENERACION" as const, elementoRelacionadoId: null, nivel: "sugerencia" as const, categoriaRecomendacion: "RECOMENDADO" as const }))
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    fireEvent.change(screen.getByLabelText("Pregunta sobre tu modelo o sobre SW1"), { target: { value: "¿Qué hago?" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledOnce())
    expect(screen.getByText(/Convierte la relación/)).toBeInTheDocument()
    expect(screen.getByText(/Asistente contextual:/)).toBeInTheDocument()
    expect(consultar.mock.calls[0][1]).toBe(contexto)
    expect(screen.getByText("RECOMENDADO")).toBeInTheDocument()
  })

  it("preserva el intercambio reciente para una pregunta de seguimiento", async () => {
    const consultar = vi.fn(async (_pregunta: string, _contexto: ContextoAsistente, _conversacion: MensajeConversacionContextual[]) => ({ respuesta: "Dirección sería opcional si el negocio registra domicilios.", accionSugerida: "NINGUNA" as const, elementoRelacionadoId: null, nivel: "sugerencia" as const, categoriaRecomendacion: "OPCIONAL" as const }))
    render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    const entrada = screen.getByLabelText("Pregunta sobre tu modelo o sobre SW1")
    fireEvent.change(entrada, { target: { value: "¿Qué podría faltar en el modelo?" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1))
    fireEvent.change(entrada, { target: { value: "¿Qué atributos tendría?" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2))
    expect(consultar.mock.calls[1][2]).toEqual([
      { rol: "usuario", contenido: "¿Qué podría faltar en el modelo?" },
      { rol: "asistente", contenido: "Dirección sería opcional si el negocio registra domicilios." },
    ])
  })

  it("usa el modelo actualizado por encima del historial conservado", async () => {
    const consultar = vi.fn(async (_pregunta: string, _contexto: ContextoAsistente, _conversacion: MensajeConversacionContextual[]) => ({ respuesta: "Resultado actualizado.", accionSugerida: "NINGUNA" as const, elementoRelacionadoId: null, nivel: "informacion" as const, categoriaRecomendacion: "INFORMATIVO" as const }))
    const vista = render(<PanelAsistenteContextual contexto={contexto} consultar={consultar} />)
    const entrada = screen.getByLabelText("Pregunta sobre tu modelo o sobre SW1")
    fireEvent.change(entrada, { target: { value: "Sugiere una clase" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1))
    const actualizado = { ...contexto, revisionModelo: 2, modeloActual: { ...contexto.modeloActual, clases: [{ id: "direccion", nombre: "Dirección", tipoClase: "normal" as const, abstracta: false, atributos: [], operaciones: [] }] } }
    vista.rerender(<PanelAsistenteContextual contexto={actualizado} consultar={consultar} />)
    fireEvent.change(screen.getByLabelText("Pregunta sobre tu modelo o sobre SW1"), { target: { value: "¿Y ahora?" } })
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2))
    expect(consultar.mock.calls[1][1]).toBe(actualizado)
    expect(consultar.mock.calls[1][1].modeloActual.clases[0].nombre).toBe("Dirección")
    expect(consultar.mock.calls[1][2]).toHaveLength(2)
  })

  it("adapta las preguntas rápidas al estado y a la selección", () => {
    const vista = render(<PanelAsistenteContextual contexto={contexto} />)
    expect(screen.getByRole("button", { name: "¿Qué problemas o riesgos detecta SW1?" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "¿Qué podría faltar en este dominio?" })).not.toBeInTheDocument()

    vista.rerender(<PanelAsistenteContextual contexto={{ ...contexto, estadoUml: { estado: "invalido", problemas: ["Error"], errores: ["Error"], advertencias: [] } }} />)
    expect(screen.getByRole("button", { name: "¿Qué problemas tiene mi modelo?" })).toBeInTheDocument()

    vista.rerender(<PanelAsistenteContextual contexto={{ ...contexto, elementoSeleccionado: { tipo: "clase", id: "factura", nombre: "Factura", tipoClase: "normal", abstracta: false, atributos: [], operaciones: [], relacionesConectadas: [] } }} />)
    expect(screen.getByRole("button", { name: "¿Cómo edito esta clase?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Explícame esta clase" })).toBeInTheDocument()

    vista.rerender(<PanelAsistenteContextual contexto={{ ...contexto, elementoSeleccionado: { tipo: "relacion", id: "r", nombre: null, tipoRelacion: "asociacion", origen: { id: "cliente", nombre: "Cliente", multiplicidad: "1", rol: null }, destino: { id: "factura", nombre: "Factura", multiplicidad: "0..*", rol: null } } }} />)
    expect(screen.getByRole("button", { name: "Explícame esta relación" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "¿Cómo cambio su cardinalidad?" })).toBeInTheDocument()
  })

  it("presenta las preguntas contextuales en el idioma activo", () => {
    localStorage.setItem("sw1.idioma", "en")
    render(<ProveedorPreferenciasUI><PanelAsistenteContextual contexto={{ ...contexto, idioma: "en" }} /></ProveedorPreferenciasUI>)
    expect(screen.getByRole("button", { name: "What problems or risks does SW1 detect?" })).toBeInTheDocument()
    expect(screen.getByText("Contextual assistant")).toBeInTheDocument()
    localStorage.removeItem("sw1.idioma")
  })
})
