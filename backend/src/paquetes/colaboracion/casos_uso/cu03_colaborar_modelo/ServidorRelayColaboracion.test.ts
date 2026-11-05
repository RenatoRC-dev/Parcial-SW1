import { once } from "node:events"
import { createServer, type Server } from "node:http"
import WebSocket from "ws"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import type { RepositorioProyectos } from "../../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { ProyectoPersistido } from "../../../gestion_proyectos/compartido/ProyectoPersistido.js"
import { RepositorioParticipantesMemoria } from "../../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { adjuntarRelayColaboracion, type RelayColaboracion } from "./ServidorRelayColaboracion.js"
import { obtenerSalaColaboracionProyecto } from "./validarSalaColaboracion.js"

const PROYECTO_A = "11111111-1111-4111-8111-111111111111"
const PROYECTO_B = "22222222-2222-4222-8222-222222222222"
const CREDENCIAL_A = "A".repeat(43)
const CREDENCIAL_A2 = "B".repeat(43)
const CREDENCIAL_B = "C".repeat(43)

let servidor: Server | null = null
let relay: RelayColaboracion | null = null
const conexiones: WebSocket[] = []

function proyecto(id: string, nombre: string): ProyectoPersistido {
  return {
    id, nombre, creadoEn: "2026-11-05T00:00:00.000Z", actualizadoEn: "2026-11-05T00:00:00.000Z",
    revisionModelo: 0, modelo: { id: `modelo-${id}`, nombre, version: "4.2.0", clases: [], relaciones: [] },
  }
}

async function iniciar(tiempoAutenticacionMs = 5_000): Promise<number> {
  const protector = new ProtegerAccesoProyecto("pepper-relay-pruebas")
  const proyectos = new Map([[PROYECTO_A, proyecto(PROYECTO_A, "A")], [PROYECTO_B, proyecto(PROYECTO_B, "B")]])
  const repositorioProyectos: RepositorioProyectos = {
    listar: async () => [...proyectos.values()],
    crear: async (valor) => valor,
    obtenerPorId: async (id) => proyectos.get(id) ?? null,
    buscarPorCodigoAccesoDigest: async () => null,
    eliminar: async (id) => { proyectos.delete(id) },
    guardarModeloConRevision: async () => { throw new Error("No usado") },
  }
  const participantes = new RepositorioParticipantesMemoria()
  for (const [id, proyectoId, nombre, credencial] of [
    ["participante-a", PROYECTO_A, "Renato", CREDENCIAL_A],
    ["participante-a2", PROYECTO_A, "Carlos", CREDENCIAL_A2],
    ["participante-b", PROYECTO_B, "Ana", CREDENCIAL_B],
  ]) {
    await participantes.crear({
      id, proyectoId, nombreVisible: nombre, nombreNormalizado: nombre.toLowerCase(),
      credencialDigest: protector.obtenerDigestCredencial(credencial),
      creadoEn: "2026-11-05T00:00:00.000Z", ultimoAccesoEn: "2026-11-05T00:00:00.000Z",
    })
  }
  servidor = createServer()
  relay = adjuntarRelayColaboracion(
    servidor,
    { proyectos: repositorioProyectos, participantes, protector },
    { tiempoAutenticacionMs, origenesPermitidos: new Set(["https://frontend.test"]) },
  )
  servidor.listen(0, "127.0.0.1")
  await once(servidor, "listening")
  const direccion = servidor.address()
  if (!direccion || typeof direccion === "string") throw new Error("Puerto de prueba no disponible")
  return direccion.port
}

