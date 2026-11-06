import { once } from "node:events"
import { createServer, type Server } from "node:http"
import WebSocket from "ws"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import type { RepositorioProyectos } from "../../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { ProyectoPersistido } from "../../../gestion_proyectos/compartido/ProyectoPersistido.js"
import { RepositorioParticipantesMemoria } from "../../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import type { MensajeProyecto } from "../../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import { ServidorCanalAplicacionProyecto } from "./ServidorCanalAplicacionProyecto.js"

const PROYECTO_A = "11111111-1111-4111-8111-111111111111"
const PROYECTO_B = "22222222-2222-4222-8222-222222222222"
const CREDENCIAL_A = "A".repeat(43)
const CREDENCIAL_B = "B".repeat(43)

function proyecto(id: string): ProyectoPersistido {
  return { id, nombre: id === PROYECTO_A ? "A" : "B", creadoEn: "2026-11-05T00:00:00.000Z", actualizadoEn: "2026-11-05T00:00:00.000Z",
    revisionModelo: 0, modelo: { id: `modelo-${id}`, nombre: "Modelo", version: "4.2.0", clases: [], relaciones: [] } }
}

describe("canal WebSocket de aplicación", () => {
  let servidor: Server
  let canal: ServidorCanalAplicacionProyecto
  let puerto: number
  const conexiones: WebSocket[] = []

  beforeEach(async () => {
    const protector = new ProtegerAccesoProyecto("pepper-canal-aplicacion")
    const proyectos = new Map([[PROYECTO_A, proyecto(PROYECTO_A)], [PROYECTO_B, proyecto(PROYECTO_B)]])
    const repositorio: RepositorioProyectos = {
      listar: async () => [...proyectos.values()], crear: async (valor) => valor, obtenerPorId: async (id) => proyectos.get(id) ?? null,
      buscarPorCodigoAccesoDigest: async () => null, eliminar: async () => undefined, guardarModeloConRevision: async () => { throw new Error("No usado") },
    }
    const participantes = new RepositorioParticipantesMemoria()
    for (const [id, projectId, nombre, credential] of [["pa", PROYECTO_A, "Renato", CREDENCIAL_A], ["pb", PROYECTO_B, "Ana", CREDENCIAL_B]]) {
      await participantes.crear({ id, proyectoId: projectId, nombreVisible: nombre, nombreNormalizado: nombre.toLowerCase(),
        credencialDigest: protector.obtenerDigestCredencial(credential), creadoEn: "2026-11-05T00:00:00.000Z", ultimoAccesoEn: "2026-11-05T00:00:00.000Z" })
    }
    servidor = createServer()
    canal = new ServidorCanalAplicacionProyecto({ proyectos: repositorio, participantes, protector })
    canal.adjuntar(servidor)
    servidor.listen(0, "127.0.0.1"); await once(servidor, "listening")
    const direccion = servidor.address(); if (!direccion || typeof direccion === "string") throw new Error("Puerto no disponible")
    puerto = direccion.port
  })

  afterEach(async () => {
    for (const socket of conexiones) socket.terminate()
    await canal.cerrar()
    await new Promise<void>((resolver) => servidor.close(() => resolver()))
  })

  async function conectar(projectId: string, credential: string): Promise<WebSocket> {
    const socket = new WebSocket(`ws://127.0.0.1:${puerto}/api/colaboracion-aplicacion`); conexiones.push(socket); await once(socket, "open")
    const recibido = once(socket, "message"); socket.send(JSON.stringify({ type: "authenticate", projectId, credential }))
    expect(JSON.parse((await recibido)[0].toString())).toEqual(expect.objectContaining({ type: "authenticated", projectId }))
    return socket
  }

  const mensaje = (projectId: string): MensajeProyecto => ({ id: crypto.randomUUID(), projectId, tipoRemitente: "ai", participantId: null,
    nombreVisibleSnapshot: "Asistente", contenido: "Respuesta compartida", requestId: crypto.randomUUID(), replyToMessageId: null,
    elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: new Date().toISOString() })

  it("autentica en frame sin exponer credenciales y publica sólo dentro del proyecto", async () => {
    const a = await conectar(PROYECTO_A, CREDENCIAL_A)
    const b = await conectar(PROYECTO_B, CREDENCIAL_B)
    const recibidosB: string[] = []; b.on("message", (dato) => recibidosB.push(dato.toString()))
    const recibidoA = once(a, "message"); canal.publicar(mensaje(PROYECTO_A))
    const evento = JSON.parse((await recibidoA)[0].toString())
    expect(evento).toEqual(expect.objectContaining({ type: "message_created", message: expect.objectContaining({ projectId: PROYECTO_A }) }))
    expect(JSON.stringify(evento)).not.toContain(CREDENCIAL_A)
    await new Promise((resolver) => setTimeout(resolver, 20)); expect(recibidosB).toEqual([])
  })

  it("rechaza credenciales cruzadas con cierre de política", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${puerto}/api/colaboracion-aplicacion`); conexiones.push(socket); await once(socket, "open")
    socket.send(JSON.stringify({ type: "authenticate", projectId: PROYECTO_A, credential: CREDENCIAL_B }))
    const [codigo, razon] = await once(socket, "close")
    expect(codigo).toBe(1008); expect(razon.toString()).not.toContain(CREDENCIAL_B)
  })

  it("es de sólo recepción después de autenticarse", async () => {
    const socket = await conectar(PROYECTO_A, CREDENCIAL_A)
    socket.send(JSON.stringify({ type: "mensaje_inyectado" }))
    expect((await once(socket, "close"))[0]).toBe(1008)
  })
})
