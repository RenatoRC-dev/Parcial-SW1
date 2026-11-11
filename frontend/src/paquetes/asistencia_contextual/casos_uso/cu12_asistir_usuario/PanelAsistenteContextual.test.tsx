import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContextoAsistente } from "./ContextoAsistente"
import { PanelAsistenteContextual } from "./PanelAsistenteContextual"
import { consultarAsistenteContextual, ErrorConsultaContextual, type MensajeColaborativo } from "./consultarAsistenteContextual"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { ProveedorPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Modelo" }, area: "modelado_uml", idioma: "es", revisionModelo: 1,
  modeloActual: { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [], truncado: false }, elementoSeleccionado: null,
  elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 }, estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
  generacion: { estado: "apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: false, candidatoImagenPendiente: false,
  accionesDisponibles: ["NINGUNA"],
}
const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [] }
const ejecucion = { participantId: "u", modelo, revisionEditor: 0, alAplicarModelo: vi.fn() }
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
  return { cargar, conectar, recuperar: vi.fn(async () => []) }
}

describe("PanelAsistenteContextual colaborativo", () => {
  it.each([
    ["ollama", "Ollama · Qwen3"], ["groq_cu04", "Groq · CU04"], ["groq_cu05", "Groq · CU05"],
    ["determinista", "NexoCASE"], ["cu08", "CU08"], ["cu07", "CU07 · XMI"], ["spring", "Spring"],
  ] as const)("muestra procedencia real %s sin inferir herramientas desde el texto", async (nombre, etiqueta) => {
    const actual = { ...mensaje("1", "ai", "Seleccioné exportar XMI, todavía no se ha ejecutado."), procedencia: [{ nombre, estado: "completed" as const }] }
    const antiguo = mensaje("2", "ai", "Respuesta histórica sin procedencia")
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...dependencias([actual, antiguo])} />)
    expect(await screen.findByTestId("procedencia-ia")).toHaveTextContent(etiqueta)
    expect(screen.getAllByTestId("procedencia-ia")).toHaveLength(1)
    if (nombre === "ollama") expect(screen.getByTestId("procedencia-ia")).not.toHaveTextContent("CU07")
    expect(screen.queryByRole("button", { name: "↓ modelo.xmi" })).not.toBeInTheDocument()
  })

  it("ofrece descargar el artefacto XMI del turno propio sin mutar ni llamar otra IA", async () => {
    const deps = dependencias()
    const consultar = vi.fn(async () => ({ kind: "tool" as const, operacion: "exportar_xmi" as const, baseEditorRevision: 0,
      mensajeHumano: mensaje("1", "human", "Exporta XMI"), mensajeIA: mensaje("2", "ai", "Archivo generado"),
      artifact: { nombre: "modelo.xmi" as const, mime: "application/xml" as const, contenido: "<XMI/>" } }))
    const crearURL = vi.fn((_blob: Blob) => "blob:xmi")
    const revocarURL = vi.fn()
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: crearURL })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revocarURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const aplicar = vi.fn()
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} alAplicarModelo={aplicar} {...deps} consultar={consultar} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Exporta XMI" } })
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
    fireEvent.click(await screen.findByRole("button", { name: "↓ modelo.xmi" }))
    expect(click).toHaveBeenCalledOnce()
    expect(crearURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(consultar).toHaveBeenCalledOnce(); expect(aplicar).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it.each(["Crea una clase Prestamo", "¿Qué es una asociación?", "Recomienda un atributo", "Ejecuta"])("usa el único compositor y el orquestador para: %s", async (texto) => {
    const deps = dependencias()
    const consultar = vi.fn(async (..._args: Parameters<typeof consultarAsistenteContextual>) => ({ kind: "advisory" as const, mensajeHumano: mensaje("1", "human", texto), mensajeIA: mensaje("2", "ai", "Respuesta compartida") }))
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} consultar={consultar} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
    const entrada = screen.getByRole("textbox")
    fireEvent.change(entrada, { target: { value: texto } })
    fireEvent.keyDown(entrada, { key: "Enter" })
    expect(await screen.findByText("Respuesta compartida")).toBeVisible()
    expect(consultar.mock.calls[0].slice(0, 2)).toEqual(["p", "cred"])
    expect(consultar.mock.calls[0][3]).toBe(texto)
    expect(consultar.mock.calls[0][5]).toEqual(modelo)
    expect(screen.queryByRole("button", { name: "Aplicar cambio" })).not.toBeInTheDocument()
  })

  const propuesta = (): MensajeColaborativo => ({ ...mensaje("2", "ai", "Recomiendo crear Prestamo"), replyToMessageId: "1",
    recomendacion: { resumen: "Crear Prestamo", targetElementIds: [], normalizedInstruction: "Crea la clase Prestamo" } })

  it("ofrece aplicar solo la propuesta propia y espera confirmación sin mutar de forma optimista", async () => {
    const deps = dependencias([mensaje("1", "human", "Recomienda una clase"), propuesta()])
    const consultar = vi.fn(async (..._args: Parameters<typeof consultarAsistenteContextual>) => ({ kind: "clarification" as const, mensajeHumano: mensaje("3", "human", "Aplica"), mensajeIA: mensaje("4", "ai", "Aclara la regla") }))
    const aplicar = vi.fn()
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} alAplicarModelo={aplicar} {...deps} consultar={consultar} />)
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar cambio" }))
    expect(aplicar).not.toHaveBeenCalled()
    expect(await screen.findByRole("status")).toHaveTextContent("aclaración")
    expect(consultar.mock.calls[0][3]).toBe("Aplica la propuesta: Crea la clase Prestamo")
    expect(screen.queryByRole("button", { name: "Aplicar cambio" })).not.toBeInTheDocument()
    expect(screen.queryByText("Aplicado")).not.toBeInTheDocument()
  })

  it.each(["otro participante", "target inexistente", "destructiva", "sin correlación", "turno superado"])("no ofrece aplicar una propuesta: %s", async (caso) => {
    const humano = mensaje("1", "human", "Recomienda")
    const sugerencia = propuesta()
    if (caso === "otro participante") humano.participantId = "otra-persona"
    if (caso === "target inexistente") sugerencia.recomendacion!.targetElementIds = ["inexistente"]
    if (caso === "destructiva") sugerencia.recomendacion!.normalizedInstruction = "Elimina todas las clases"
    if (caso === "sin correlación") sugerencia.replyToMessageId = "otro-turno"
    const deps = dependencias([humano, sugerencia, ...(caso === "turno superado" ? [mensaje("3", "human", "Ejecuta")] : [])])
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} />)
    expect(await screen.findByText("Recomiendo crear Prestamo")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Aplicar cambio" })).not.toBeInTheDocument()
  })

  it("oculta la propuesta cuando su target deja de existir en el modelo vivo", async () => {
    const sugerencia = propuesta()
    sugerencia.recomendacion = { resumen: "Agregar estado", targetElementIds: ["prestamo"], normalizedInstruction: "Agrega estado String a Prestamo" }
    const deps = dependencias([mensaje("1", "human", "Recomienda"), sugerencia])
    const props = { projectId: "p", credential: "cred", contexto, ...ejecucion, ...deps }
    const vivo: ModeloUMLCanonico = { ...modelo, clases: [{ id: "prestamo", nombre: "Prestamo", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }] }
    const { rerender } = render(<PanelAsistenteContextual {...props} modelo={vivo} />)
    expect(await screen.findByRole("button", { name: "Aplicar cambio" })).toBeVisible()
    rerender(<PanelAsistenteContextual {...props} modelo={modelo} revisionEditor={1} />)
    expect(screen.queryByRole("button", { name: "Aplicar cambio" })).not.toBeInTheDocument()
  })

  it("traduce el chat, la propuesta y los controles multimedia al inglés", async () => {
    localStorage.setItem("sw1.idioma", "en")
    try {
      render(<ProveedorPreferenciasUI><PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...dependencias([mensaje("1", "human", "Recommend"), propuesta()])} /></ProveedorPreferenciasUI>)
      expect(await screen.findByRole("button", { name: "Apply change" })).toBeVisible()
      expect(screen.getByRole("heading", { name: "Modeling assistant" })).toBeVisible()
      expect(screen.getByLabelText("Message to the modeling assistant")).toBeVisible()
      expect(screen.getByLabelText("Attach image")).toBeVisible()
      expect(screen.getByRole("button", { name: /Speak/ })).toBeInTheDocument()
    } finally { localStorage.clear() }
  })

  it("muestra mensajes de colaboradores por tiempo real sin ejecutar sus planes", async () => {
    const deps = dependencias()
    let recibir: (mensaje: MensajeColaborativo) => void = () => {}
    const conectar = vi.fn((opciones: Parameters<NonNullable<Parameters<typeof PanelAsistenteContextual>[0]["conectar"]>>[0]) => {
      recibir = opciones.alMensaje; opciones.alAutenticar(); return { desconectar: vi.fn() }
    })
    const aplicar = vi.fn(); const consultar = vi.fn()
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} alAplicarModelo={aplicar} {...deps} conectar={conectar} consultar={consultar} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    const ajeno = { ...mensaje("1", "human", "Recomienda", "Ana"), participantId: "ana" }
    act(() => { recibir(ajeno); recibir(propuesta()) })
    expect(screen.getByText("Ana:")).toBeVisible()
    expect(screen.getByText("Recomiendo crear Prestamo")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Aplicar cambio" })).not.toBeInTheDocument()
    expect(aplicar).not.toHaveBeenCalled(); expect(consultar).not.toHaveBeenCalled()
  })

  it("presenta énfasis y párrafos como texto seguro sin consultar IA", async () => {
    const deps = dependencias([mensaje("1", "ai", "**Propuesta**\n\n- Cliente\n- Producto\n<img src=x onerror=alert(1)>")])
    const consultar = vi.fn()
    const { container } = render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} consultar={consultar} />)
    expect(await screen.findByText("Propuesta")).toHaveProperty("tagName", "STRONG")
    expect(container.textContent).not.toContain("**")
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>")
    expect(consultar).not.toHaveBeenCalled()
  })

  it("distingue aclaración de ejecución aplicada", async () => {
    const deps = dependencias()
    const consultar = vi.fn(async () => ({ kind: "clarification" as const, mensajeHumano: mensaje("1", "human", "Hazlo tú"), mensajeIA: mensaje("2", "ai", "¿Qué propuesta deseas aplicar?") }))
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} consultar={consultar} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    fireEvent.change(screen.getByLabelText("Mensaje al asistente de modelado"), { target: { value: "Hazlo tú" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Necesito una aclaración para continuar.")
    expect(screen.queryByText("Aplicado")).not.toBeInTheDocument()
  })

  it("bloquea reenvíos por botón y Enter durante retry-after sin perder la solicitud", async () => {
    const deps = dependencias()
    const consultar = vi.fn(async () => { throw new ErrorConsultaContextual("limite", "Espera antes de reintentar.", 12) })
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} consultar={consultar} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    const entrada = screen.getByLabelText("Mensaje al asistente de modelado")
    fireEvent.change(entrada, { target: { value: "Hazlo tú" } }); fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await screen.findByRole("alert")
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "↻ Enviar" })).toBeDisabled()
    fireEvent.keyDown(entrada, { key: "Enter" })
    expect(consultar).toHaveBeenCalledTimes(1)
    expect(entrada).toHaveValue("Hazlo tú")
  })

  it("carga la conversación durable y muestra autores reales", async () => {
    const deps = dependencias([mensaje("1", "human", "Hola", "Renato"), mensaje("2", "ai", "Te escucho")])
    render(<PanelAsistenteContextual projectId="p" credential="credencial-secreta" contexto={contexto} {...ejecucion} {...deps} />)
    expect(await screen.findByText(/Renato:/)).toBeInTheDocument()
    expect(screen.getByText(/Asistente:/)).toBeInTheDocument()
    expect(screen.queryByText(/credencial-secreta/)).not.toBeInTheDocument()
    expect(deps.cargar).toHaveBeenCalledWith("p", "credencial-secreta", undefined)
  })

  it.each(["no_disponible", "respuesta_invalida"] as const)("conserva input y requestId tras %s; solo reintenta al pulsar Enviar", async (tipo) => {
    const deps = dependencias([mensaje("1", "human", "Anterior")])
    let intento = 0
    const consultar = vi.fn(async (_projectId: string, _credential: string, _requestId: string, _pregunta: string, _contexto: ContextoAsistente) => {
      intento += 1
      if (intento === 1) throw new ErrorConsultaContextual(tipo, "Groq no disponible")
      return { kind: "advisory" as const, mensajeHumano: mensaje("2", "human", "Nueva"), mensajeIA: mensaje("3", "ai", "Respuesta") }
    })
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} consultar={consultar} {...deps} />)
    await screen.findByText(/Anterior/)
    const entrada = screen.getByLabelText("Mensaje al asistente de modelado")
    fireEvent.change(entrada, { target: { value: "Nueva" } }); fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Groq no disponible")
    expect(entrada).toHaveValue("Nueva")
    const requestId = consultar.mock.calls[0][2]
    expect(consultar).toHaveBeenCalledTimes(1)
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
    fireEvent.change(screen.getByLabelText("Mensaje al asistente de modelado"), { target: { value: "Revisa" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await waitFor(() => expect(consultar).toHaveBeenCalledOnce())
    expect(consultar.mock.calls[0][0]).toBe("p")
    expect(consultar.mock.calls[0][1]).toBe("cred")
    expect(consultar.mock.calls[0][4]).toBe(contexto)
  })

  it("explica que las solicitudes claras se derivan al flujo controlado CU04", async () => {
    const deps = dependencias()
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} {...deps} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    expect(screen.getByText(/NexoCASE lo aplica de forma controlada mediante CU04/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Asistente de modelado" })).toBeInTheDocument()
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
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} participantId="u" modelo={modeloVenta} revisionEditor={4} alAplicarModelo={aplicar} consultar={consultar} {...deps} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Mensaje al asistente de modelado"), { target: { value: "Agrega total" } })
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
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} participantId="u" modelo={modelo} revisionEditor={1} alAplicarModelo={aplicar} consultar={consultar} {...deps} />)
    await waitFor(() => expect(deps.cargar).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Mensaje al asistente de modelado"), { target: { value: "Hazlo" } }); fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("modelo cambio")
    expect(aplicar).not.toHaveBeenCalled()
  })

  it.each(["participante", "proyecto", "correlación"])("rechaza un plan HTTP ajeno por %s", async (caso) => {
    const humano = mensaje("1", "human", "Crea Venta")
    if (caso === "participante") humano.participantId = "otra-persona"
    if (caso === "proyecto") humano.projectId = "otro-proyecto"
    const consultar = vi.fn(async () => ({ kind: "action" as const, mensajeHumano: humano, actionId: "accion",
      sourceMessageId: caso === "correlación" ? "otra-solicitud" : "1", normalizedInstruction: "Crea Venta", baseEditorRevision: 0,
      plan: { resultado: "aplicar" as const, mensaje: "Venta creada", revision: 0, comandos: [{ tipo: "crear_clase" as const, refTemporal: "tmp_venta", nombre: "Venta", abstracta: false }] } }))
    const aplicar = vi.fn(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} alAplicarModelo={aplicar} consultar={consultar} {...dependencias()} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Crea Venta" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("no corresponde a tu solicitud")
    expect(aplicar).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })

  it("reintenta confirmar una acción sin duplicarla tras fallo de confirmación", async () => {
    const deps = dependencias(); const aplicar = vi.fn()
    const consultar = vi.fn(async () => ({ kind: "action" as const, mensajeHumano: mensaje("1", "human", "Crea Venta"), actionId: "accion",
      sourceMessageId: "1", normalizedInstruction: "Crea Venta", baseEditorRevision: 0,
      plan: { resultado: "aplicar" as const, mensaje: "Venta creada", revision: 0, comandos: [{ tipo: "crear_clase" as const, refTemporal: "tmp_venta", nombre: "Venta", abstracta: false }] } }))
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Confirmación pendiente" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "action_applied", mensajeIA: mensaje("2", "ai", "Venta creada") }), { status: 200 }))
    vi.stubGlobal("fetch", fetch)
    render(<PanelAsistenteContextual projectId="p" credential="cred" contexto={contexto} {...ejecucion} alAplicarModelo={aplicar} consultar={consultar} {...deps} />)
    await screen.findByText("Todavía no hay mensajes compartidos.")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Crea Venta" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    await screen.findByText("Confirmación pendiente")
    expect(screen.queryByText("Aplicado")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByText("Venta creada")).toBeVisible()
    expect(aplicar).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
