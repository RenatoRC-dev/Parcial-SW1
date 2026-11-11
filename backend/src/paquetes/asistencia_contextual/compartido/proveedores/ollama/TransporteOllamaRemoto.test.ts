import { EventEmitter } from "node:events"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { direccionRemotaPublica, solicitarOllamaRemoto } from "./TransporteOllamaRemoto.js"

const mocks = vi.hoisted(() => ({ request: vi.fn(), lookup: vi.fn() }))
vi.mock("node:https", () => ({ request: mocks.request }))
vi.mock("node:dns", () => ({ lookup: mocks.lookup }))

describe("transporte HTTPS Ollama sin red real", () => {
  let req: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }
  let res: EventEmitter & { statusCode: number; destroy: ReturnType<typeof vi.fn> }
  beforeEach(() => {
    vi.resetAllMocks()
    req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() })
    req.destroy.mockImplementation((error) => { req.emit("error", error); return req })
    res = Object.assign(new EventEmitter(), { statusCode: 200, destroy: vi.fn() })
    mocks.request.mockReturnValue(req)
  })
  afterEach(() => vi.restoreAllMocks())
  it.each(["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.31.255.255", "192.168.1.1", "192.0.0.1", "198.19.0.1", "224.0.0.1", "255.255.255.255", "::1", "::ffff:127.0.0.1", "fc00::1", "not-an-IP", "999.1.1.1"])("no conecta a direccion insegura %s", ip => {
    expect(direccionRemotaPublica(ip)).toBe(false)
  })
  it("fija resolucion publica al socket, TLS normal y sin agente proxy/redirect", async () => {
    const controller = new AbortController()
    const pending = solicitarOllamaRemoto("https://qwen.example.com/api/chat", { method: "POST", body: "{}", signal: controller.signal, headers: { "CF-Access-Client-Id": "fake", "CF-Access-Client-Secret": "fake-secret" } })
    const [url, opciones, onResponse] = mocks.request.mock.calls[0]
    expect(url.href).toBe("https://qwen.example.com/api/chat")
    expect(opciones).toMatchObject({ agent: false, family: 4, method: "POST", signal: controller.signal })
    expect(opciones.rejectUnauthorized).not.toBe(false)
    const done = vi.fn()
    mocks.lookup.mockImplementation((_host, _options, callback) => callback(null, "104.16.1.1", 4))
    opciones.lookup("qwen.example.com", {}, done)
    expect(done).toHaveBeenCalledWith(null, "104.16.1.1", 4)
    expect(mocks.lookup).toHaveBeenCalledWith("qwen.example.com", { family: 4 }, expect.any(Function))
    onResponse(res); res.emit("data", Buffer.from('{"done":true}')); res.emit("end")
    expect(await (await pending).json()).toEqual({ done: true }); expect(req.end).toHaveBeenCalledWith("{}")
  })
  it.each(["127.0.0.1", "169.254.169.254", "10.0.0.1"])("DNS privado/rebinding se rechaza en lookup real del socket: %s", ip => {
    void solicitarOllamaRemoto("https://qwen.example.com/api/tags")
    mocks.lookup.mockImplementation((_host, _options, callback) => callback(null, ip, 4))
    const callback = vi.fn(); mocks.request.mock.calls[0][1].lookup("qwen.example.com", {}, callback)
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ message: "REMOTE_DNS_REJECTED" }), "", 4)
  })
  it.each([301, 302, 307, 401, 403, 503])("HTTP %s no sigue redirect ni lee cuerpos del proveedor", async status => {
    const pending = solicitarOllamaRemoto("https://qwen.example.com/api/tags")
    res.statusCode = status; mocks.request.mock.calls[0][2](res)
    expect((await pending).status).toBe(status)
    expect(res.destroy).toHaveBeenCalledOnce(); expect(res.listenerCount("data")).toBe(0); expect(mocks.request).toHaveBeenCalledOnce()
  })
  it("limita el cuerpo durante la recepcion, sin confiar en Content-Length", async () => {
    const pending = solicitarOllamaRemoto("https://qwen.example.com/api/chat")
    const check = expect(pending).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    mocks.request.mock.calls[0][2](res); res.emit("data", Buffer.alloc(32769))
    await check; expect(req.destroy).toHaveBeenCalledOnce()
  })
  it("fallos TLS/red/abort no se convierten en respuestas validas", async () => {
    const pending = solicitarOllamaRemoto("https://qwen.example.com/api/chat")
    const check = expect(pending).rejects.toThrow("TLS error")
    req.emit("error", new Error("TLS error")); await check
  })
  it.each(["http://qwen.example.com/api/chat", "https://qwen.example.com/api/pull", "https://qwen.example.com/api/chat?url=other", "https://user:pass@qwen.example.com/api/chat"])("transporte no admite endpoints adicionales %s", async url => {
    await expect(solicitarOllamaRemoto(url)).rejects.toThrow("REMOTE_ENDPOINT_REJECTED")
    expect(mocks.request).not.toHaveBeenCalled()
  })
})
