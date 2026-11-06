import { afterEach, describe, expect, it, vi } from "vitest"
import { conectarConversacionColaborativa, construirUrlConversacion } from "./conectarConversacionColaborativa"

class SocketFalso {
  onopen: (() => void) | null = null
  onmessage: ((evento: { data: unknown }) => void) | null = null
  onclose: ((evento: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  enviados: string[] = []
  send(contenido: string) { this.enviados.push(contenido) }
  close() { this.onclose?.({ code: 1000 }) }
}

afterEach(() => vi.useRealTimers())

describe("canal de conversación colaborativa", () => {
  it("construye URL segura sin proyecto ni credencial", () => {
    expect(construirUrlConversacion({ protocol: "https:", host: "api.nexocase.test" })).toBe("wss://api.nexocase.test/api/colaboracion-aplicacion")
  })

  it("autentica por frame y sólo entrega mensajes tras el acuse", () => {
    const socket = new SocketFalso(); const alAutenticar = vi.fn(); const alMensaje = vi.fn()
    const conexion = conectarConversacionColaborativa({ projectId: "p", credential: "secreto", alAutenticar, alMensaje, alError: vi.fn(), crearSocket: () => socket })
    socket.onopen?.()
    expect(JSON.parse(socket.enviados[0])).toEqual({ type: "authenticate", projectId: "p", credential: "secreto" })
    socket.onmessage?.({ data: JSON.stringify({ type: "message_created", message: { id: "prematuro" } }) }); expect(alMensaje).not.toHaveBeenCalled()
    socket.onmessage?.({ data: JSON.stringify({ type: "authenticated", projectId: "p" }) }); expect(alAutenticar).toHaveBeenCalledOnce()
    socket.onmessage?.({ data: JSON.stringify({ type: "message_created", message: { id: "m1" } }) }); expect(alMensaje).toHaveBeenCalledWith({ id: "m1" })
    conexion.desconectar()
  })

  it("reconecta cierres transitorios y no reintenta una denegación 1008", () => {
    vi.useFakeTimers()
    const sockets: SocketFalso[] = []; const alError = vi.fn()
    conectarConversacionColaborativa({ projectId: "p", credential: "c", alAutenticar: vi.fn(), alMensaje: vi.fn(), alError,
      demoraReconexionMs: 10, crearSocket: () => { const socket = new SocketFalso(); sockets.push(socket); return socket } })
    sockets[0].onclose?.({ code: 1006 }); vi.advanceTimersByTime(10); expect(sockets).toHaveLength(2)
    sockets[1].onclose?.({ code: 1008 }); vi.advanceTimersByTime(100); expect(sockets).toHaveLength(2)
    expect(alError).toHaveBeenCalledOnce()
  })
})