async function conectar(puerto: number, origen?: string): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${puerto}/api/colaboracion`, origen ? { origin: origen } : undefined)
  conexiones.push(socket)
  await once(socket, "open")
  return socket
}

async function autenticar(socket: WebSocket, projectId: string, credential: string) {
  const recibido = once(socket, "message")
  socket.send(JSON.stringify({ type: "authenticate", projectId, credential }))
  const [dato] = await recibido
  return JSON.parse(dato.toString()) as Record<string, unknown>
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

describe("relay autorizado de colaboración CU03", () => {
  it("deriva la sala exclusivamente del proyecto autorizado", () => {
    expect(obtenerSalaColaboracionProyecto(PROYECTO_A)).toBe(`proyecto-${PROYECTO_A}`)
  })

  it("cierra por timeout al socket que no se autentica", async () => {
    const socket = await conectar(await iniciar(30))
    const [codigo] = await once(socket, "close")
    expect(codigo).toBe(1008)
    expect(relay?.cantidadSalas()).toBe(0)
  })

  it.each([
    ["Yjs prematuro", "AQIDBA=="],
    ["JSON malformado", "{"],
    ["tipo incorrecto", JSON.stringify({ type: "otro" })],
    ["credencial ausente", JSON.stringify({ type: "authenticate", projectId: PROYECTO_A })],
  ])("rechaza %s antes de autenticar", async (_caso, frame) => {
    const socket = await conectar(await iniciar())
    socket.send(frame)
    const [codigo] = await once(socket, "close")
    expect(codigo).toBe(1008)
    expect(relay?.cantidadSalas()).toBe(0)
  })

  it("rechaza credencial inválida y credencial de otro proyecto sin registrar secretos", async () => {
    const puerto = await iniciar()
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined)
    for (const [projectId, credential] of [[PROYECTO_A, "Z".repeat(43)], [PROYECTO_B, CREDENCIAL_A]]) {
      const socket = await conectar(puerto)
      socket.send(JSON.stringify({ type: "authenticate", projectId, credential }))
      const [codigo, razon] = await once(socket, "close")
      expect(codigo).toBe(1008)
      expect(razon.toString()).not.toContain(credential)
    }
    expect(espia).not.toHaveBeenCalled()
    expect(relay?.cantidadSalas()).toBe(0)
  })

  it("autentica y devuelve identidad durable del backend sin eco de credencial", async () => {
    const socket = await conectar(await iniciar())
    const ack = await autenticar(socket, PROYECTO_A, CREDENCIAL_A)
    expect(ack).toEqual({
      type: "authenticated", projectId: PROYECTO_A,
      participant: { id: "participante-a", nombreVisible: "Renato" },
    })
    expect(JSON.stringify(ack)).not.toContain(CREDENCIAL_A)
    expect(relay?.cantidadConexiones(PROYECTO_A)).toBe(1)
  })

  it("retransmite frames raw sólo entre sockets autenticados del mismo proyecto", async () => {
    const puerto = await iniciar()
    const emisor = await conectar(puerto)
    const receptor = await conectar(puerto)
    const aislado = await conectar(puerto)
    await autenticar(emisor, PROYECTO_A, CREDENCIAL_A)
    await autenticar(receptor, PROYECTO_A, CREDENCIAL_A2)
    await autenticar(aislado, PROYECTO_B, CREDENCIAL_B)
    const recibidosAislado: string[] = []
    aislado.on("message", (dato) => recibidosAislado.push(dato.toString()))

    const recibido = once(receptor, "message")
    emisor.send("AQIDBA==")
    expect((await recibido)[0].toString()).toBe("AQIDBA==")
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(recibidosAislado).toEqual([])
    expect(relay?.cantidadConexiones(PROYECTO_A)).toBe(2)
    expect(relay?.cantidadConexiones(PROYECTO_B)).toBe(1)
  })

  it("elimina conexiones cerradas y la sala al salir el último participante", async () => {
    const socket = await conectar(await iniciar())
    await autenticar(socket, PROYECTO_A, CREDENCIAL_A)
    socket.close()
    await once(socket, "close")
    await esperarCondicion(() => relay?.cantidadSalas() === 0)
    expect(relay?.cantidadConexiones(PROYECTO_A)).toBe(0)
  })

  it("acepta Origin permitido, rechaza Origin navegador ajeno y admite cliente sin Origin", async () => {
    const puerto = await iniciar()
    const permitido = await conectar(puerto, "https://frontend.test")
    expect((await autenticar(permitido, PROYECTO_A, CREDENCIAL_A)).type).toBe("authenticated")
    const sinOrigen = await conectar(puerto)
    expect((await autenticar(sinOrigen, PROYECTO_A, CREDENCIAL_A2)).type).toBe("authenticated")
    const rechazado = await conectar(puerto, "https://malicioso.test")
    const [codigo] = await once(rechazado, "close")
    expect(codigo).toBe(1008)
  })

  it("cierra con 1009 una autenticación que excede el límite pequeño", async () => {
    const socket = await conectar(await iniciar())
    socket.send("x".repeat(4 * 1024 + 1))
    const [codigo] = await once(socket, "close")
    expect(codigo).toBe(1009)
  })

  it("mantiene el límite global de 1 MiB después de autenticar", async () => {
    const socket = await conectar(await iniciar())
    await autenticar(socket, PROYECTO_A, CREDENCIAL_A)
    socket.send("x".repeat(1024 * 1024 + 1))
    const [codigo] = await once(socket, "close")
    expect(codigo).toBe(1009)
  })
})
