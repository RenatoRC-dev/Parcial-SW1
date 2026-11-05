import { ApollonEditor, type CollaboratorInfo } from "@tumaet/apollon"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  conectarColaboracionApollon,
  construirUrlColaboracion,
  type EditorColaborativo,
} from "./conectarColaboracionApollon"
import { crearIdentidadColaborador } from "./identidadColaborador"

const PROJECT_ID = "11111111-1111-4111-8111-111111111111"
const CREDENTIAL = "A".repeat(43)

function crearSocketFalso() {
  return {
    readyState: WebSocket.CONNECTING as number,
    onopen: null as (() => void) | null,
    onmessage: null as ((evento: { data: unknown }) => void) | null,
    onerror: null as (() => void) | null,
    onclose: null as ((evento: { code: number }) => void) | null,
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
    getCollaborators: vi.fn(() => [{ id: "participante-backend", name: "Renato", color: "#2563eb", clientIds: [1], isLocal: true }]),
    unsubscribe: vi.fn(),
  } satisfies EditorColaborativo
  return { editor, obtenerSalida: () => salida, publicarParticipantes: (valor: CollaboratorInfo[]) => cambioParticipantes?.(valor) }
}

const ack = JSON.stringify({
  type: "authenticated",
  projectId: PROJECT_ID,
  participant: { id: "participante-backend", nombreVisible: "Renato" },
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("conector autorizado de colaboración Apollon", () => {
  it("construye URL sin sala ni credencial y deriva WSS del backend remoto", () => {
    expect(construirUrlColaboracion({ protocol: "http:", host: "127.0.0.1:4173" }))
      .toBe("ws://127.0.0.1:4173/api/colaboracion")
    vi.stubEnv("VITE_API_BASE_URL", "https://nexocase-backend.onrender.com")
    expect(construirUrlColaboracion()).toBe("wss://nexocase-backend.onrender.com/api/colaboracion")
    expect(construirUrlColaboracion()).not.toContain(CREDENTIAL)
  })

  it("autentica primero, espera ACK y recién entonces conecta el protocolo raw de Apollon", () => {
    const socket = crearSocketFalso()
    const { editor, obtenerSalida, publicarParticipantes } = crearEditorFalso()
    const estados = vi.fn()
    const participantes = vi.fn()
    const errores = vi.fn()
    const crearSocket = vi.fn(() => socket)
    const conexion = conectarColaboracionApollon({
      editor, projectId: PROJECT_ID, credential: CREDENTIAL,
      alCambiarEstado: estados, alCambiarParticipantes: participantes, alOcurrirError: errores,
      crearSocket, ubicacion: { protocol: "http:", host: "localhost:4173" },
    })

    expect(crearSocket).toHaveBeenCalledWith("ws://localhost:4173/api/colaboracion")
    expect(editor.setLocalAwarenessUser).not.toHaveBeenCalled()
    expect(obtenerSalida()).toBeUndefined()
    socket.readyState = WebSocket.OPEN
    socket.onopen?.()
    expect(socket.send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(socket.send.mock.calls[0]![0])).toEqual({ type: "authenticate", projectId: PROJECT_ID, credential: CREDENTIAL })
    expect(editor.broadcastFullState).not.toHaveBeenCalled()

    socket.onmessage?.({ data: ack })
    expect(editor.receiveBroadcastedMessage).not.toHaveBeenCalled()
    expect(editor.setLocalAwarenessUser).toHaveBeenCalledWith(expect.objectContaining({ id: "participante-backend", name: "Renato" }))
    expect(socket.send).toHaveBeenNthCalledWith(2, ApollonEditor.generateInitialSyncMessage())
    expect(socket.send).toHaveBeenNthCalledWith(3, ApollonEditor.generateInitialAwarenessSyncMessage())
    expect(editor.broadcastFullState).toHaveBeenCalledOnce()
    expect(estados).toHaveBeenCalledWith("conectado")

    obtenerSalida()?.("FRAME-SALIENTE")
    expect(socket.send).toHaveBeenLastCalledWith("FRAME-SALIENTE")
    socket.onmessage?.({ data: "FRAME-ENTRANTE" })
    expect(editor.receiveBroadcastedMessage).toHaveBeenCalledWith("FRAME-ENTRANTE")
    const remotos = [{ id: "carlos", name: "Carlos", color: "#047857", clientIds: [2], isLocal: false }]
    publicarParticipantes(remotos)
    expect(participantes).toHaveBeenCalledWith(remotos)

    conexion.desconectar()
    expect(editor.setLocalAwarenessState).toHaveBeenCalledWith({ user: undefined })
    expect(editor.unsubscribe).toHaveBeenCalledWith(17)
    expect(socket.close).toHaveBeenCalledOnce()
    expect(estados).toHaveBeenLastCalledWith("desconectado")
    expect(errores).not.toHaveBeenCalled()
  })

  it("rechaza ACK inválido con error controlado y nunca lo entrega a Apollon", () => {
    const socket = crearSocketFalso()
    const { editor } = crearEditorFalso()
    const errores = vi.fn()
    const estados = vi.fn()
    conectarColaboracionApollon({
      editor, projectId: PROJECT_ID, credential: CREDENTIAL,
      alCambiarEstado: estados, alCambiarParticipantes: vi.fn(), alOcurrirError: errores,
      crearSocket: () => socket, ubicacion: { protocol: "http:", host: "localhost" },
    })
    socket.onmessage?.({ data: JSON.stringify({ type: "authenticated", projectId: "otro", participant: {} }) })
    expect(errores).toHaveBeenCalledWith("El servidor rechazó la identidad de colaboración.")
    expect(estados).toHaveBeenLastCalledWith("error")
    expect(editor.receiveBroadcastedMessage).not.toHaveBeenCalled()
    expect(editor.setLocalAwarenessUser).not.toHaveBeenCalled()
    expect(socket.close).toHaveBeenCalledOnce()
  })

  it("usa exclusivamente participantId y nombre del ACK con color estable", () => {
    const primera = crearIdentidadColaborador({ id: "id-backend", nombreVisible: "Ana" })
    const segunda = crearIdentidadColaborador({ id: "id-backend", nombreVisible: "Nombre visual actualizado" })
    expect(primera).toMatchObject({ id: "id-backend", name: "Ana" })
    expect(segunda?.color).toBe(primera?.color)
    expect(crearIdentidadColaborador({ id: "", nombreVisible: "Ana" })).toBeNull()
    expect(crearIdentidadColaborador({ id: "id", nombreVisible: " " })).toBeNull()
  })

  it("reconecta de forma acotada y vuelve a autenticar la misma identidad", async () => {
    vi.useFakeTimers()
    const primero = crearSocketFalso()
    const segundo = crearSocketFalso()
    const sockets = [primero, segundo]
    const { editor } = crearEditorFalso()
    conectarColaboracionApollon({
      editor, projectId: PROJECT_ID, credential: CREDENTIAL,
      alCambiarEstado: vi.fn(), alCambiarParticipantes: vi.fn(), alOcurrirError: vi.fn(),
      crearSocket: () => sockets.shift()!, ubicacion: { protocol: "http:", host: "localhost" }, demoraReconexionMs: 10,
    })
    primero.readyState = WebSocket.OPEN
    primero.onopen?.()
    primero.onmessage?.({ data: ack })
    primero.onclose?.({ code: 1006 })
    await vi.advanceTimersByTimeAsync(10)
    segundo.readyState = WebSocket.OPEN
    segundo.onopen?.()
    expect(JSON.parse(segundo.send.mock.calls[0]![0])).toEqual({ type: "authenticate", projectId: PROJECT_ID, credential: CREDENTIAL })
    segundo.onmessage?.({ data: ack })
    expect(editor.setLocalAwarenessUser).toHaveBeenLastCalledWith(expect.objectContaining({ id: "participante-backend", name: "Renato" }))
  })

  it("un cierre 1008 no cae a identidad anónima ni inicia reconexión", async () => {
    vi.useFakeTimers()
    const socket = crearSocketFalso()
    const crearSocket = vi.fn(() => socket)
    const { editor } = crearEditorFalso()
    const errores = vi.fn()
    conectarColaboracionApollon({
      editor, projectId: PROJECT_ID, credential: CREDENTIAL,
      alCambiarEstado: vi.fn(), alCambiarParticipantes: vi.fn(), alOcurrirError: errores,
      crearSocket, ubicacion: { protocol: "http:", host: "localhost" }, demoraReconexionMs: 1,
    })
    socket.onclose?.({ code: 1008 })
    await vi.runAllTimersAsync()
    expect(crearSocket).toHaveBeenCalledTimes(1)
    expect(editor.setLocalAwarenessUser).not.toHaveBeenCalled()
    expect(errores).toHaveBeenCalledWith("No se autorizó el acceso al canal de colaboración.")
  })
})
