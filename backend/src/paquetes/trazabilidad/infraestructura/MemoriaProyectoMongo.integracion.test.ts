import { randomUUID } from "node:crypto"
import { MongoClient, type Db } from "mongodb"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { COLECCION_EVENTOS, COLECCION_MENSAJES, crearIndicesMongo } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import { GestionarMensajesProyecto } from "../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import { RepositorioMensajesMongo } from "../../mensajeria_colaborativa/infraestructura/RepositorioMensajesMongo.js"
import { RepositorioProyectosMongo } from "../../gestion_proyectos/infraestructura/RepositorioProyectosMongo.js"
import { RegistrarActividadProyecto } from "../casos_uso/RegistrarActividadProyecto.js"
import { RepositorioEventosMongo } from "./RepositorioEventosMongo.js"

const uri = process.env.MONGODB_TEST_URI?.trim()
const describeIntegracion = uri ? describe : describe.skip

describeIntegracion("events y messages con MongoDB real", () => {
  let cliente: MongoClient
  let base: Db
  let proyectoId: string
  let proyectos: RepositorioProyectosMongo
  let eventos: RepositorioEventosMongo
  let mensajes: RepositorioMensajesMongo

  beforeAll(async () => {
    cliente = new MongoClient(uri!, { serverSelectionTimeoutMS: 5_000 })
    await cliente.connect()
    base = cliente.db(`nexocase_memoria_${randomUUID().replaceAll("-", "")}`)
    await crearIndicesMongo(base)
    proyectos = new RepositorioProyectosMongo(base)
    eventos = new RepositorioEventosMongo(base)
    mensajes = new RepositorioMensajesMongo(base)
    proyectoId = randomUUID()
    await proyectos.crear({
      id: proyectoId, nombre: "Ventas", revisionModelo: 5,
      creadoEn: "2026-11-05T00:00:00.000Z", actualizadoEn: "2026-11-05T00:00:00.000Z",
      modelo: { id: "modelo", nombre: "Ventas", version: "4.2.0", clases: [], relaciones: [] },
    }, "a".repeat(64))
  })
  afterAll(async () => { await base.dropDatabase(); await cliente.close() })

  it("crea índices idempotentes y persiste actividad con BSON Date e idempotencia", async () => {
    await crearIndicesMongo(base)
    const servicio = new RegistrarActividadProyecto(eventos, proyectos)
    const contexto = { projectId: proyectoId, participantId: randomUUID(), displayName: "Renato" }
    const clientChangeId = randomUUID()
    const primero = await servicio.registrarManual(contexto, {
      clientChangeId, tipo: "UML_ELEMENT_CREATED",
      elemento: { id: "venta", tipo: "class", nombreSnapshot: "Venta" }, detalle: {},
    })
    const repetido = await servicio.registrarManual(contexto, {
      clientChangeId, tipo: "UML_ELEMENT_CREATED",
      elemento: { id: "venta", tipo: "class", nombreSnapshot: "Venta" }, detalle: {},
    })
    expect(primero.id).toBe(repetido.id)
    expect(primero.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(primero.revisionModeloObservada).toBe(5)
    expect((await base.collection(COLECCION_EVENTOS).findOne({ _id: primero.id }))?.creadoEn).toBeInstanceOf(Date)
    expect((await base.collection(COLECCION_EVENTOS).indexes()).map((i) => i.name)).toEqual([
      "_id_", "project_fecha_evento", "project_elemento_fecha", "project_participante_fecha", "project_client_change_unique",
    ])
  })

  it("persiste mensajes humano/IA, pagina cronológicamente y aísla por proyecto", async () => {
    const servicio = new GestionarMensajesProyecto(mensajes, proyectos)
    const contexto = { projectId: proyectoId, participantId: randomUUID(), displayName: "Carlos" }
    const humano = await servicio.registrarMensajeHumano(contexto, "Primero")
    await servicio.registrarMensajeIA(proyectoId, "Segundo", { replyToMessageId: humano.id })
    const primera = await mensajes.listarPorProyecto({ projectId: proyectoId, limite: 1 })
    expect(primera.items).toHaveLength(1)
    expect(primera.siguienteCursor).not.toBeNull()
    const segunda = await mensajes.listarPorProyecto({ projectId: proyectoId, limite: 1, cursor: primera.siguienteCursor! })
    expect(segunda.items).toHaveLength(1)
    expect(segunda.items[0]?.id).not.toBe(primera.items[0]?.id)
    expect((await mensajes.listarPorProyecto({ projectId: randomUUID(), limite: 30 })).items).toEqual([])
    expect((await base.collection(COLECCION_MENSAJES).findOne({ _id: humano.id }))?.creadoEn).toBeInstanceOf(Date)
    expect((await base.collection(COLECCION_MENSAJES).indexes()).map((i) => i.name)).toEqual(["_id_", "project_fecha_mensaje"])
  })
})
