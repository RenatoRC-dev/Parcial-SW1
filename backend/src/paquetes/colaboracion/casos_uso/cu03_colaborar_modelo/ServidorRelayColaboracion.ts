import type { IncomingMessage, Server as ServidorHttp } from "node:http"
import type { Duplex } from "node:stream"
import { WebSocket, WebSocketServer } from "ws"
import { normalizarSalaColaboracion } from "./validarSalaColaboracion.js"

const RUTA_COLABORACION = "/api/colaboracion"
const MAXIMO_PAYLOAD = 1024 * 1024

export interface RelayColaboracion {
  cantidadSalas(): number
  cantidadConexiones(sala: string): number
  cerrar(): Promise<void>
}

export function adjuntarRelayColaboracion(servidor: ServidorHttp): RelayColaboracion {
  const salas = new Map<string, Set<WebSocket>>()
  const servidorWebSocket = new WebSocketServer({
    noServer: true,
    maxPayload: MAXIMO_PAYLOAD,
    perMessageDeflate: false,
  })

  const configurarConexion = (webSocket: WebSocket, sala: string) => {
    const conexiones = salas.get(sala) ?? new Set<WebSocket>()
    conexiones.add(webSocket)
    salas.set(sala, conexiones)

    webSocket.on("message", (datos, esBinario) => {
      if (esBinario) {
        webSocket.close(1003, "Solo se aceptan mensajes de texto")
        return
      }
      const mensaje = datos.toString()
      for (const destino of conexiones) {
        if (destino !== webSocket && destino.readyState === WebSocket.OPEN) {
          destino.send(mensaje)
        }
      }
    })

    webSocket.on("close", () => {
      conexiones.delete(webSocket)
      if (conexiones.size === 0) salas.delete(sala)
    })
  }

  const alActualizar = (solicitud: IncomingMessage, socket: Duplex, cabecera: Buffer) => {
    const url = new URL(solicitud.url ?? "", `http://${solicitud.headers.host ?? "localhost"}`)
    if (url.pathname !== RUTA_COLABORACION) {
      socket.destroy()
      return
    }

    const sala = normalizarSalaColaboracion(url.searchParams.get("sala"))
    servidorWebSocket.handleUpgrade(solicitud, socket, cabecera, (webSocket) => {
      if (!sala) {
        webSocket.close(1008, "Sala inválida")
        return
      }
      configurarConexion(webSocket, sala)
    })
  }

  servidor.on("upgrade", alActualizar)

  return {
    cantidadSalas: () => salas.size,
    cantidadConexiones: (sala) => salas.get(sala)?.size ?? 0,
    cerrar: async () => {
      servidor.off("upgrade", alActualizar)
      for (const conexiones of salas.values()) {
        for (const conexion of conexiones) conexion.terminate()
      }
      salas.clear()
      await new Promise<void>((resolver) => servidorWebSocket.close(() => resolver()))
    },
  }
}
