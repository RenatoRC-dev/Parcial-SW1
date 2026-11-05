import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type express from "express"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { GestionarMensajesProyecto, ErrorMensajeInvalido } from "../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../pruebas/RepositoriosMemoriaProyecto.js"

describe("memoria durable de proyecto F4-F", () => {
  let directorio: string
  let aplicacion: express.Express
  let proyectos: RepositorioProyectosArchivos
  let eventos: RepositorioEventosMemoria
  let mensajes: RepositorioMensajesMemoria
  const protector = new ProtegerAccesoProyecto("pepper-pruebas-f4-f")

  beforeEach(async () => {
    directorio = await mkdtemp(join(tmpdir(), "nexocase-f4-f-"))
    proyectos = new RepositorioProyectosArchivos(directorio)
    eventos = new RepositorioEventosMemoria()
    mensajes = new RepositorioMensajesMemoria()
    aplicacion = crearAplicacionGeneracionBackend({ accesoProyectos: {
      proyectos, participantes: new RepositorioParticipantesMemoria(), protector, eventos, mensajes,
    } })
  })
  afterEach(async () => { vi.restoreAllMocks(); await rm(directorio, { recursive: true, force: true }) })
  const bearer = (credencial: string) => ({ Authorization: `Bearer ${credencial}` })
  const crear = (nombre: string, participante: string) => request(aplicacion).post("/api/proyectos").send({ nombre, nombreParticipante: participante }).expect(201)

  it("emite PROJECT_CREATED y PARTICIPANT_JOINED con actor durable", async () => {
    const creado = await crear("Ventas", "Renato")
    const unido = await request(aplicacion).post("/api/proyectos/unirse")
      .send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Carlos" }).expect(200)
    const actividad = await request(aplicacion).get(`/api/proyectos/${creado.body.proyecto.id}/actividad`)
      .set(bearer(creado.body.credencial)).expect(200)
    expect(actividad.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: "PROJECT_CREATED", solicitadoPorParticipantId: creado.body.participante.id, nombreParticipanteSnapshot: "Renato", mecanismo: "system" }),
      expect.objectContaining({ tipo: "PARTICIPANT_JOINED", solicitadoPorParticipantId: unido.body.participante.id, nombreParticipanteSnapshot: "Carlos", mecanismo: "system" }),
    ]))
  })

  it("registra actividad manual idempotente sin aceptar actor, mecanismo, revisión ni fecha falsificados", async () => {
    const creado = await crear("Ventas", "Renato")
    const ruta = `/api/proyectos/${creado.body.proyecto.id}/actividad/modelado`
    const body = {
      clientChangeId: "11111111-1111-4111-8111-111111111111", tipo: "UML_ELEMENT_CREATED",
      elemento: { id: "clase-venta", tipo: "class", nombreSnapshot: "Venta" }, detalle: { campo: "estructura" },
      participantId: "atacante", mecanismo: "ai_cu04", revisionModeloObservada: 999, creadoEn: "2000-01-01T00:00:00.000Z",
    }
    const primero = await request(aplicacion).post(ruta).set(bearer(creado.body.credencial)).send(body).expect(201)
    const repetido = await request(aplicacion).post(ruta).set(bearer(creado.body.credencial)).send(body).expect(201)
    expect(repetido.body.id).toBe(primero.body.id)
    expect(primero.body).toMatchObject({
      projectId: creado.body.proyecto.id, solicitadoPorParticipantId: creado.body.participante.id,
      nombreParticipanteSnapshot: "Renato", mecanismo: "manual", revisionModeloObservada: 0,
      elemento: { id: "clase-venta", tipo: "class", nombreSnapshot: "Venta" },
    })
    expect(primero.body.creadoEn).not.toBe(body.creadoEn)
    expect(JSON.stringify(primero.body)).not.toMatch(/credencial|Digest|codigoAcceso/i)

    const eliminado = await request(aplicacion).post(ruta).set(bearer(creado.body.credencial)).send({
      ...body, clientChangeId: "22222222-2222-4222-8222-222222222222", tipo: "UML_ELEMENT_DELETED",
      elemento: { id: "relacion-1", tipo: "relationship", nombreSnapshot: "Venta → Cliente" }, detalle: {},
    }).expect(201)
    expect(eliminado.body.elemento).toEqual({ id: "relacion-1", tipo: "relationship", nombreSnapshot: "Venta → Cliente" })
    expect((await eventos.listarPorProyecto({ projectId: creado.body.proyecto.id, limite: 100 })).items.filter((e) => e.clientChangeId)).toHaveLength(2)
  })

  it("aísla proyectos, soporta filtros y paginación acotada", async () => {
    const a = await crear("A", "Renato")
    const b = await crear("B", "Ana")
    const rutaA = `/api/proyectos/${a.body.proyecto.id}/actividad/modelado`
    for (const [id, tipo] of [["33333333-3333-4333-8333-333333333331", "UML_ELEMENT_CREATED"], ["33333333-3333-4333-8333-333333333332", "UML_ELEMENT_UPDATED"]]) {
      await request(aplicacion).post(rutaA).set(bearer(a.body.credencial)).send({
        clientChangeId: id, tipo, elemento: { id: "venta", tipo: "class", nombreSnapshot: "Venta" }, detalle: {},
      }).expect(201)
    }
    await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/actividad`).set(bearer(b.body.credencial)).expect(403)
    await request(aplicacion).post(rutaA).set(bearer(b.body.credencial)).send({}).expect(403)
    const pagina1 = await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/actividad?limite=1&elementoId=venta`)
      .set(bearer(a.body.credencial)).expect(200)
    expect(pagina1.body.items).toHaveLength(1)
    expect(pagina1.body.siguienteCursor).toBeTypeOf("string")
    const pagina2 = await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/actividad?limite=1&elementoId=venta&cursor=${pagina1.body.siguienteCursor}`)
      .set(bearer(a.body.credencial)).expect(200)
    expect(pagina2.body.items).toHaveLength(1)
    const filtrada = await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/actividad?tipo=UML_ELEMENT_CREATED&participantId=${a.body.participante.id}`)
      .set(bearer(a.body.credencial)).expect(200)
    expect(filtrada.body.items).toHaveLength(1)
    await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/actividad?limite=101`).set(bearer(a.body.credencial)).expect(400)
  })

  it("sólo emite MODEL_SAVED después de un guardado exitoso y conserva la nueva revisión", async () => {
    const creado = await crear("Ventas", "Renato")
    const modelo = { ...creado.body.proyecto.modelo, clases: [{ id: "venta", nombre: "Venta", atributos: [], posicion: { x: 0, y: 0 }, abstracta: false }] }
    await request(aplicacion).put(`/api/proyectos/${creado.body.proyecto.id}/modelo`).set(bearer(creado.body.credencial))
      .send({ modelo, revisionBase: 0 }).expect(200)
    await request(aplicacion).put(`/api/proyectos/${creado.body.proyecto.id}/modelo`).set(bearer(creado.body.credencial))
      .send({ modelo, revisionBase: 0 }).expect(409)
    const pagina = await eventos.listarPorProyecto({ projectId: creado.body.proyecto.id, limite: 100, tipo: "MODEL_SAVED" })
    expect(pagina.items).toHaveLength(1)
    expect(pagina.items[0]).toMatchObject({ revisionModeloObservada: 1, solicitadoPorParticipantId: creado.body.participante.id })
  })

  it("no convierte un guardado durable exitoso en fallo si la actividad secundaria no puede persistirse", async () => {
    const repositorioFallido = new RepositorioEventosMemoria()
    vi.spyOn(repositorioFallido, "crear").mockRejectedValue(new Error("persistencia secundaria caída"))
    const app = crearAplicacionGeneracionBackend({ accesoProyectos: {
      proyectos, participantes: new RepositorioParticipantesMemoria(), protector,
      eventos: repositorioFallido, mensajes,
    } })
    const diagnostico = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const creado = await request(app).post("/api/proyectos").send({ nombre: "Resiliente", nombreParticipante: "Renato" }).expect(201)
    await request(app).put(`/api/proyectos/${creado.body.proyecto.id}/modelo`).set(bearer(creado.body.credencial))
      .send({ modelo: creado.body.proyecto.modelo, revisionBase: 0 }).expect(200)
    expect(diagnostico).toHaveBeenCalledWith("No se pudo registrar una actividad secundaria del proyecto.")
    expect((await proyectos.obtenerPorId(creado.body.proyecto.id))?.revisionModelo).toBe(1)
  })

  it("persiste mensajes humano/IA por servicio interno y sólo expone GET autorizado", async () => {
    const a = await crear("A", "Renato")
    const b = await crear("B", "Ana")
    const servicio = new GestionarMensajesProyecto(mensajes, proyectos)
    const humano = await servicio.registrarMensajeHumano({ projectId: a.body.proyecto.id, participantId: a.body.participante.id, displayName: "Renato" }, "¿Qué opinas de Venta?")
    const ia = await servicio.registrarMensajeIA(a.body.proyecto.id, "Venta necesita un identificador.", { replyToMessageId: humano.id, elementosRelacionadosIds: ["venta"] })
    expect(humano).toMatchObject({ tipoRemitente: "human", participantId: a.body.participante.id, nombreVisibleSnapshot: "Renato" })
    expect(ia).toMatchObject({ tipoRemitente: "ai", participantId: null, nombreVisibleSnapshot: "Asistente" })
    expect((await servicio.listarRecientes(a.body.proyecto.id)).items).toHaveLength(2)
    expect((await servicio.listarRecientes(b.body.proyecto.id)).items).toHaveLength(0)
    await expect(servicio.registrarMensajeIA(a.body.proyecto.id, "x".repeat(8_001))).rejects.toBeInstanceOf(ErrorMensajeInvalido)
    await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/mensajes`).expect(401)
    const listado = await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/mensajes?limite=1`).set(bearer(a.body.credencial)).expect(200)
    expect(listado.body.items).toHaveLength(1)
    expect(listado.body.siguienteCursor).toBeTypeOf("string")
    await request(aplicacion).post(`/api/proyectos/${a.body.proyecto.id}/mensajes`).set(bearer(a.body.credencial)).send({ tipoRemitente: "ai" }).expect(404)
    await request(aplicacion).get(`/api/proyectos/${a.body.proyecto.id}/mensajes`).set(bearer(b.body.credencial)).expect(403)
  })
})
