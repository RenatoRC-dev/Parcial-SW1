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
const remotoEnv = { AI_ORCHESTRATOR_MODE: "hybrid_remote", REMOTE_LLM_BASE_URL: "https://qwen.example.com", REMOTE_LLM_ALLOWED_HOST: "qwen.example.com", CF_ACCESS_CLIENT_ID: "test-client-identifier.access", CF_ACCESS_CLIENT_SECRET: "test-secret-not-a-real-credential" }
const basicEnv = { AI_ORCHESTRATOR_MODE: "hybrid_remote", LOCAL_LLM_BASE_URL: "https://deduct-demystify-masses.ngrok-free.dev", LOCAL_LLM_BASIC_AUTH_USER: "fake-user", LOCAL_LLM_BASIC_AUTH_PASSWORD: "fake-password" }
const salida = (content: string, extra = {}) => new Response(JSON.stringify({ model: "qwen3:8b", done: true, message: { role: "assistant", content }, ...extra }))

describe("planificador Ollama acotado", () => {
  it("Basic Auth autentica chat y tags usando solo configuracion backend, sin tocar el payload", async () => {
    const remote = vi.fn<typeof fetch>().mockResolvedValueOnce(salida(JSON.stringify(plan))).mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: "qwen3:8b" }] })))
    const proveedor = new PlanificadorOllama(leerConfiguracionOllama(basicEnv)!, remote)
    expect(proveedor.modo).toBe("hybrid_remote")
    expect(await proveedor.planificar(solicitud)).toEqual(plan)
    expect(await proveedor.comprobarEstado()).toBe("disponible")
    expect(remote.mock.calls.map(([url]) => url)).toEqual([`${basicEnv.LOCAL_LLM_BASE_URL}/api/chat`, `${basicEnv.LOCAL_LLM_BASE_URL}/api/tags`])
    const authorization = `Basic ${Buffer.from("fake-user:fake-password").toString("base64")}`
    for (const [url, options] of remote.mock.calls) {
      expect(options).toMatchObject({ redirect: "error", headers: { Authorization: authorization } })
      expect(String(options?.body)).not.toContain(authorization)
      expect(String(url)).not.toContain("fake-user")
      expect(new Headers(options?.headers).has("CF-Access-Client-Id")).toBe(false)
    }
    expect(JSON.parse(remote.mock.calls[0][1]!.body as string).model).toBe("qwen3:8b")
  })
  it.each(["http://remote.example.com", "http://localhost:11434", "https://127.0.0.1", "https://ai.internal", "https://user:password@ai.example.com", "https://ai.example.com/api/chat", "https://ai.example.com?url=other", "https://ai.example.com:8443"])("Basic rechaza configuracion remota insegura %s", url => {
    expect(() => leerConfiguracionOllama({ ...basicEnv, LOCAL_LLM_BASE_URL: url })).toThrow()
  })
  it.each([{ LOCAL_LLM_BASIC_AUTH_USER: "" }, { LOCAL_LLM_BASIC_AUTH_PASSWORD: "" }, { LOCAL_LLM_BASIC_AUTH_USER: "user:name" }, { LOCAL_LLM_BASIC_AUTH_PASSWORD: "pass\r\nHeader: injected" }, { LOCAL_LLM_MODEL: "otro" }, { LOCAL_LLM_TIMEOUT_MS: "120001" }, { LOCAL_LLM_BASIC_AUTH_PASSWORD: undefined }])("Basic incompleto/invalido no usa fallback Cloudflare %j", values => {
    expect(() => leerConfiguracionOllama({ ...remotoEnv, ...basicEnv, ...values })).toThrow()
  })
  it.each([301, 302, 307, 401, 403, 502, 503])("Basic HTTP %s falla sin retry, fallback ni secretos en diagnosticos", async status => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const remote = vi.fn<typeof fetch>().mockResolvedValue(new Response("upstream-private-detail", { status }))
      await expect(new PlanificadorOllama(leerConfiguracionOllama(basicEnv)!, remote).planificar(solicitud)).rejects.toMatchObject({ tipo: "no_disponible" })
      expect(remote).toHaveBeenCalledOnce()
      const logs = JSON.stringify(warn.mock.calls)
      for (const value of [basicEnv.LOCAL_LLM_BASIC_AUTH_USER, basicEnv.LOCAL_LLM_BASIC_AUTH_PASSWORD, Buffer.from("fake-user:fake-password").toString("base64"), "upstream-private-detail"]) expect(logs).not.toContain(value)
      expect(logs).toContain(solicitud.requestId)
    } finally { warn.mockRestore() }
  })
  it("local HTTP ignora credenciales Basic remotas y conserva su configuracion", async () => {
    const local = vi.fn<typeof fetch>().mockResolvedValue(salida(JSON.stringify(plan)))
    const configLocal = leerConfiguracionOllama({ ...basicEnv, AI_ORCHESTRATOR_MODE: "hybrid_local", LOCAL_LLM_BASE_URL: config.baseUrl })!
    expect(configLocal).toEqual({ ...config, timeoutMs: 120000 })
    await new PlanificadorOllama(configLocal, local).planificar(solicitud)
    expect(local.mock.calls[0][1]?.headers).toEqual({ "Content-Type": "application/json" })
  })
  it("remoto autentica chat y tags solo con headers backend y preserva modelo/contrato", async () => {
    const remote = vi.fn<typeof fetch>().mockResolvedValueOnce(salida(JSON.stringify(plan))).mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: "qwen3:8b" }] })))
    const proveedor = new PlanificadorOllama(leerConfiguracionOllama(remotoEnv)!, remote)
    expect(proveedor.modo).toBe("hybrid_remote")
    expect(await proveedor.planificar(solicitud)).toEqual(plan)
    expect(await proveedor.comprobarEstado()).toBe("disponible")
    expect(remote.mock.calls.map(([url]) => url)).toEqual(["https://qwen.example.com/api/chat", "https://qwen.example.com/api/tags"])
    for (const [url, opciones] of remote.mock.calls) {
      expect(opciones).toMatchObject({ redirect: "error", headers: { "CF-Access-Client-Id": remotoEnv.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": remotoEnv.CF_ACCESS_CLIENT_SECRET } })
      expect(String(url)).not.toContain(remotoEnv.CF_ACCESS_CLIENT_SECRET)
      expect(String(opciones?.body)).not.toContain(remotoEnv.CF_ACCESS_CLIENT_SECRET)
    }
  })

  it.each(["http://qwen.example.com", "https://other.example.com", "https://qwen.example.com:8443", "https://user:secret@qwen.example.com", "https://qwen.example.com/api", "https://qwen.example.com?secret=x", "https://qwen.example.com#fragment", "https://qwen.example.com/../", "https://qwen.example.com/"])("remoto rechaza URL no canonica/autorizada %s", (url) => {
    expect(() => leerConfiguracionOllama({ ...remotoEnv, REMOTE_LLM_BASE_URL: url })).toThrow()
  })
  it.each(["127.0.0.1", "169.254.169.254", "2130706433", "[::1]", "localhost", "ai.local", "ai.internal", "ai.trycloudflare.com", "127.0.0.1.nip.io", "*.example.com", "EXAMPLE.COM", "qwen.example.com."])("remoto rechaza host inseguro %s", host => {
    expect(() => leerConfiguracionOllama({ ...remotoEnv, REMOTE_LLM_ALLOWED_HOST: host, REMOTE_LLM_BASE_URL: `https://${host}` })).toThrow()
  })
  it.each([{ CF_ACCESS_CLIENT_ID: "" }, { CF_ACCESS_CLIENT_SECRET: "" }, { CF_ACCESS_CLIENT_SECRET: "test\r\nInjected: header" }, { REMOTE_LLM_MODEL: "otro" }, { REMOTE_LLM_TIMEOUT_MS: "120001" }, { REMOTE_LLM_TIMEOUT_MS: "NaN" }])("remoto exige credenciales/modelo/timeout seguros %j", env => {
    expect(() => leerConfiguracionOllama({ ...remotoEnv, ...env })).toThrow()
  })
  it.each([301, 302, 307, 308, 401, 403, 429, 502, 503, 530])("remoto falla explicitamente sin fallback ni secretos ante HTTP %s", async status => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const remote = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive upstream body", { status }))
      await expect(new PlanificadorOllama(leerConfiguracionOllama(remotoEnv)!, remote).planificar(solicitud)).rejects.toMatchObject({ tipo: "no_disponible" })
      expect(remote).toHaveBeenCalledOnce()
      const logs = JSON.stringify(warn.mock.calls)
      expect(logs).toContain(solicitud.requestId); expect(logs).toContain("remote_https")
      for (const forbidden of [remotoEnv.CF_ACCESS_CLIENT_ID, remotoEnv.CF_ACCESS_CLIENT_SECRET, "sensitive upstream body", solicitud.pregunta]) expect(logs).not.toContain(forbidden)
    } finally { warn.mockRestore() }
  })
  it("remoto rechaza tunel inaccesible sin repetir ni fallback", async () => {
    const remote = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret-bearing network detail"))
    await expect(new PlanificadorOllama(leerConfiguracionOllama(remotoEnv)!, remote).planificar(solicitud)).rejects.toMatchObject({ tipo: "no_disponible" })
    expect(remote).toHaveBeenCalledOnce()
  })
  it.each([null, [], { model: "otro", done: true }, { model: "qwen3:8b", done: false }, { model: "qwen3:8b", done: true, message: { role: "assistant", content: "{}" } }])("remoto conserva validacion estricta del sobre/salida %j", async body => {
    const remote = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body)))
    await expect(new PlanificadorOllama(leerConfiguracionOllama(remotoEnv)!, remote).planificar(solicitud)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    expect(remote).toHaveBeenCalledOnce()
  })
  it("timeout remoto aborta la llamada y no intenta Groq ni otra URL", async () => {
    const remote = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(new Error("Abort")), { once: true })
    }))
    await expect(new PlanificadorOllama({ ...leerConfiguracionOllama(remotoEnv)!, timeoutMs: 10 }, remote).planificar(solicitud)).rejects.toMatchObject({ tipo: "timeout" })
    expect(remote).toHaveBeenCalledOnce()
  })
  it("local ignora tokens remotos; no los envia a loopback", async () => {
    const local = vi.fn<typeof fetch>().mockResolvedValue(salida(JSON.stringify(plan)))
    await new PlanificadorOllama(leerConfiguracionOllama({ ...remotoEnv, AI_ORCHESTRATOR_MODE: "hybrid_local" })!, local).planificar(solicitud)
    expect(local.mock.calls[0][1]?.headers).toEqual({ "Content-Type": "application/json" })
  })
  it("tags tambien acota bytes y rechaza Access HTML", async () => {
    const remote = vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(40000)))
    expect(await new PlanificadorOllama(leerConfiguracionOllama(remotoEnv)!, remote).comprobarEstado()).toBe("no_disponible")
  })
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
