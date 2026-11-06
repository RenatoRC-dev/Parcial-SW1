import { obtenerUbicacionBackend } from "../../../../configuracion/BackendRemoto"
import type { MensajeColaborativo } from "./consultarAsistenteContextual"

interface SocketAplicacion {
  onopen: (() => void) | null
  onmessage: ((evento: { data: unknown }) => void) | null
  onclose: ((evento: { code: number }) => void) | null
  onerror: (() => void) | null
  send(contenido: string): void
  close(): void
}

export function construirUrlConversacion(ubicacion: Pick<Location, "protocol" | "host"> = obtenerUbicacionBackend()): string {
  return `${ubicacion.protocol === "https:" ? "wss:" : "ws:"}//${ubicacion.host}/api/colaboracion-aplicacion`
}

export function conectarConversacionColaborativa(opciones: {
  projectId: string
  credential: string
  alAutenticar: () => void
  alMensaje: (mensaje: MensajeColaborativo) => void
  alError: (mensaje: string) => void
  crearSocket?: (url: string) => SocketAplicacion
  demoraReconexionMs?: number
}): { desconectar(): void } {
  let activa = true
  let socket: SocketAplicacion | null = null
  let reintento: ReturnType<typeof setTimeout> | null = null
  let intentos = 0
  const crear = opciones.crearSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketAplicacion)
  const conectar = () => {
    if (!activa) return
    let autenticada = false
    const actual = crear(construirUrlConversacion())
    socket = actual
    actual.onopen = () => actual.send(JSON.stringify({ type: "authenticate", projectId: opciones.projectId, credential: opciones.credential }))
    actual.onmessage = (evento) => {
      if (typeof evento.data !== "string") return
      try {
        const mensaje = JSON.parse(evento.data) as Record<string, unknown>
        if (!autenticada && mensaje.type === "authenticated" && mensaje.projectId === opciones.projectId) {
          autenticada = true; intentos = 0; opciones.alAutenticar(); return
        }
        if (autenticada && mensaje.type === "message_created" && typeof mensaje.message === "object" && mensaje.message !== null) opciones.alMensaje(mensaje.message as MensajeColaborativo)
      } catch { opciones.alError("El canal colaborativo recibió un mensaje inválido.") }
    }
    actual.onerror = () => undefined
    actual.onclose = (evento) => {
      if (!activa || socket !== actual) return
      socket = null
      if (evento.code === 1008 || intentos >= 5) { opciones.alError("No se pudo autorizar o recuperar la conversación compartida."); return }
      const demora = Math.min((opciones.demoraReconexionMs ?? 300) * (2 ** intentos++), 5_000)
      reintento = setTimeout(conectar, demora)
    }
  }
  conectar()
  return { desconectar: () => { activa = false; if (reintento) clearTimeout(reintento); socket?.close(); socket = null } }
}
