import { randomUUID } from "node:crypto"
import { MongoClient, type Db } from "mongodb"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { crearIndicesMongo, COLECCION_PARTICIPANTES, COLECCION_PROYECTOS } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import {
  ErrorConflictoRevisionProyecto,
  ErrorDatosProyectoCorruptos,
  ErrorProyectoNoEncontrado,
} from "../compartido/RepositorioProyectos.js"
import type { ProyectoPersistido } from "../compartido/ProyectoPersistido.js"
import { RepositorioProyectosMongo } from "./RepositorioProyectosMongo.js"
import { RepositorioParticipantesMongo } from "./RepositorioParticipantesMongo.js"
import { ProtegerAccesoProyecto } from "../acceso/ProtegerAccesoProyecto.js"
import { crearProyectoConAcceso, unirseAProyecto } from "../casos_uso/cu01_crear_abrir_proyecto/GestionarAccesoProyecto.js"
import { ErrorCodigoAccesoDuplicado } from "../compartido/RepositorioProyectos.js"
import { ErrorCredencialParticipanteDuplicada } from "../compartido/RepositorioParticipantes.js"

const uri = process.env.MONGODB_TEST_URI?.trim()
const describeIntegracion = uri ? describe : describe.skip

describeIntegracion("RepositorioProyectosMongo con MongoDB real", () => {
  let cliente: MongoClient
  let baseDatos: Db
  let repositorio: RepositorioProyectosMongo
  let participantes: RepositorioParticipantesMongo

  beforeAll(async () => {
    cliente = new MongoClient(uri!, { serverSelectionTimeoutMS: 5_000 })
    await cliente.connect()
    baseDatos = cliente.db(`nexocase_test_${randomUUID().replaceAll("-", "")}`)
    await crearIndicesMongo(baseDatos)
    repositorio = new RepositorioProyectosMongo(baseDatos)
    participantes = new RepositorioParticipantesMongo(baseDatos)
  })

  afterEach(async () => {
    await baseDatos.collection(COLECCION_PROYECTOS).deleteMany({})
    await baseDatos.collection(COLECCION_PARTICIPANTES).deleteMany({})
  })

  afterAll(async () => {
    await baseDatos.dropDatabase()
    await cliente.close()
  })

  const proyecto = (nombre = "Sistema de ventas"): ProyectoPersistido => {
    const id = randomUUID()
    return {
      id,
      nombre,
      creadoEn: "2026-11-04T12:00:00.000Z",
      actualizadoEn: "2026-11-04T12:00:00.000Z",
      revisionModelo: 0,
      modelo: { id: `modelo-${id}`, nombre, version: "4.2.0", clases: [], relaciones: [] },
    }
  }

  it("crea, permite nombres duplicados, lista y lee con fechas BSON", async () => {
    const primero = await repositorio.crear(proyecto(), null)
    const segundo = await repositorio.crear(proyecto(), null)
    expect(primero.revisionModelo).toBe(0)
    expect(segundo.id).not.toBe(primero.id)
    expect(await repositorio.obtenerPorId(primero.id)).toEqual(primero)
    expect(await repositorio.listar()).toHaveLength(2)

    const documento = await baseDatos.collection(COLECCION_PROYECTOS).findOne({ _id: primero.id })
    expect(documento?.codigoAccesoDigest).toBeNull()
    expect(documento?.creadoEn).toBeInstanceOf(Date)
    expect(documento?.actualizadoEn).toBeInstanceOf(Date)
    expect((await baseDatos.collection(COLECCION_PROYECTOS).indexes()).map((indice) => indice.name)).toEqual(["_id_", "codigo_acceso_digest_unique"])
    expect((await baseDatos.collection(COLECCION_PARTICIPANTES).indexes()).map((indice) => indice.name)).toEqual([
      "_id_", "credencial_digest_unique", "project_nombre_normalizado",
    ])
  })

  it("preserva el modelo canónico y aplica CAS sin perder tipo null", async () => {
    const creado = await repositorio.crear(proyecto("Borrador"), "a".repeat(64))
    const modelo = {
      ...creado.modelo,
      clases: [{
        id: "cliente",
        nombre: "Cliente",
        abstracta: false,
        posicion: { x: 10, y: 20 },
        atributos: [{ id: "nombre", nombre: "nombre", tipo: null }],
      }],
    }
    const guardado = await repositorio.guardarModeloConRevision(
      creado.id,
      modelo,
      0,
      "2026-11-04T12:01:00.000Z",
    )
    expect(guardado.revisionModelo).toBe(1)
    expect(guardado.modelo).toEqual(modelo)
    expect(guardado.modelo.clases[0]?.atributos[0]?.tipo).toBeNull()
    await expect(repositorio.guardarModeloConRevision(
      creado.id,
      modelo,
      0,
      "2026-11-04T12:02:00.000Z",
    )).rejects.toBeInstanceOf(ErrorConflictoRevisionProyecto)
    await expect(repositorio.guardarModeloConRevision(
      randomUUID(),
      modelo,
      0,
      "2026-11-04T12:02:00.000Z",
    )).rejects.toBeInstanceOf(ErrorProyectoNoEncontrado)
  })

  it("indexa códigos y credenciales, permite nombres duplicados y resuelve sus búsquedas", async () => {
    const digestCodigo = "b".repeat(64)
    const primero = await repositorio.crear(proyecto("Sistema de ventas"), digestCodigo)
    await repositorio.crear(proyecto("Sistema de ventas"), "c".repeat(64))
    expect(await repositorio.buscarPorCodigoAccesoDigest(digestCodigo)).toEqual(primero)
    await expect(repositorio.crear(proyecto("Otro"), digestCodigo)).rejects.toBeInstanceOf(ErrorCodigoAccesoDuplicado)

    const participante = {
      id: randomUUID(), proyectoId: primero.id, nombreVisible: "Carlos", nombreNormalizado: "carlos",
      credencialDigest: "d".repeat(64), creadoEn: "2026-11-04T12:00:00.000Z", ultimoAccesoEn: "2026-11-04T12:00:00.000Z",
    }
    expect(await participantes.crear(participante)).toEqual(participante)
    expect(await participantes.obtenerPorCredencialDigest(participante.credencialDigest)).toEqual(participante)
    await expect(participantes.crear({ ...participante, id: randomUUID() }))
      .rejects.toBeInstanceOf(ErrorCredencialParticipanteDuplicada)
  })

  it("crea acceso y cada unión con el mismo nombre produce otro participante", async () => {
    const protector = new ProtegerAccesoProyecto("pepper-integracion-mongo")
    const creado = await crearProyectoConAcceso(repositorio, participantes, protector, "Ventas", "Carlos")
    const unido1 = await unirseAProyecto(repositorio, participantes, protector, creado.codigoAcceso, "Carlos")
    const unido2 = await unirseAProyecto(repositorio, participantes, protector, creado.codigoAcceso, "Carlos")
    expect(unido1.proyecto.id).toBe(creado.proyecto.id)
    expect(new Set([creado.participante.id, unido1.participante.id, unido2.participante.id]).size).toBe(3)
    const documento = await baseDatos.collection(COLECCION_PROYECTOS).findOne({ _id: creado.proyecto.id })
    expect(documento?.codigoAccesoDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(documento)).not.toContain(creado.codigoAcceso)
    expect(await baseDatos.collection(COLECCION_PARTICIPANTES).countDocuments({ projectId: creado.proyecto.id, nombreNormalizado: "carlos" })).toBe(3)
    const participanteMongo = await baseDatos.collection(COLECCION_PARTICIPANTES).findOne({ _id: creado.participante.id })
    expect(participanteMongo?.credencialDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(participanteMongo?.creadoEn).toBeInstanceOf(Date)
    expect(participanteMongo?.ultimoAccesoEn).toBeInstanceOf(Date)
    expect(JSON.stringify(participanteMongo)).not.toContain(creado.credencial)
  })

  it("rechaza documentos Mongo corruptos sin filtrar errores del driver", async () => {
    const id = randomUUID()
    await baseDatos.collection(COLECCION_PROYECTOS).insertOne({
      _id: id,
      nombre: "Corrupto",
      codigoAccesoDigest: null,
      revisionModelo: -1,
      modelo: {},
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    })
    await expect(repositorio.obtenerPorId(id)).rejects.toBeInstanceOf(ErrorDatosProyectoCorruptos)
  })
})
