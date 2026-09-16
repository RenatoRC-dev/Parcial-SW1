import { ApollonEditor, type CollaboratorInfo } from "@tumaet/apollon"
import { describe, expect, it, vi } from "vitest"
import {
  conectarColaboracionApollon,
  construirUrlColaboracion,
  normalizarSalaColaboracion,
  type EditorColaborativo,
} from "./conectarColaboracionApollon"
import { crearIdentidadColaborador } from "./identidadColaborador"

function crearSocketFalso() {
  return {
    readyState: WebSocket.CONNECTING as number,
    onopen: null as (() => void) | null,
    onmessage: null as ((evento: { data: unknown }) => void) | null,
    onerror: null as (() => void) | null,
    onclose: null as (() => void) | null,
    send: vi.fn(),
    close: vi.fn(),
  }
}

function crearEditorFalso() {
  let salida: ((frame: string) => void) | undefined
  let cambioParticipantes: ((participantes: CollaboratorInfo[]) => void) | undefined
  const editor = {
    sendBroadcastMessage: vi.fn((callback: (frame: string) => void) => { salida = callback }),
    receiveBroadcastedMessage: vi.fn(),
    broadcastFullState: vi.fn(),
    setLocalAwarenessUser: vi.fn(),
    setLocalAwarenessState: vi.fn(),
    subscribeToCollaboratorChanges: vi.fn((callback: (participantes: CollaboratorInfo[]) => void) => {
      cambioParticipantes = callback
      return 17
    }),
    getCollaborators: vi.fn(() => [{ id: "ana", name: "Ana", color: "#2563eb", clientIds: [1], isLocal: true }]),
    unsubscribe: vi.fn(),
  } satisfies EditorColaborativo
  return { editor, obtenerSalida: () => salida, publicarParticipantes: (valor: CollaboratorInfo[]) => cambioParticipantes?.(valor) }
}

describe("conector de colaboración Apollon", () => {
  it("construye la URL WebSocket esperada y valida la sala", () => {
    expect(construirUrlColaboracion(" equipo_01 ", { protocol: "http:", host: "127.0.0.1:4173" }))
      .toBe("ws://127.0.0.1:4173/api/colaboracion?sala=equipo_01")
    expect(normalizarSalaColaboracion("../room")).toBeNull()
    expect(() => construirUrlColaboracion(" ", { protocol: "https:", host: "sw1.test" })).toThrow(/sala/i)
  })

  it("conecta transporte, sincroniza, actualiza presencia y limpia recursos", () => {
    const socket = crearSocketFalso()
    const { editor, obtenerSalida, publicarParticipantes } = crearEditorFalso()
    const estados = vi.fn()
    const participantes = vi.fn()
    const errores = vi.fn()
    const crearSocket = vi.fn(() => socket)
    const conexion = conectarColaboracionApollon({
      editor,
      sala: "parcial-demo",
      identidad: { id: "ana", name: "Ana", color: "#2563eb" },
      alCambiarEstado: estados,
      alCambiarParticipantes: participantes,
      alOcurrirError: errores,
      crearSocket,
      ubicacion: { protocol: "http:", host: "localhost:4173" },
    })

    expect(crearSocket).toHaveBeenCalledWith("ws://localhost:4173/api/colaboracion?sala=parcial-demo")
    expect(editor.setLocalAwarenessUser).toHaveBeenCalledWith({ id: "ana", name: "Ana", color: "#2563eb" })
    expect(estados).toHaveBeenCalledWith("conectando")

    socket.readyState = WebSocket.OPEN
    socket.onopen?.()
    expect(socket.send).toHaveBeenNthCalledWith(1, ApollonEditor.generateInitialSyncMessage())
    expect(socket.send).toHaveBeenNthCalledWith(2, ApollonEditor.generateInitialAwarenessSyncMessage())
    expect(editor.broadcastFullState).toHaveBeenCalledOnce()
    expect(estados).toHaveBeenCalledWith("conectado")

    obtenerSalida()?.("FRAME-SALIENTE")
    expect(socket.send).toHaveBeenCalledWith("FRAME-SALIENTE")
    socket.onmessage?.({ data: "FRAME-ENTRANTE" })
    expect(editor.receiveBroadcastedMessage).toHaveBeenCalledWith("FRAME-ENTRANTE")

    const remotos = [{ id: "bruno", name: "Bruno", color: "#047857", clientIds: [2], isLocal: false }]
    publicarParticipantes(remotos)
    expect(participantes).toHaveBeenCalledWith(remotos)

    conexion.desconectar()
    expect(editor.setLocalAwarenessState).toHaveBeenCalledWith({ user: undefined })
    expect(editor.unsubscribe).toHaveBeenCalledWith(17)
    expect(socket.close).toHaveBeenCalledOnce()
    expect(estados).toHaveBeenLastCalledWith("desconectado")
    expect(errores).not.toHaveBeenCalled()
  })

  it("impide nombre o sala inválidos antes de abrir una conexión", () => {
    expect(crearIdentidadColaborador(" ", "sesion")).toBeNull()
    expect(crearIdentidadColaborador("x".repeat(41), "sesion")).toBeNull()
    expect(crearIdentidadColaborador("Ana", "sesion")).toMatchObject({ name: "Ana", id: "sesion" })
  })

  it("limpia la suscripción cuando el transporte se cierra inesperadamente", () => {
    const socket = crearSocketFalso()
    const { editor } = crearEditorFalso()
    const estados = vi.fn()
    conectarColaboracionApollon({
      editor,
      sala: "sala",
      identidad: { id: "ana", name: "Ana", color: "#2563eb" },
      alCambiarEstado: estados,
      alCambiarParticipantes: vi.fn(),
      alOcurrirError: vi.fn(),
      crearSocket: () => socket,
      ubicacion: { protocol: "http:", host: "localhost" },
    })

    socket.onclose?.()
    expect(editor.unsubscribe).toHaveBeenCalledWith(17)
    expect(socket.close).not.toHaveBeenCalled()
    expect(estados).toHaveBeenLastCalledWith("desconectado")
  })
})
