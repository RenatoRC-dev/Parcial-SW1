import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomUUID } from "node:crypto"
import type { Server } from "node:http"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { crearServidorMcp } from "./ServidorMcp.js"
import { verificarInspeccion, esquemaInspeccionEA } from "./ConectorEA.js"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import { exportarModeloXmi } from "../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import { fixtureCliente } from "../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/fixtureCliente.js"
import { fixtureInteroperabilidad } from "../../interoperabilidad/compartido/crunch_uml/fixtureInteroperabilidad.js"

vi.mock("../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js", () => ({ exportarModeloXmi: vi.fn() }))
const modelo = { ...fixtureCliente, clases: fixtureCliente.clases.map((c) => ({ ...c, posicion: { x: 0, y: 0 } })) }
const inspection = () => esquemaInspeccionEA.parse({ packageGuid: `{${randomUUID()}}`, classes: modelo.clases.map((c) => ({ id: c.id, name: c.nombre, abstract: c.abstracta ? "1" : "0", stereotype: "", methods: 0, attributes: c.atributos.map((a) => ({ name: a.nombre, type: a.tipo ?? "", visibility: "Public" })) })), relationships: [] })

describe("MCP oficial y conector EA autorizado", () => {
  let app: ReturnType<typeof crearAplicacionGeneracionBackend>, dir: string, projectId: string, credential: string, other: string, repo: RepositorioMensajesMemoria
  const cleanup: (() => Promise<unknown>)[] = []
  const ruta = () => `/api/proyectos/${projectId}`
  const bearer = () => ({ Authorization: `Bearer ${credential}` })
  const turno = (contenido = "Export this model to Enterprise Architect.", requestId = randomUUID()) => ({ contenido, requestId, modeloEjecucion: modelo, revisionEditor: 7 })
  const invocar = (nombre: string, argumentos: unknown, cred = credential) => request(app).post(`${ruta()}/herramientas/invocar`).set("Authorization", `Bearer ${cred}`).send({ nombre, argumentos })
  const crearContexto = async (contenido = "Valida el UML") => (await request(app).post(`${ruta()}/herramientas/contextos`).set(bearer()).send(turno(contenido)).expect(201)).body.contextId as string
  const deviceId = randomUUID(), targetId = "a".repeat(64)
  const parear = async () => (await request(app).post(`${ruta()}/conector-ea/autorizar`).set(bearer()).send({ deviceId, targetId, consent: true }).expect(201)).body.token as string
  const siguiente = (token: string, cred = credential) => request(app).post(`${ruta()}/conector-ea/siguiente`).set("Authorization", `Bearer ${cred}`).set("X-NexoCASE-Connector", token).send({})
  beforeEach(async () => {
    vi.clearAllMocks(); vi.mocked(exportarModeloXmi).mockResolvedValue(Buffer.from("<xmi:XMI/>"))
    dir = await mkdtemp(join(tmpdir(), "mcp-ea-")); repo = new RepositorioMensajesMemoria()
    app = crearAplicacionGeneracionBackend({ accesoProyectos: { proyectos: new RepositorioProyectosArchivos(dir), participantes: new RepositorioParticipantesMemoria(), protector: new ProtegerAccesoProyecto("mcp-ea-test"), mensajes: repo, eventos: new RepositorioEventosMemoria() }, proveedorAsistenteContextual: { responder: vi.fn() }, proveedorIA: { interpretarCambiosUML: vi.fn() } })
    const p = await request(app).post("/api/proyectos").send({ nombre: "MCP EA test", nombreParticipante: "Ana" }).expect(201)
    projectId = p.body.proyecto.id; credential = p.body.credencial
    const u = await request(app).post("/api/proyectos/unirse").send({ codigoAcceso: p.body.codigoAcceso, nombreParticipante: "Luis" }).expect(200); other = u.body.credencial
  })
  afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); for (const close of cleanup.splice(0).reverse()) await close(); await rm(dir, { recursive: true, force: true }) })

  it("cliente MCP real negocia, descubre siete tools e invoca validación por backend autenticado", async () => {
    const server = crearServidorMcp(async (nombre, args) => {
      const result = await invocar(nombre, args)
      if (result.status !== 200) throw Object.assign(new Error("rejected"), { status: result.status })
      return result.body
    })
    const client = new Client({ name: "proof", version: "1.0.0" })
    const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a)
    cleanup.push(() => server.close(), () => client.close())
    const list = await client.listTools()
    expect(list.tools.map((t) => t.name).sort()).toEqual(["uml_read_model", "uml_validate", "uml_request_change", "xmi_export", "xmi_import", "spring_generate", "ea_import_model"].sort())
    const contextId = await crearContexto()
    const r = await client.callTool({ name: "uml_validate", arguments: { contextId, expectedRevision: 7 } })
    expect(r.isError).not.toBe(true); expect(r.structuredContent).toMatchObject({ projectId, revision: 7, kind: "uml_validate", outcome: { validacion: { valido: true } } })
    const invalid = await client.callTool({ name: "uml_validate", arguments: { contextId, expectedRevision: 7, shell: "whoami" } })
    expect(invalid.isError).toBe(true)
    const stale = await client.callTool({ name: "uml_validate", arguments: { contextId, expectedRevision: 6 } })
    expect(stale.isError).toBe(true)
  })

  it("stdio real: cliente oficial inicia proceso, tools/list y tools/call llegan al registro", async () => {
    const http = await new Promise<Server>((resolveServer) => { const s = app.listen(0, "127.0.0.1", () => resolveServer(s)) })
    cleanup.push(() => new Promise<void>((r, reject) => http.close((e) => e ? reject(e) : r())))
    const address = http.address(); if (!address || typeof address === "string") throw new Error("listen")
    const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("node_modules/tsx/dist/cli.mjs"), resolve("src/paquetes/asistencia_contextual/herramientas/iniciarMcp.ts")], env: { ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string")), NEXOCASE_BACKEND_URL: `http://127.0.0.1:${address.port}`, NEXOCASE_PROJECT_ID: projectId, NEXOCASE_CREDENTIAL: credential }, stderr: "pipe" })
    const client = new Client({ name: "stdio-proof", version: "1.0.0" }); cleanup.push(() => client.close())
    await client.connect(transport)
    expect((await client.listTools()).tools).toHaveLength(7)
    const result = await client.callTool({ name: "uml_read_model", arguments: { contextId: await crearContexto(), expectedRevision: 7 } })
    expect(result.isError).not.toBe(true); expect(result.structuredContent).toMatchObject({ projectId, outcome: { modelo: { id: modelo.id } } })
  }, 20000)

  it("rechaza anonimato, otro participante, contexto sustituido y revisión incorrecta", async () => {
    await request(app).post(`${ruta()}/herramientas/contextos`).send(turno()).expect(401)
    const contextId = await crearContexto()
    await invocar("uml_read_model", { contextId, expectedRevision: 7 }, other).expect(403)
    await invocar("uml_request_change", { contextId, expectedRevision: 7 }).expect(403)
    await invocar("uml_read_model", { contextId, expectedRevision: 6 }).expect(409)
    await invocar("execute_shell", { contextId, expectedRevision: 7 }).expect(400)
    await crearContexto(); await invocar("uml_read_model", { contextId, expectedRevision: 7 }).expect(403)
  })

  it("XMI export usa reserva idempotente existente y no autoriza otra herramienta", async () => {
    const contextId = await crearContexto("Exporta el modelo a XMI")
    await invocar("spring_generate", { contextId, expectedRevision: 7 }).expect(403)
    const a = await invocar("xmi_export", { contextId, expectedRevision: 7 }).expect(200)
    await invocar("xmi_export", { contextId, expectedRevision: 7 }).expect(200)
    expect(exportarModeloXmi).toHaveBeenCalledTimes(1)
    expect(a.body.outcome).toMatchObject({ kind: "workflow", flujo: { estado: "ready" } })
  })

  it("no permite usar contexto en otro proyecto ni ampliar argumentos con identidades o rutas", async () => {
    const contextId = await crearContexto()
    const second = await request(app).post("/api/proyectos").send({ nombre: "Other project", nombreParticipante: "Ana" }).expect(201)
    await request(app).post(`/api/proyectos/${second.body.proyecto.id}/herramientas/invocar`).set("Authorization", `Bearer ${second.body.credencial}`).send({ nombre: "uml_read_model", argumentos: { contextId, expectedRevision: 7 } }).expect(403)
    await invocar("uml_read_model", { contextId, expectedRevision: 7, projectId, participantId: "forged", repositoryPath: "C:\\remote.eapx" }).expect(400)
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60_000)
    await invocar("uml_read_model", { contextId, expectedRevision: 7 }).expect(403)
  })

  it("readback verifica nombre, roles y multiplicidades; normaliza únicamente 1 a 1..1", () => {
    const model = structuredClone(fixtureInteroperabilidad)
    model.relaciones[0]!.nombre = "realiza"
    const actual = esquemaInspeccionEA.parse({ packageGuid: `{${randomUUID()}}`, classes: model.clases.map((c) => ({ id: c.id, name: c.nombre, abstract: "0", stereotype: "", methods: 0, attributes: c.atributos.map((a) => ({ name: a.nombre, type: a.tipo, visibility: "Public" })) })), relationships: [{ name: "realiza", source: "Cliente", target: "Pedido", type: "Association", sourceMultiplicity: "1..1", targetMultiplicity: "0..*", sourceRole: "cliente", targetRole: "pedidos", sourceAggregation: 0, targetAggregation: 0 }] })
    expect(verificarInspeccion({ modeloBase: model }, actual)).toEqual([])
    actual.relationships[0]!.targetMultiplicity = "1..*"
    expect(verificarInspeccion({ modeloBase: model }, actual)).toHaveLength(1)
    actual.relationships[0]!.targetMultiplicity = "0..*"; actual.relationships[0]!.targetRole = "inventado"
    expect(verificarInspeccion({ modeloBase: model }, actual)).toHaveLength(1)
  })

  it("EA no disponible da guía y no llama al exportador", async () => {
    const r = await request(app).post(`${ruta()}/asistente-colaborativo/interactuar`).set(bearer()).send(turno()).expect(503)
    expect(r.body.error).toContain("desktop/ea/README.md"); expect(exportarModeloXmi).not.toHaveBeenCalled()
  })

  it("trabajo EA se entrega una vez, verifica contenido COM y preserva Guardar explícito", async () => {
    const token = await parear(), t = turno()
    const r = await request(app).post(`${ruta()}/asistente-colaborativo/interactuar`).set(bearer()).send(t).expect(200)
    expect(r.body.flujo.estado).toBe("queued")
    const j = await siguiente(token).expect(200); expect(j.body.job).toMatchObject({ requestId: t.requestId, projectId, targetId })
    expect((await siguiente(token).expect(200)).body.job).toBeNull()
    await siguiente(token, other).expect(403)
    const receipt = { requestId: t.requestId, status: "verified", inspection: inspection() }
    const enviar = () => request(app).post(`${ruta()}/conector-ea/recibo`).set(bearer()).set("X-NexoCASE-Connector", token).send(receipt)
    expect((await enviar().expect(200)).body.status).toBe("ready"); await enviar().expect(200)
    expect((await repo.obtenerFlujo(projectId, t.requestId))?.resumen).toContain("lectura COM")
    expect((await request(app).get(ruta()).set(bearer()).expect(200)).body.revisionModelo).toBe(0)
    await request(app).post(`${ruta()}/asistente-colaborativo/interactuar`).set(bearer()).send(t).expect(200)
    expect(exportarModeloXmi).toHaveBeenCalledTimes(1)
  })

  it("proceso exitoso sin readback nunca confirma; diferencias tampoco", async () => {
    const token = await parear(), t = turno()
    await request(app).post(`${ruta()}/asistente-colaborativo/interactuar`).set(bearer()).send(t).expect(200); await siguiente(token).expect(200)
    const r = await request(app).post(`${ruta()}/conector-ea/recibo`).set(bearer()).set("X-NexoCASE-Connector", token).send({ requestId: t.requestId, status: "verified" }).expect(200)
    expect(r.body.status).toBe("failed")
    const actual = inspection(); actual.classes[0]!.attributes[0]!.type = "Wrong"
    expect(verificarInspeccion({ modeloBase: modelo }, actual).join(" ")).toContain("Atributo")
  })

  it("autorización revocada, sesión expirada y trabajo vencido fallan sin reimportar", async () => {
    const token = await parear(), t = turno()
    await request(app).post(`${ruta()}/asistente-colaborativo/interactuar`).set(bearer()).send(t).expect(200)
    const f = (await repo.obtenerFlujo(projectId, t.requestId))!; f.ea!.expires = Date.now() - 1
    await repo.actualizarFlujo(f, "queued")
    expect((await siguiente(token).expect(200)).body.job).toBeNull(); expect((await repo.obtenerFlujo(projectId, t.requestId))?.estado).toBe("failed")
    await request(app).post(`${ruta()}/conector-ea/revocar`).set(bearer()).set("X-NexoCASE-Connector", token).send({}).expect(204)
    await siguiente(token).expect(403)
    const newer = await parear(); vi.spyOn(Date, "now").mockReturnValue(Date.now() + 9 * 60 * 60_000)
    await siguiente(newer).expect(403); vi.restoreAllMocks()
  })
})
