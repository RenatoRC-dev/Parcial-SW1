import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"
import type { ContextoAsistente } from "./ContextoAsistente"
import type { VistaFlujoAsistente, MensajeColaborativo } from "./consultarAsistenteContextual"

const modelo = { id: "m", nombre: "M", version: "1", clases: [], relaciones: [] }
const contexto: ContextoAsistente = { proyecto: { id: "p", nombre: "P" }, area: "modelado_uml", idioma: "es", revisionModelo: 0,
  modeloActual: { ...modelo, truncado: false }, elementoSeleccionado: null, elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 },
  estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] }, generacion: { estado: "no_apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: true, candidatoImagenPendiente: false, accionesDisponibles: ["NINGUNA"] }
const flujo: VistaFlujoAsistente = { requestId: "request", sourceMessageId: "humano", participantId: "u", revision: 3, estado: "review", operacion: "importar_xmi", resumen: "Confirmar REEMPLAZARÁ el modelo", advertencias: ["Elemento no soportado omitido"], clases: ["Cliente"] }
const mensaje: MensajeColaborativo = { id: "humano", projectId: "p", participantId: "u", tipoRemitente: "human", nombreVisibleSnapshot: "Ana", contenido: "Importa archivo.xmi", requestId: "request", replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: "2026-11-10T00:00:00Z" }
const resultadoModelo = { ...modelo, clases: [{ id: "cliente", nombre: "Cliente", atributos: [], abstracta: false, posicion: { x: 0, y: 0 } }] }
function preparar(vista: VistaFlujoAsistente = flujo) {
  const confirmar = vi.fn(async (..._args: unknown[]) => ({ flujo: { ...vista, estado: "issued" as const }, modeloResultado: resultadoModelo }))
  const completar = vi.fn(async (..._args: unknown[]) => ({ kind: "workflow" as const, mensajeHumano: mensaje, mensajeIA: null, flujo: { ...vista, estado: "applied" as const } }))
  const aplicar = vi.fn(); const descargar = vi.fn(async () => {})
  const props = { projectId: "p", credential: "cred", participantId: "u", contexto, modelo, revisionEditor: 3, alAplicarModelo: aplicar, confirmar, completar, descargar,
    recuperar: vi.fn(async () => [vista]), cargar: vi.fn(async () => ({ items: [mensaje], siguienteCursor: null })), conectar: ({ alAutenticar }: { alAutenticar: () => void }) => { alAutenticar(); return { desconectar: vi.fn() } } }
  return { props, confirmar, completar, aplicar, descargar }
}

describe("flujos recuperables del asistente único", () => {
  it("recupera la vista previa y permite rechazar XMI sin reemplazar el modelo", async () => {
    const { props, confirmar, aplicar } = preparar()
    confirmar.mockResolvedValueOnce({ flujo: { ...flujo, estado: "cancelled" }, modeloResultado: undefined } as never)
    render(<PanelAsistenteContextual {...props} />)
    expect(await screen.findByText("Elemento no soportado omitido")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(confirmar).toHaveBeenCalledOnce())
    expect(confirmar.mock.calls[0][3]).toBe("rechazar")
    expect(aplicar).not.toHaveBeenCalled()
  })

  it("confirma el reemplazo con revisión y aplica exactamente el resultado del backend", async () => {
    const { props, confirmar, completar, aplicar } = preparar()
    render(<PanelAsistenteContextual {...props} />)
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar reemplazo del modelo" }))
    await waitFor(() => expect(completar).toHaveBeenCalledOnce())
    expect(confirmar.mock.calls[0].slice(0, 4)).toEqual(["p", "cred", "request", "confirmar"])
    expect(confirmar.mock.calls[0][5]).toBe(3)
    expect(aplicar).toHaveBeenCalledExactlyOnceWith(resultadoModelo)
  })

  it("un cambio vivo durante la confirmación HTTP impide aplicar el modelo obsoleto", async () => {
    const { props, confirmar, completar, aplicar } = preparar()
    let liberar!: () => void
    confirmar.mockImplementationOnce(() => new Promise((resolve) => { liberar = () => resolve({ flujo: { ...flujo, estado: "issued" }, modeloResultado: resultadoModelo }) }))
    const { rerender } = render(<PanelAsistenteContextual {...props} />)
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar reemplazo del modelo" }))
    rerender(<PanelAsistenteContextual {...props} revisionEditor={4} />)
    await act(async () => liberar())
    expect(await screen.findByRole("alert")).toHaveTextContent("El UML cambió")
    expect(aplicar).not.toHaveBeenCalled()
    expect(completar.mock.calls[0][3]).toBe("failed")
  })

  it("un fallo de ack se reintenta sin volver a aplicar ni confirmar el reemplazo", async () => {
    const { props, completar, confirmar, aplicar } = preparar()
    completar.mockRejectedValueOnce(new Error("Ack no disponible"))
    render(<PanelAsistenteContextual {...props} />)
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar reemplazo del modelo" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Ack no disponible")
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reemplazo del modelo" }))
    await waitFor(() => expect(completar).toHaveBeenCalledTimes(2))
    expect(aplicar).toHaveBeenCalledOnce(); expect(confirmar).toHaveBeenCalledOnce()
  })

  it("el artefacto recuperado se descarga desde la misma conversación sin mutar", async () => {
    const { props, descargar, aplicar } = preparar({ ...flujo, operacion: "generar_spring", estado: "ready", archivo: { nombre: "backend-generado.zip", mime: "application/zip" } })
    render(<PanelAsistenteContextual {...props} />)
    fireEvent.click(await screen.findByRole("button", { name: "↓ backend-generado.zip" }))
    await waitFor(() => expect(descargar).toHaveBeenCalledOnce())
    expect(descargar.mock.calls[0].slice(0, 2)).toEqual(["p", "cred"])
    expect(aplicar).not.toHaveBeenCalled()
  })

  it.each(["automatizar_ea", "importar_desde_ea"] as const)("EA %s muestra cola y consulta hasta confirmación real, reintentando un fallo transitorio sin aplicar UML", async (operacion) => {
    const cola: VistaFlujoAsistente = { ...flujo, operacion, estado: "queued", resumen: "Esperando conector; importación aún no confirmada", advertencias: [] }
    const { props, aplicar, confirmar } = preparar(cola)
    vi.useFakeTimers()
    const vista = render(<PanelAsistenteContextual {...props} />)
    try {
      await act(async () => {})
      expect(screen.getByText(cola.resumen)).toBeVisible()
      props.recuperar.mockRejectedValueOnce(new Error("Conector temporalmente desconectado"))
      props.recuperar.mockResolvedValueOnce([{ ...cola, estado: "importing", resumen: "Importando y verificando mediante COM" }])
      props.recuperar.mockResolvedValueOnce([{ ...cola, estado: "ready", resumen: "Importación confirmada por lectura COM" }])
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(screen.queryByText("Importación confirmada por lectura COM")).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(screen.getByText("Importando y verificando mediante COM")).toBeVisible()
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(screen.getByText("Importación confirmada por lectura COM")).toBeVisible()
      expect(aplicar).not.toHaveBeenCalled(); expect(confirmar).not.toHaveBeenCalled()
    } finally { vista.unmount(); vi.useRealTimers() }
  })
})
