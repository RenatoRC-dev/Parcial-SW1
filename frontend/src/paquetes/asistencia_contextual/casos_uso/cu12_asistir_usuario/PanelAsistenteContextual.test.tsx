import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContextoAsistente } from "./ContextoAsistente"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"
import { consultarAsistenteContextual, ErrorConsultaContextual, type MensajeColaborativo } from "./consultarAsistenteContextual"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Modelo" }, area: "modelado_uml", idioma: "es", revisionModelo: 1,
  modeloActual: { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [], truncado: false }, elementoSeleccionado: null,
  elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 }, estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
  generacion: { estado: "apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: false, candidatoImagenPendiente: false,
  accionesDisponibles: ["NINGUNA"],
}
const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [] }
const ejecucion = { modelo, revisionEditor: 0, alAplicarModelo: vi.fn() }
afterEach(() => vi.unstubAllGlobals())

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
    render(<PanelAsistenteContextual projectId="p" credential="credencial-secreta" contexto={contexto} {...ejecucion} {...deps} />)
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
      return { kind: "advisory" as const, mensajeHumano: mensaje("2", "human", "Nueva"), mensajeIA: mensaje("3", "ai", "Respuesta") }
    })
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} consultar={consultar} {...deps} />)
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
    const consultar = vi.fn(async (..._args: Parameters<typeof consultarAsistenteContextual>) => ({ kind: "advisory" as const, mensajeHumano: mensaje("1", "human", "Revisa"), mensajeIA: mensaje("2", "ai", "Listo") }))
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} consultar={consultar} {...deps} />)
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
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    expect(screen.getByText(/Las modificaciones del modelo se aplican mediante Asistente IA/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Asistente colaborativo" })).toBeInTheDocument()
  })

  it("aplica el plan solo desde la respuesta HTTP del solicitante y confirma el resultado", async () => {
    const deps = dependencias()
    const modeloVenta: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", relaciones: [], clases: [
      { id: "venta", nombre: "Venta", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] },
    ] }
    const humano = mensaje("1", "human", "Agrega total")
    const consultar = vi.fn(async () => ({ kind: "action" as const, mensajeHumano: humano, actionId: "11111111-1111-4111-8111-111111111111",
      sourceMessageId: humano.id, normalizedInstruction: "Agrega atributo total Double a Venta", baseEditorRevision: 4,
      plan: { resultado: "aplicar" as const, mensaje: "Total agregado.", revision: 4,
        comandos: [{ tipo: "agregar_atributo" as const, claseRef: "venta", refTemporal: "tmp_total", nombre: "total", tipoDato: "Double", visibilidad: "privada" as const }] } }))
    const resultadoIA = mensaje("2", "ai", "Total agregado.")
    const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ kind: "action_applied", mensajeIA: resultadoIA }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetch)
    const aplicar = vi.fn()
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} modelo={modeloVenta} revisionEditor={4} alAplicarModelo={aplicar} consultar={consultar} {...deps} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Pregunta al asistente colaborativo"), { target: { value: "Agrega total" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await waitFor(() => expect(aplicar).toHaveBeenCalledOnce())
    expect(aplicar.mock.calls[0][0].clases[0].atributos).toEqual([expect.objectContaining({ nombre: "total", tipo: "Double" })])
    expect(String(fetch.mock.calls[0][0])).toContain("/modelado-ia/acciones/11111111-1111-4111-8111-111111111111/completar")
    expect(await screen.findByText(/Total agregado/)).toBeInTheDocument()
  })

  it("rechaza un plan stale sin mutar el modelo", async () => {
    const deps = dependencias(); const aplicar = vi.fn(); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "action_failed" }), { status: 200 })))
    const consultar = vi.fn(async () => ({ kind: "action" as const, mensajeHumano: mensaje("1", "human", "Hazlo"), actionId: "22222222-2222-4222-8222-222222222222",
      sourceMessageId: "1", normalizedInstruction: "Crea Venta", baseEditorRevision: 0,
      plan: { resultado: "aplicar" as const, mensaje: "Venta creada", revision: 0, comandos: [{ tipo: "crear_clase" as const, refTemporal: "tmp_venta", nombre: "Venta", abstracta: false }] } }))
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} modelo={modelo} revisionEditor={1} alAplicarModelo={aplicar} consultar={consultar} {...deps} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Pregunta al asistente colaborativo"), { target: { value: "Hazlo" } }); fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("modelo cambio")
    expect(aplicar).not.toHaveBeenCalled()
  })
})
