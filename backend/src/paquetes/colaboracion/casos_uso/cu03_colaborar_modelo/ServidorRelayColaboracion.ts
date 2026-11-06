import type { IncomingMessage, Server as ServidorHttp } from "node:http"
import type { Duplex } from "node:stream"
import { WebSocket, WebSocketServer } from "ws"
import { obtenerOrigenesFrontendPermitidos } from "../../../../configuracion/origenesFrontendPermitidos.js"
import { autenticarAccesoProyecto } from "../../../gestion_proyectos/acceso/autenticarAccesoProyecto.js"
import type { DependenciasRutasProyectos } from "../../../gestion_proyectos/api/registrarRutasProyectos.js"
import { obtenerSalaColaboracionProyecto } from "./validarSalaColaboracion.js"
import { RUTA_CANAL_APLICACION } from "./ServidorCanalAplicacionProyecto.js"

const RUTA_COLABORACION = "/api/colaboracion"
const MAXIMO_PAYLOAD = 1024 * 1024
const MAXIMO_AUTENTICACION = 4 * 1024
const TIEMPO_AUTENTICACION_MS = 5_000
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface MensajeAutenticacion {
  type: "authenticate"
  projectId: string
  credential: string
}

interface ContextoSocketAutorizado {
  projectId: string
  participantId: string
  displayName: string
  roomKey: string
}

export interface RelayColaboracion {
  cantidadSalas(): number
  cantidadConexiones(projectId: string): number
  cerrar(): Promise<void>
}

export interface OpcionesRelayColaboracion {
  tiempoAutenticacionMs?: number
  origenesPermitidos?: ReadonlySet<string>
}

function leerAutenticacion(contenido: string): MensajeAutenticacion | null {
  try {
    const valor: unknown = JSON.parse(contenido)
    if (typeof valor !== "object" || valor === null) return null
    const mensaje = valor as Record<string, unknown>
    if (mensaje.type !== "authenticate" || typeof mensaje.projectId !== "string"
      || !PATRON_UUID.test(mensaje.projectId) || typeof mensaje.credential !== "string") return null
    return { type: "authenticate", projectId: mensaje.projectId, credential: mensaje.credential }
  } catch {
    return null
  }
}

