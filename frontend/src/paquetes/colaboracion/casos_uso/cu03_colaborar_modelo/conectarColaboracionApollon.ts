import {
  ApollonEditor,
  type CollaborationUser,
  type CollaboratorInfo,
} from "@tumaet/apollon"
import { obtenerUbicacionBackend } from "../../../../configuracion/BackendRemoto"

const PATRON_SALA = /^[A-Za-z0-9_-]{1,64}$/

export type EstadoConexionColaboracion = "conectando" | "conectado" | "desconectado" | "error"

interface SocketColaboracion {
  readyState: number
  onopen: (() => void) | null
  onmessage: ((evento: { data: unknown }) => void) | null
  onerror: (() => void) | null
  onclose: (() => void) | null
  send(mensaje: string): void
  close(): void
}

export type CrearSocketColaboracion = (url: string) => SocketColaboracion

export type EditorColaborativo = Pick<
  ApollonEditor,
  | "sendBroadcastMessage"
  | "receiveBroadcastedMessage"
  | "broadcastFullState"
  | "setLocalAwarenessUser"
  | "setLocalAwarenessState"
  | "subscribeToCollaboratorChanges"
  | "getCollaborators"
  | "unsubscribe"
>

export interface OpcionesConexionColaboracion {
  editor: EditorColaborativo
  sala: string
  identidad: CollaborationUser
  alCambiarEstado: (estado: EstadoConexionColaboracion) => void
  alCambiarParticipantes: (participantes: CollaboratorInfo[]) => void
  alOcurrirError: (mensaje: string) => void
  crearSocket?: CrearSocketColaboracion
  ubicacion?: Pick<Location, "protocol" | "host">
}

export interface ConexionColaboracion {
  desconectar(): void
}

export function normalizarSalaColaboracion(sala: string): string | null {
  const normalizada = sala.trim()
  return PATRON_SALA.test(normalizada) ? normalizada : null
}

export function construirUrlColaboracion(
  sala: string,
  ubicacion: Pick<Location, "protocol" | "host"> = obtenerUbicacionBackend(),
): string {
  const salaNormalizada = normalizarSalaColaboracion(sala)
  if (!salaNormalizada) throw new Error("La sala debe tener entre 1 y 64 caracteres: letras, números, guion o guion bajo.")
  const protocolo = ubicacion.protocol === "https:" ? "wss:" : "ws:"
  return `${protocolo}//${ubicacion.host}/api/colaboracion?sala=${encodeURIComponent(salaNormalizada)}`
}

export function conectarColaboracionApollon(opciones: OpcionesConexionColaboracion): ConexionColaboracion {
  const {
    editor,
    identidad,
    alCambiarEstado,
    alCambiarParticipantes,
    alOcurrirError,
  } = opciones
  const url = construirUrlColaboracion(opciones.sala, opciones.ubicacion)
  const crearSocket: CrearSocketColaboracion = opciones.crearSocket
    ?? ((destino: string) => new WebSocket(destino) as unknown as SocketColaboracion)
  const socket: SocketColaboracion = crearSocket(url)
  let activa = true

  const suscripcion = editor.subscribeToCollaboratorChanges(alCambiarParticipantes)
  editor.setLocalAwarenessUser(identidad)
  alCambiarParticipantes(editor.getCollaborators())
  alCambiarEstado("conectando")

  const limpiar = (cerrarSocket: boolean) => {
    if (!activa) return
    editor.setLocalAwarenessState({ user: undefined })
    activa = false
    editor.sendBroadcastMessage(() => undefined)
    editor.unsubscribe(suscripcion)
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (cerrarSocket) socket.close()
    alCambiarParticipantes([])
    alCambiarEstado("desconectado")
  }

  socket.onmessage = (evento) => {
    if (typeof evento.data === "string") editor.receiveBroadcastedMessage(evento.data)
  }
  socket.onerror = () => {
    if (!activa) return
    alCambiarEstado("error")
    alOcurrirError("No se pudo mantener la conexión de colaboración.")
  }
  socket.onclose = () => {
    limpiar(false)
  }
  socket.onopen = () => {
    if (!activa) return
    editor.sendBroadcastMessage((base64) => {
      if (activa && socket.readyState === WebSocket.OPEN) socket.send(base64)
    })
    socket.send(ApollonEditor.generateInitialSyncMessage())
    socket.send(ApollonEditor.generateInitialAwarenessSyncMessage())
    editor.broadcastFullState()
    alCambiarEstado("conectado")
  }

  return {
    desconectar: () => {
      limpiar(true)
    },
  }
}
