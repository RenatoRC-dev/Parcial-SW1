import { createServer, type Server } from "node:http"
import { once } from "node:events"
import WebSocket from "ws"
import { afterEach, describe, expect, it } from "vitest"
import { adjuntarRelayColaboracion, type RelayColaboracion } from "./ServidorRelayColaboracion.js"
import { normalizarSalaColaboracion } from "./validarSalaColaboracion.js"

let servidor: Server | null = null
let relay: RelayColaboracion | null = null
const conexiones: WebSocket[] = []

async function iniciar(): Promise<number> {
  servidor = createServer()
  relay = adjuntarRelayColaboracion(servidor)
  servidor.listen(0, "127.0.0.1")
  await once(servidor, "listening")
  const direccion = servidor.address()
  if (!direccion || typeof direccion === "string") throw new Error("Puerto de prueba no disponible")
  return direccion.port
}

async function conectar(puerto: number, sala: string): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${puerto}/api/colaboracion?sala=${encodeURIComponent(sala)}`)
  conexiones.push(socket)
  await once(socket, "open")
  return socket
}

async function esperarCondicion(condicion: () => boolean): Promise<void> {
  for (let intento = 0; intento < 50; intento += 1) {
    if (condicion()) return
    await new Promise((resolver) => setTimeout(resolver, 10))
  }
  throw new Error("La condición esperada no se cumplió")
}

afterEach(async () => {
  for (const conexion of conexiones.splice(0)) conexion.terminate()
  if (relay) await relay.cerrar()
  if (servidor?.listening) await new Promise<void>((resolver) => servidor!.close(() => resolver()))
  relay = null
  servidor = null
})

describe("relay de colaboración CU03", () => {
  it("valida identificadores de sala pequeños y deterministas", () => {
    expect(normalizarSalaColaboracion(" equipo_01 ")).toBe("equipo_01")
    expect(normalizarSalaColaboracion("../room")).toBeNull()
    expect(normalizarSalaColaboracion(" ")).toBeNull()
    expect(normalizarSalaColaboracion("x".repeat(65))).toBeNull()
  })

  it("acepta una sala válida y rechaza una inválida", async () => {
    const puerto = await iniciar()
    const valida = await conectar(puerto, "parcial-demo")
    expect(valida.readyState).toBe(WebSocket.OPEN)
    expect(relay?.cantidadConexiones("parcial-demo")).toBe(1)

    const invalida = new WebSocket(`ws://127.0.0.1:${puerto}/api/colaboracion?sala=..%2Froom`)
    conexiones.push(invalida)
    const [codigo] = await once(invalida, "close")
    expect(codigo).toBe(1008)
  })

  it("reenvía el frame sin modificar solo a otros clientes de la misma sala", async () => {
    const puerto = await iniciar()
    const emisor = await conectar(puerto, "sala-compartida")
    const receptor = await conectar(puerto, "sala-compartida")
    const aislado = await conectar(puerto, "otra-sala")
    const recibidosEmisor: string[] = []
    const recibidosAislado: string[] = []
    emisor.on("message", (dato) => recibidosEmisor.push(dato.toString()))
    aislado.on("message", (dato) => recibidosAislado.push(dato.toString()))

    const recibido = once(receptor, "message")
    const frame = "AQIDBA=="
    emisor.send(frame)
    const [dato] = await recibido

    expect(dato.toString()).toBe(frame)
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(recibidosEmisor).toEqual([])
    expect(recibidosAislado).toEqual([])
  })

  it("elimina conexiones cerradas y salas vacías", async () => {
    const puerto = await iniciar()
    const socket = await conectar(puerto, "sala-efimera")
    expect(relay?.cantidadSalas()).toBe(1)
    socket.close()
    await once(socket, "close")
    await esperarCondicion(() => relay?.cantidadSalas() === 0)
    expect(relay?.cantidadConexiones("sala-efimera")).toBe(0)
  })
})