export function adjuntarRelayColaboracion(
  servidor: ServidorHttp,
  dependencias: DependenciasRutasProyectos,
  opciones: OpcionesRelayColaboracion = {},
): RelayColaboracion {
  const salas = new Map<string, Set<WebSocket>>()
  const contextos = new Map<WebSocket, ContextoSocketAutorizado>()
  const conexionesAbiertas = new Set<WebSocket>()
  const origenesPermitidos = opciones.origenesPermitidos ?? obtenerOrigenesFrontendPermitidos()
  const servidorWebSocket = new WebSocketServer({ noServer: true, maxPayload: MAXIMO_PAYLOAD, perMessageDeflate: false })

  const retirarConexion = (webSocket: WebSocket) => {
    conexionesAbiertas.delete(webSocket)
    const contexto = contextos.get(webSocket)
    contextos.delete(webSocket)
    if (!contexto) return
    const conexiones = salas.get(contexto.roomKey)
    conexiones?.delete(webSocket)
    if (conexiones?.size === 0) salas.delete(contexto.roomKey)
  }

  const admitirEnSala = (webSocket: WebSocket, contexto: ContextoSocketAutorizado) => {
    const conexiones = salas.get(contexto.roomKey) ?? new Set<WebSocket>()
    conexiones.add(webSocket)
    salas.set(contexto.roomKey, conexiones)
    contextos.set(webSocket, contexto)
  }

  const configurarConexion = (webSocket: WebSocket) => {
    conexionesAbiertas.add(webSocket)
    let autenticando = false
    const temporizador = setTimeout(() => {
      if (!contextos.has(webSocket) && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close(1008, "Autenticación requerida")
      }
    }, opciones.tiempoAutenticacionMs ?? TIEMPO_AUTENTICACION_MS)
    temporizador.unref()

    webSocket.on("message", async (datos, esBinario) => {
      const contexto = contextos.get(webSocket)
      if (!contexto) {
        if (esBinario || autenticando) {
          webSocket.close(1008, "Autenticación inválida")
          return
        }
        const contenido = datos.toString()
        if (Buffer.byteLength(contenido, "utf8") > MAXIMO_AUTENTICACION) {
          webSocket.close(1009, "Autenticación demasiado grande")
          return
        }
        const mensaje = leerAutenticacion(contenido)
        if (!mensaje) {
          webSocket.close(1008, "Autenticación inválida")
          return
        }
        autenticando = true
        try {
          const acceso = await autenticarAccesoProyecto(
            dependencias.proyectos, dependencias.participantes, dependencias.protector,
            mensaje.projectId, mensaje.credential,
          )
          if (webSocket.readyState !== WebSocket.OPEN) return
          const autorizado: ContextoSocketAutorizado = {
            projectId: acceso.projectId,
            participantId: acceso.participantId,
            displayName: acceso.displayName,
            roomKey: obtenerSalaColaboracionProyecto(acceso.projectId),
          }
          clearTimeout(temporizador)
          admitirEnSala(webSocket, autorizado)
          webSocket.send(JSON.stringify({
            type: "authenticated",
            participant: { id: autorizado.participantId, nombreVisible: autorizado.displayName },
            projectId: autorizado.projectId,
          }))
        } catch {
          if (webSocket.readyState === WebSocket.OPEN) webSocket.close(1008, "Acceso de colaboración denegado")
        } finally {
          autenticando = false
        }
        return
      }

      if (esBinario) {
        webSocket.close(1003, "Solo se aceptan mensajes de texto")
        return
      }
      const mensaje = datos.toString()
      const conexiones = salas.get(contexto.roomKey)
      if (!conexiones) return
      for (const destino of conexiones) {
        if (destino === webSocket || destino.readyState !== WebSocket.OPEN || !contextos.has(destino)) continue
        try {
          destino.send(mensaje)
        } catch {
          destino.terminate()
          retirarConexion(destino)
        }
      }
    })

    webSocket.on("close", () => {
      clearTimeout(temporizador)
      retirarConexion(webSocket)
    })
    webSocket.on("error", () => {
      // El evento close completa la limpieza; el error nunca debe derribar el proceso.
    })
  }

  const alActualizar = (solicitud: IncomingMessage, socket: Duplex, cabecera: Buffer) => {
    const url = new URL(solicitud.url ?? "", `http://${solicitud.headers.host ?? "localhost"}`)
    if (url.pathname !== RUTA_COLABORACION) {
      if (url.pathname !== RUTA_CANAL_APLICACION) socket.destroy()
      return
    }
    servidorWebSocket.handleUpgrade(solicitud, socket, cabecera, (webSocket) => {
      const origen = solicitud.headers.origin
      // Los clientes no navegador sin Origin se aceptan deliberadamente; la credencial sigue siendo obligatoria.
      if (origen && !origenesPermitidos.has(origen)) {
        webSocket.close(1008, "Origen no permitido")
        return
      }
      configurarConexion(webSocket)
    })
  }

  servidor.on("upgrade", alActualizar)

  return {
    cantidadSalas: () => salas.size,
    cantidadConexiones: (projectId) => salas.get(obtenerSalaColaboracionProyecto(projectId))?.size ?? 0,
    cerrar: async () => {
      servidor.off("upgrade", alActualizar)
      for (const conexion of conexionesAbiertas) conexion.terminate()
      conexionesAbiertas.clear()
      contextos.clear()
      salas.clear()
      await new Promise<void>((resolver) => servidorWebSocket.close(() => resolver()))
    },
  }
}
