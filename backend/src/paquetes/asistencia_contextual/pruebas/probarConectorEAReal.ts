import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { randomUUID } from "node:crypto"
import type { Server } from "node:http"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import { fixtureInteroperabilidad } from "../../interoperabilidad/compartido/crunch_uml/fixtureInteroperabilidad.js"

// Explicit owner-invoked smoke, never a unit-test dependency. No AI/provider call.
if (process.platform !== "win32") throw new Error("Requires actual Windows EA and an explicitly configured CU07 Python runtime.")
const exec = promisify(execFile), desktop = resolve("../desktop/ea")
const prepared = JSON.parse((await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", join(desktop, "Smoke.ps1"), "-PrepareOnly"], { timeout: 30_000 })).stdout.trim()) as { testRepository: string; parentPackageGuid: string }
const dir = await mkdtemp(join(tmpdir(), "nexo-ea-proof-")), mensajes = new RepositorioMensajesMemoria()
const projects = new RepositorioProyectosArchivos(dir)
const app = crearAplicacionGeneracionBackend({ accesoProyectos: { proyectos: projects, participantes: new RepositorioParticipantesMemoria(), protector: new ProtegerAccesoProyecto("isolated-real-ea-proof"), mensajes, eventos: new RepositorioEventosMemoria() }, proveedorAsistenteContextual: { responder: async () => { throw new Error("Unexpected AI invocation") } }, proveedorIA: { interpretarCambiosUML: async () => { throw new Error("Unexpected Groq invocation") } } })
const http = await new Promise<Server>((done) => { const s = app.listen(0, "127.0.0.1", () => done(s)) })
const address = http.address(); assert(address && typeof address !== "string")
const base = `http://127.0.0.1:${address.port}`
let child: ReturnType<typeof spawn> | undefined
try {
  const creation = await fetch(`${base}/api/proyectos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: "S3 real EA smoke", nombreParticipante: "Smoke participant" }) })
  assert.equal(creation.status, 201)
  const created = await creation.json() as { proyecto: { id: string }; credencial: string }
  const projectId = created.proyecto.id, credential = created.credencial
  const headers = { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }
  child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", join(desktop, "StartSmokeConnector.ps1"), "-BackendUrl", base, "-ProjectId", projectId, "-RepositoryPath", prepared.testRepository, "-ParentPackageGuid", prepared.parentPackageGuid], { env: { ...process.env, NEXOCASE_EA_SMOKE_CREDENTIAL: credential }, stdio: ["ignore", "pipe", "pipe"] })
  let authorized = false, exited = false, logs = ""
  child.stdout!.on("data", (data: Buffer) => { const text = data.toString(); logs += text; if (text.includes("Authorized. Keep")) authorized = true })
  child.stderr!.on("data", (data: Buffer) => { logs += data.toString() })
  const exit = new Promise<number | null>((done) => child!.once("exit", (code) => { exited = true; done(code) }))
  const deadline = Date.now() + 90_000
  while (!authorized && !exited && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200))
  assert(authorized, `Connector did not authorize: ${logs.replaceAll(credential, "[redacted]")}`)
  const requestId = randomUUID()
  const model = structuredClone(fixtureInteroperabilidad)
  // Verify the requested 1..* association as well as the previously observed 0..* sample.
  model.relaciones[0]!.multiplicidadDestino = "1..*"
  model.relaciones[0]!.nombre = "realiza"
  for (const clase of model.clases) for (const atributo of clase.atributos) atributo.visibilidad = "publica"
  const response = await fetch(`${base}/api/proyectos/${projectId}/asistente-colaborativo/interactuar`, { method: "POST", headers, body: JSON.stringify({ requestId, contenido: "Export my current UML model and import it into Enterprise Architect.", modeloEjecucion: model, revisionEditor: 11 }) })
  assert.equal(response.status, 200, await response.text().then((text) => { try { return JSON.parse(text).error ?? "" } catch { return "unexpected response" } }))
  let result = await mensajes.obtenerFlujo(projectId, requestId)
  while (result && ["queued", "importing"].includes(result.estado) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500)); result = await mensajes.obtenerFlujo(projectId, requestId)
  }
  assert(result); assert.equal(result.estado, "ready", result.resumen + " " + result.advertencias.join(" "))
  assert(result.ea?.packageGuid); assert.match(result.resumen, /lectura COM/)
  assert.equal((await projects.obtenerPorId(projectId))?.revisionModelo, 0)
  assert.equal(await exit, 0, logs.replaceAll(credential, "[redacted]"))
  console.log(JSON.stringify({ status: "PASS", operation: "authenticated chat → real CU07/Crunch → outbound production Windows connector → actual EA COM → repository readback", revision: 11, savedRevision: 0, testRepository: prepared.testRepository, packageGuid: result.ea.packageGuid, summary: result.resumen, warnings: result.advertencias, scope: "Actual EA and XMI; isolated in-memory participants/messages, file project repository; no browser, Mongo, Yjs or AI inference smoke." }, null, 2))
} finally {
  if (child && child.exitCode === null) child.kill()
  await new Promise<void>((done) => http.close(() => done()))
  await rm(dir, { recursive: true, force: true })
}
