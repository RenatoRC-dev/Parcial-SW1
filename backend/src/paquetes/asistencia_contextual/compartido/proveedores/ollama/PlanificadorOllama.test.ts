import { describe, expect, it, vi } from "vitest"
import type { SolicitudAsistenteContextual } from "../../ContratoAsistenteContextual.js"
import { validarPlanLocal } from "../../PlanificadorLocal.js"
import { leerConfiguracionOllama, PlanificadorOllama } from "./PlanificadorOllama.js"

const config = { baseUrl: "http://127.0.0.1:11434", modelo: "qwen3:8b", timeoutMs: 1000 }
const solicitud: SolicitudAsistenteContextual = {
  requestId: "actual", pregunta: "Valida el modelo", conversacion: [],
  contexto: { proyecto: { id: "p", nombre: "Ventas" }, area: "modelado_uml", idioma: "es", revisionModelo: 0,
    modeloActual: { id: "m", nombre: "Ventas", version: "1", clases: [], relaciones: [], truncado: false },
    elementoSeleccionado: null, elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 },
    estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] }, generacion: { estado: "no_apto", bloqueos: [], advertencias: [] },
    cambiosSinGuardar: false, candidatoImagenPendiente: false, accionesDisponibles: ["NINGUNA"], participanteActual: { id: "a", nombreVisible: "Ana" },
    conversacionCompartida: [
      { id: "h1", tipoRemitente: "human", participantId: "a", nombreVisibleSnapshot: "Ana", contenido: "Hilo propio", requestId: "uno", replyToMessageId: null, creadoEn: "1" },
      { id: "h2", tipoRemitente: "human", participantId: "b", nombreVisibleSnapshot: "Luis", contenido: "Hilo ajeno secreto", requestId: "dos", replyToMessageId: null, creadoEn: "2" },
      { id: "a1", tipoRemitente: "ai", participantId: null, nombreVisibleSnapshot: null, contenido: "Respuesta propia", requestId: "uno", replyToMessageId: "h1", creadoEn: "3" },
      { id: "a2", tipoRemitente: "ai", participantId: null, nombreVisibleSnapshot: null, contenido: "Respuesta ajena", requestId: "dos", replyToMessageId: "h2", creadoEn: "4" },
    ],
  },
}
const plan = { operacion: "validar_uml", argumentos: {}, respuesta: "Voy a validar." }
const salida = (content: string, extra = {}) => new Response(JSON.stringify({ model: "qwen3:8b", done: true, message: { role: "assistant", content }, ...extra }))

describe("planificador Ollama acotado", () => {
  it.each([
    null, [], { ...plan, operacion: "shell" }, { ...plan, argumentos: { comando: "whoami" } },
    { ...plan, argumentos: { projectId: "otro" } }, { ...plan, argumentos: { revision: 0 } },
    { ...plan, comandos: [] }, { ...plan, respuesta: " " }, { ...plan, respuesta: "a".repeat(2401) },
  ])("rechaza herramientas/argumentos inventados: %j", (valor) => {
    expect(() => validarPlanLocal(valor)).toThrowError(expect.objectContaining({ tipo: "respuesta_invalida" }))
  })

  it("usa /api/chat, esquema estricto, una llamada y únicamente el hilo propio", async () => {
    const fetchLocal = vi.fn<typeof fetch>().mockResolvedValue(salida(JSON.stringify(plan)))
    expect(await new PlanificadorOllama(config, fetchLocal).planificar(solicitud)).toEqual(plan)
    const [url, opciones] = fetchLocal.mock.calls[0]
    expect(url).toBe(`${config.baseUrl}/api/chat`)
    const cuerpo = JSON.parse(opciones!.body as string)
    expect(cuerpo).toMatchObject({ model: "qwen3:8b", stream: false, think: false, format: { additionalProperties: false }, options: { temperature: 0 } })
    expect(cuerpo.messages[1].content).toContain("Hilo propio")
    expect(cuerpo.messages[1].content).toContain("Respuesta propia")
    expect(cuerpo.messages[1].content).not.toContain("ajeno")
    expect(cuerpo.messages[1].content).not.toContain("ajena")
    expect(fetchLocal).toHaveBeenCalledTimes(1)
  })

  it.each(["{", "```json\n{}\n```", JSON.stringify({ ...plan, operacion: "http" })])("rechaza JSON/salida inválida sin reparación ni reintento", async (content) => {
    const local = vi.fn<typeof fetch>().mockResolvedValue(salida(content))
    await expect(new PlanificadorOllama(config, local).planificar(solicitud)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    expect(local).toHaveBeenCalledTimes(1)
  })

  it.each([{ done: false }, { model: "otro" }, { done_reason: "length" }, { message: { role: "assistant", content: JSON.stringify(plan), tool_calls: [{}] } }])("rechaza el sobre incompleto o incorrecto %j", async (extra) => {
    await expect(new PlanificadorOllama(config, vi.fn().mockResolvedValue(salida(JSON.stringify(plan), extra))).planificar(solicitud)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it("acota el cuerpo HTTP", async () => {
    await expect(new PlanificadorOllama(config, vi.fn().mockResolvedValue(new Response("a".repeat(40_000)))).planificar(solicitud)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it.each([404, 500, 503])("aísla proveedor/modelo no disponible HTTP %s", async (status) => {
    await expect(new PlanificadorOllama(config, vi.fn().mockResolvedValue(new Response("error", { status }))).planificar(solicitud)).rejects.toMatchObject({ tipo: "no_disponible" })
  })

  it("aísla conexión rechazada", async () => {
    await expect(new PlanificadorOllama(config, vi.fn().mockRejectedValue(new TypeError("fetch failed"))).planificar(solicitud)).rejects.toMatchObject({ tipo: "no_disponible" })
  })

  it("aborta un proveedor lento sin reintentar", async () => {
    const local = vi.fn<typeof fetch>().mockImplementation(async (_url, opciones) => new Promise((_resolve, reject) => {
      opciones!.signal!.addEventListener("abort", () => reject(new Error("abort")), { once: true })
    }))
    await expect(new PlanificadorOllama({ ...config, timeoutMs: 10 }, local).planificar(solicitud)).rejects.toMatchObject({ tipo: "timeout" })
    expect(local).toHaveBeenCalledTimes(1)
  })

  it.each([[{ models: [{ name: "qwen3:8b" }] }, "disponible"], [{ models: [] }, "modelo_ausente"], [{}, "no_disponible"]])("diagnostica sin inferencia ni descargas %j", async (cuerpo, estado) => {
    const local = vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo)))
    expect(await new PlanificadorOllama(config, local).comprobarEstado()).toBe(estado)
    expect(local.mock.calls[0][0]).toBe(`${config.baseUrl}/api/tags`)
  })

  it("está desactivado por defecto y usa solo la instalación local configurada", () => {
    expect(leerConfiguracionOllama({})).toBeNull()
    expect(leerConfiguracionOllama({ AI_ORCHESTRATOR_MODE: "hybrid_local" })).toEqual({ ...config, timeoutMs: 120_000 })
    for (const env of [{ LOCAL_LLM_BASE_URL: "http://public.example" }, { LOCAL_LLM_BASE_URL: "http://user:secret@localhost:11434" }, { LOCAL_LLM_MODEL: "otro" }, { LOCAL_LLM_TIMEOUT_MS: "NaN" }]) {
      expect(() => leerConfiguracionOllama({ AI_ORCHESTRATOR_MODE: "hybrid_local", ...env })).toThrow()
    }
  })
})
