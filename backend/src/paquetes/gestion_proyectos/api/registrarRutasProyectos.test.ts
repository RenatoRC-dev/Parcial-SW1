import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type express from "express"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../pruebas/RepositorioParticipantesMemoria.js"
import { LimitadorIntentos } from "./LimitadorIntentos.js"

describe("API F4-B de acceso a proyectos", () => {
  let directorio: string
  let aplicacion: express.Express
  const protector = new ProtegerAccesoProyecto("pepper-pruebas-api-f4-b")

  beforeEach(async () => {
    directorio = await mkdtemp(join(tmpdir(), "sw1-proyectos-test-"))
    aplicacion = crearAplicacionGeneracionBackend({
      accesoProyectos: {
        proyectos: new RepositorioProyectosArchivos(directorio),
        participantes: new RepositorioParticipantesMemoria(),
        protector,
        limitadorUnion: new LimitadorIntentos({ maximosFallos: 3, ventanaMs: 60_000, maximasClaves: 100 }),
      },
    })
  })
  afterEach(async () => { await rm(directorio, { recursive: true, force: true }) })

  const crear = async (nombre = "Ventas", participante = "Renato") => request(aplicacion)
    .post("/api/proyectos").send({ nombre, nombreParticipante: participante }).expect(201)
  const bearer = (credencial: string) => ({ Authorization: `Bearer ${credencial}` })

  it("crea proyecto, participante y secretos retornables sin filtrar digests", async () => {
    const respuesta = await crear("  Sistema de ventas  ", "  Rénato  ")
    expect(respuesta.body.proyecto).toMatchObject({ nombre: "Sistema de ventas", revisionModelo: 0 })
    expect(respuesta.body.participante.nombreVisible).toBe("Rénato")
    expect(respuesta.body.codigoAcceso).toMatch(/^NX-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/)
    expect(respuesta.body.credencial).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(JSON.stringify(respuesta.body)).not.toMatch(/Digest|pepper|mongodb:\/\//i)
  })

  it("une por código normalizado y crea identidades distintas aunque el nombre coincida", async () => {
    const creado = await crear("Ventas", "Carlos")
    const codigoFlexible = creado.body.codigoAcceso.toLowerCase().replaceAll("-", " ")
    const unido1 = await request(aplicacion).post("/api/proyectos/unirse")
      .send({ codigoAcceso: codigoFlexible, nombreParticipante: "Carlos" }).expect(200)
    const unido2 = await request(aplicacion).post("/api/proyectos/unirse")
      .send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Carlos" }).expect(200)
    expect(unido1.body.proyecto.id).toBe(creado.body.proyecto.id)
    expect(unido1.body.codigoAcceso).toBeUndefined()
    expect(unido1.body.participante.id).not.toBe(creado.body.participante.id)
    expect(unido2.body.participante.id).not.toBe(unido1.body.participante.id)
  })

  it("rechaza código inválido de forma genérica y limita intentos por IP", async () => {
    for (let intento = 0; intento < 2; intento += 1) {
      const respuesta = await request(aplicacion).post("/api/proyectos/unirse")
        .send({ codigoAcceso: "NX-2222-2222-2222", nombreParticipante: "Carlos" }).expect(404)
      expect(respuesta.body.codigo).toBe("CODIGO_PROYECTO_INVALIDO")
    }
    const limitada = await request(aplicacion).post("/api/proyectos/unirse")
      .send({ codigoAcceso: "NX-2222-2222-2222", nombreParticipante: "Carlos" }).expect(429)
    expect(limitada.body.codigo).toBe("LIMITE_INTENTOS")
  })

  it("no expone catálogo global y rechaza UUID sin Bearer", async () => {
    const creado = await crear()
    await request(aplicacion).get("/api/proyectos").expect(404)
    const sinCredencial = await request(aplicacion).get(`/api/proyectos/${creado.body.proyecto.id}`).expect(401)
    expect(sinCredencial.body.codigo).toBe("CREDENCIAL_REQUERIDA")
  })

  it("abre con credencial válida y rechaza credencial de otro proyecto", async () => {
    const proyectoA = await crear("A", "Ana")
    const proyectoB = await crear("B", "Bruno")
    await request(aplicacion).get(`/api/proyectos/${proyectoA.body.proyecto.id}`)
      .set(bearer(proyectoA.body.credencial)).expect(200)
    const cruzada = await request(aplicacion).get(`/api/proyectos/${proyectoA.body.proyecto.id}`)
      .set(bearer(proyectoB.body.credencial)).expect(403)
    expect(cruzada.body.codigo).toBe("ACCESO_PROYECTO_DENEGADO")
  })

  it("protege guardado, conserva tipo null, ignora identidad inyectada y mantiene CAS", async () => {
    const creado = await crear()
    const proyecto = creado.body.proyecto
    const modelo = {
      ...proyecto.modelo,
      clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 1, y: 2 }, atributos: [{ id: "nombre", nombre: "nombre", tipo: null }] }],
    }
    await request(aplicacion).put(`/api/proyectos/${proyecto.id}/modelo`)
      .send({ modelo, revisionBase: 0 }).expect(401)
    const guardado = await request(aplicacion).put(`/api/proyectos/${proyecto.id}/modelo`)
      .set(bearer(creado.body.credencial))
      .send({ modelo, revisionBase: 0, participantId: "participante-falsificado" }).expect(200)
    expect(guardado.body.revisionModelo).toBe(1)
    const recuperado = await request(aplicacion).get(`/api/proyectos/${proyecto.id}`)
      .set(bearer(creado.body.credencial)).expect(200)
    expect(recuperado.body.modelo.clases[0].atributos[0].tipo).toBeNull()
    const conflicto = await request(aplicacion).put(`/api/proyectos/${proyecto.id}/modelo`)
      .set(bearer(creado.body.credencial)).send({ modelo, revisionBase: 0 }).expect(409)
    expect(conflicto.body.codigo).toBe("REVISION_CONFLICTIVA")
  })

  it("valida nombres visibles y no permite credenciales con sintaxis libre", async () => {
    await request(aplicacion).post("/api/proyectos")
      .send({ nombre: "Ventas", nombreParticipante: "\u0000" }).expect(400)
    const creado = await crear()
    const invalida = await request(aplicacion).get(`/api/proyectos/${creado.body.proyecto.id}`)
      .set("Authorization", "Bearer texto-libre").expect(401)
    expect(invalida.body.codigo).toBe("CREDENCIAL_INVALIDA")
  })
})
