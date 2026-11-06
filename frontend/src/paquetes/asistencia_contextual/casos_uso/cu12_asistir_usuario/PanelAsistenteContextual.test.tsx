import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ContextoAsistente } from "./ContextoAsistente"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"
import { ErrorConsultaContextual, type MensajeColaborativo } from "./consultarAsistenteContextual"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Modelo" }, area: "modelado_uml", idioma: "es", revisionModelo: 1,
  modeloActual: { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [], truncado: false }, elementoSeleccionado: null,
  elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 }, estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
  generacion: { estado: "apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: false, candidatoImagenPendiente: false,
  accionesDisponibles: ["NINGUNA"],
}

const mensaje = (id: string, tipoRemitente: "human" | "ai", contenido: string, nombre = "Carlos"): MensajeColaborativo => ({
  id, projectId: "p", tipoRemitente, participantId: tipoRemitente === "human" ? "u" : null,
  nombreVisibleSnapshot: tipoRemitente === "human" ? nombre : "Asistente", contenido,
  requestId: "11111111-1111-4111-8111-111111111111", replyToMessageId: null,
  elementosRelacionadosIds: [], revisionModeloObservada: 1, creadoEn: `2026-01-01T00:00:0${id}.000Z`,
})

function dependencias(items: MensajeColaborativo[] = []) {
  const cargar = vi.fn(async () => ({ items, siguienteCursor: null }))
  const conectar = vi.fn(({ alAutenticar }: { alAutenticar: () => void }) => { alAutenticar(); return { desconectar: vi.fn() } })
  return { cargar, conectar }
}

describe("PanelAsistenteContextual colaborativo", () => {
  it("carga la conversación durable y muestra autores reales", async () => {
    const deps = dependencias([mensaje("1", "human", "Hola", "Renato"), mensaje("2", "ai", "Te escucho")])
    render(<PanelAsistenteContextual projectId="p" credential="credencial-secreta" contexto={contexto} {...deps} />)
    expect(await screen.findByText(/Renato:/)).toBeInTheDocument()
    expect(screen.getByText(/Asistente:/)).toBeInTheDocument()
    expect(screen.queryByText(/credencial-secreta/)).not.toBeInTheDocument()
    expect(deps.cargar).toHaveBeenCalledWith("p", "credencial-secreta", undefined)
  })

  it("conserva historial e input si el proveedor falla y reutiliza requestId al reintentar", async () => {
    const deps = dependencias([mensaje("1", "human", "Anterior")])
    let intento = 0
    const consultar = vi.fn(async (_projectId: string, _credential: string, _requestId: string, _pregunta: string, _contexto: ContextoAsistente) => {
      intento += 1
      if (intento === 1) throw new ErrorConsultaContextual("no_disponible", "Groq no disponible")
      return { mensajeHumano: mensaje("2", "human", "Nueva"), mensajeIA: mensaje("3", "ai", "Respuesta") }
    })
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} consultar={consultar} {...deps} />)
    await screen.findByText(/Anterior/)
    const entrada = screen.getByLabelText("Pregunta al asistente colaborativo")
    fireEvent.change(entrada, { target: { value: "Nueva" } }); fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Groq no disponible")
    expect(entrada).toHaveValue("Nueva")
    const requestId = consultar.mock.calls[0][2]
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await screen.findByText(/Respuesta/)
    expect(consultar.mock.calls[1][2]).toBe(requestId)
    expect(screen.getByText(/Anterior/)).toBeInTheDocument()
  })

  it("envía siempre proyecto, credencial y el contexto vigente", async () => {
    const deps = dependencias()
    const consultar = vi.fn(async (_projectId: string, _credential: string, _requestId: string, _pregunta: string, _contexto: ContextoAsistente) => ({ mensajeHumano: mensaje("1", "human", "Revisa"), mensajeIA: mensaje("2", "ai", "Listo") }))
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} consultar={consultar} {...deps} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Pregunta al asistente colaborativo"), { target: { value: "Revisa" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledOnce())
    expect(consultar.mock.calls[0][0]).toBe("p")
    expect(consultar.mock.calls[0][1]).toBe("cred")
    expect(consultar.mock.calls[0][4]).toBe(contexto)
  })

  it("mantiene separadas la orientación y la modificación por Asistente IA", async () => {
    const deps = dependencias()
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...deps} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    expect(screen.getByText(/Las modificaciones del modelo se aplican mediante Asistente IA/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Asistente colaborativo" })).toBeInTheDocument()
  })
})
