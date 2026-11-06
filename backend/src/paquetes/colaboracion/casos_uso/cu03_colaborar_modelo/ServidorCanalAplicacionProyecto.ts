import type { IncomingMessage, Server as ServidorHttp } from "node:http"
import type { Duplex } from "node:stream"
import { WebSocket, WebSocketServer, type RawData } from "ws"
import { obtenerOrigenesFrontendPermitidos } from "../../../../configuracion/origenesFrontendPermitidos.js"
import { autenticarAccesoProyecto } from "../../../gestion_proyectos/acceso/autenticarAccesoProyecto.js"
import type { DependenciasRutasProyectos } from "../../../gestion_proyectos/api/registrarRutasProyectos.js"
import type { MensajeProyecto } from "../../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import type { PublicadorMensajesProyecto } from "../../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"

export const RUTA_CANAL_APLICACION = "/api/colaboracion-aplicacion"
const TIEMPO_AUTENTICACION_MS = 5_000
const MAXIMO_AUTENTICACION = 4 * 1024
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface ContextoSocket { projectId: string; participantId: string; displayName: string }

function longitudDatos(datos: RawData): number {
  if (Array.isArray(datos)) return datos.reduce((total, parte) => total + parte.byteLength, 0)
  return datos.byteLength
}

export class ServidorCanalAplicacionProyecto implements PublicadorMensajesProyecto {
  private readonly salas = new Map<string, Set<WebSocket>>()
  private readonly contextos = new Map<WebSocket, ContextoSocket>()
  private readonly conexiones = new Set<WebSocket>()
  private readonly servidorWebSocket = new WebSocketServer({ noServer: true, maxPayload: MAXIMO_AUTENTICACION, perMessageDeflate: false })
  private servidorHttp: ServidorHttp | null = null
  private readonly origenesPermitidos = obtenerOrigenesFrontendPermitidos()

  constructor(private readonly dependencias: DependenciasRutasProyectos) {}

  adjuntar(servidor: ServidorHttp): void {
    this.servidorHttp = servidor
    servidor.on("upgrade", this.alActualizar)
  }

  publicar(mensaje: MensajeProyecto): void {
    const contenido = JSON.stringify({ type: "message_created", message: mensaje })
    for (const socket of this.salas.get(mensaje.projectId) ?? []) {
      if (socket.readyState !== WebSocket.OPEN || !this.contextos.has(socket)) continue
      try { socket.send(contenido) } catch { socket.terminate(); this.retirar(socket) }
    }
  }

  private retirar(socket: WebSocket): void {
    this.conexiones.delete(socket)
    const contexto = this.contextos.get(socket)
    this.contextos.delete(socket)
    if (!contexto) return
    const sala = this.salas.get(contexto.projectId)
    sala?.delete(socket)
    if (sala?.size === 0) this.salas.delete(contexto.projectId)
  }

  private configurar = (socket: WebSocket): void => {
    this.conexiones.add(socket)
    let autenticando = false
    const temporizador = setTimeout(() => {
      if (!this.contextos.has(socket) && socket.readyState === WebSocket.OPEN) socket.close(1008, "Autenticación requerida")
    }, TIEMPO_AUTENTICACION_MS)
    temporizador.unref()
    socket.on("message", async (datos, esBinario) => {
      if (this.contextos.has(socket)) {
        socket.close(1008, "Canal de aplicación de solo recepción")
        return
      }
      if (esBinario || autenticando || longitudDatos(datos) > MAXIMO_AUTENTICACION) { socket.close(1008, "Autenticación inválida"); return }
      let mensaje: Record<string, unknown>
      try { mensaje = JSON.parse(datos.toString()) as Record<string, unknown> } catch { socket.close(1008, "Autenticación inválida"); return }
      if (mensaje.type !== "authenticate" || typeof mensaje.projectId !== "string" || !PATRON_UUID.test(mensaje.projectId) || typeof mensaje.credential !== "string") {
        socket.close(1008, "Autenticación inválida"); return
      }
      autenticando = true
      try {
        const acceso = await autenticarAccesoProyecto(this.dependencias.proyectos, this.dependencias.participantes, this.dependencias.protector, mensaje.projectId, mensaje.credential)
        if (socket.readyState !== WebSocket.OPEN) return
        const contexto = { projectId: acceso.projectId, participantId: acceso.participantId, displayName: acceso.displayName }
        this.contextos.set(socket, contexto)
        const sala = this.salas.get(acceso.projectId) ?? new Set<WebSocket>()
        sala.add(socket); this.salas.set(acceso.projectId, sala)
        clearTimeout(temporizador)
        socket.send(JSON.stringify({ type: "authenticated", projectId: acceso.projectId, participant: { id: acceso.participantId, nombreVisible: acceso.displayName } }))
      } catch { if (socket.readyState === WebSocket.OPEN) socket.close(1008, "Acceso de aplicación denegado") }
      finally { autenticando = false }
    })
    socket.on("close", () => { clearTimeout(temporizador); this.retirar(socket) })
    socket.on("error", () => undefined)
  }

  private alActualizar = (solicitud: IncomingMessage, socket: Duplex, cabecera: Buffer): void => {
    const url = new URL(solicitud.url ?? "", `http://${solicitud.headers.host ?? "localhost"}`)
    if (url.pathname !== RUTA_CANAL_APLICACION) return
    this.servidorWebSocket.handleUpgrade(solicitud, socket, cabecera, (webSocket) => {
      const origen = solicitud.headers.origin
      if (origen && !this.origenesPermitidos.has(origen)) { webSocket.close(1008, "Origen no permitido"); return }
      this.configurar(webSocket)
    })
  }

  async cerrar(): Promise<void> {
    if (this.servidorHttp) this.servidorHttp.off("upgrade", this.alActualizar)
    for (const socket of this.conexiones) socket.terminate()
    this.conexiones.clear(); this.contextos.clear(); this.salas.clear()
    await new Promise<void>((resolver) => this.servidorWebSocket.close(() => resolver()))
  }
}
