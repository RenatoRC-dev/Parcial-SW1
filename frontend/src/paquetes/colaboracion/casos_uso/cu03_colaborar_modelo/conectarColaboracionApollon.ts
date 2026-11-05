import {
  ApollonEditor,
  type CollaboratorInfo,
} from "@tumaet/apollon"
import { obtenerUbicacionBackend } from "../../../../configuracion/BackendRemoto"
import { crearIdentidadColaborador, type ParticipanteColaboracionAutenticado } from "./identidadColaborador"

const MAXIMO_REINTENTOS = 2
const DEMORA_RECONEXION_MS = 250

interface EventoCierreSocket { code: number }

interface SocketColaboracion {
  readyState: number
  onopen: (() => void) | null
  onmessage: ((evento: { data: unknown }) => void) | null
  onerror: (() => void) | null
  onclose: ((evento: EventoCierreSocket) => void) | null
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
  projectId: string
  credential: string
  alCambiarEstado: (estado: EstadoConexionColaboracion) => void
  alCambiarParticipantes: (participantes: CollaboratorInfo[]) => void
  alOcurrirError: (mensaje: string) => void
  crearSocket?: CrearSocketColaboracion
  ubicacion?: Pick<Location, "protocol" | "host">
  demoraReconexionMs?: number
}

export type EstadoConexionColaboracion = "conectando" | "conectado" | "desconectado" | "error"

export interface ConexionColaboracion {
  desconectar(): void
}

interface AckAutenticacion {
  type: "authenticated"
  projectId: string
  participant: ParticipanteColaboracionAutenticado
}

function leerAck(valor: unknown, projectId: string): AckAutenticacion | null {
  if (typeof valor !== "string") return null
  try {
    const mensaje: unknown = JSON.parse(valor)
    if (typeof mensaje !== "object" || mensaje === null) return null
    const ack = mensaje as Record<string, unknown>
    if (ack.type !== "authenticated" || ack.projectId !== projectId
      || typeof ack.participant !== "object" || ack.participant === null) return null
    const participante = ack.participant as Record<string, unknown>
    if (typeof participante.id !== "string" || typeof participante.nombreVisible !== "string") return null
    return {
      type: "authenticated",
      projectId,
      participant: { id: participante.id, nombreVisible: participante.nombreVisible },
    }
  } catch {
    return null
  }
}

export function construirUrlColaboracion(
  ubicacion: Pick<Location, "protocol" | "host"> = obtenerUbicacionBackend(),
): string {
  const protocolo = ubicacion.protocol === "https:" ? "wss:" : "ws:"
  return `${protocolo}//${ubicacion.host}/api/colaboracion`
}

export function conectarColaboracionApollon(opciones: OpcionesConexionColaboracion): ConexionColaboracion {
  const { editor, projectId, credential, alCambiarEstado, alCambiarParticipantes, alOcurrirError } = opciones
  const url = construirUrlColaboracion(opciones.ubicacion)
  const crearSocket: CrearSocketColaboracion = opciones.crearSocket
    ?? ((destino: string) => new WebSocket(destino) as unknown as SocketColaboracion)
  let activa = true
  let autenticada = false
  let socket: SocketColaboracion | null = null
  let suscripcion: ReturnType<EditorColaborativo["subscribeToCollaboratorChanges"]> | null = null
  let reintentos = 0
  let temporizadorReconexion: ReturnType<typeof setTimeout> | null = null

  const limpiarEditor = (estado: EstadoConexionColaboracion) => {
    editor.setLocalAwarenessState({ user: undefined })
    editor.sendBroadcastMessage(() => undefined)
    if (suscripcion !== null) editor.unsubscribe(suscripcion)
    suscripcion = null
    alCambiarParticipantes([])
    alCambiarEstado(estado)
  }

  const finalizar = (estado: EstadoConexionColaboracion, cerrarSocket: boolean) => {
    if (!activa) return
    activa = false
    if (temporizadorReconexion) clearTimeout(temporizadorReconexion)
    const actual = socket
    socket = null
    if (actual) {
      actual.onopen = null
      actual.onmessage = null
      actual.onerror = null
      actual.onclose = null
      if (cerrarSocket) actual.close()
    }
    limpiarEditor(estado)
  }

  const fallar = (mensaje: string, cerrarSocket = true) => {
    alOcurrirError(mensaje)
    finalizar("error", cerrarSocket)
  }

  const conectar = () => {
    if (!activa) return
    autenticada = false
    alCambiarEstado("conectando")
    const actual = crearSocket(url)
    socket = actual

    actual.onopen = () => {
      if (!activa || socket !== actual) return
      actual.send(JSON.stringify({ type: "authenticate", projectId, credential }))
    }
    actual.onmessage = (evento) => {
      if (!activa || socket !== actual) return
      if (!autenticada) {
        const ack = leerAck(evento.data, projectId)
        const identidad = ack ? crearIdentidadColaborador(ack.participant) : null
        if (!ack || !identidad) {
          fallar("El servidor rechazó la identidad de colaboración.")
          return
        }
        autenticada = true
        reintentos = 0
        if (suscripcion === null) suscripcion = editor.subscribeToCollaboratorChanges(alCambiarParticipantes)
        editor.setLocalAwarenessUser(identidad)
        alCambiarParticipantes(editor.getCollaborators())
        editor.sendBroadcastMessage((base64) => {
          if (activa && autenticada && socket === actual && actual.readyState === WebSocket.OPEN) actual.send(base64)
        })
        actual.send(ApollonEditor.generateInitialSyncMessage())
        actual.send(ApollonEditor.generateInitialAwarenessSyncMessage())
        editor.broadcastFullState()
        alCambiarEstado("conectado")
        return
      }
      if (typeof evento.data === "string") editor.receiveBroadcastedMessage(evento.data)
    }
    actual.onerror = () => {
      if (activa && socket === actual) alOcurrirError("Se perdió la conexión de colaboración; se intentará recuperar.")
    }
    actual.onclose = (evento) => {
      if (!activa || socket !== actual) return
      socket = null
      autenticada = false
      if (evento.code === 1008 || evento.code === 1009) {
        fallar("No se autorizó el acceso al canal de colaboración.", false)
        return
      }
      if (reintentos >= MAXIMO_REINTENTOS) {
        fallar("No se pudo restablecer la conexión de colaboración.", false)
        return
      }
      const demora = (opciones.demoraReconexionMs ?? DEMORA_RECONEXION_MS) * (2 ** reintentos)
      reintentos += 1
      alCambiarEstado("conectando")
      temporizadorReconexion = setTimeout(conectar, demora)
    }
  }

  conectar()
  return { desconectar: () => finalizar("desconectado", true) }
}
