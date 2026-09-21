import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { join, resolve } from "node:path"
import { fixtureClienteProducto } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureClienteProducto.js"
import { generarProyectoSpring } from "../casos_uso/cu09_generar_backend_spring_boot/GeneradorSpringBoot.js"

const host = process.env.SW1_PG_HOST ?? "127.0.0.1"
const postgresPort = process.env.SW1_PG_PORT ?? "5432"
const user = process.env.SW1_PG_USER ?? "postgres"
const password = process.env.SW1_PG_PASSWORD
const adminDatabase = process.env.SW1_PG_ADMIN_DB ?? "postgres"
const database = process.env.SW1_PG_SYNC_DB ?? "sw1_flutter_sync"
const applicationPort = 18082
const output = resolve("generated-test-output", "flutter-sync-proof")
const project = join(output, "backend-generado")
const evidencePath = join(output, "runtime-evidence.json")

const evidence = {
  generatedBackend: project,
  database,
  routes: ["POST /api/cliente", "POST /api/producto"],
  postgresReachable: false,
  mavenBuildSuccess: false,
  springStarted: false,
  clienteCreated: false,
  productoCreated: false,
  clienteRowVerified: false,
  productoRowVerified: false,
  blocked: false,
  reason: undefined as string | undefined,
}

async function persistEvidence() {
  await mkdir(output, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")
}

async function execute(command: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env, windowsHide: true })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (data: Buffer) => { stdout += data.toString() })
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString() })
    child.once("error", rejectPromise)
    child.once("exit", (code) => code === 0
      ? resolvePromise(stdout.trim())
      : rejectPromise(new Error(`${command} terminó con código ${code}: ${stderr.trim() || stdout.trim()}`)))
  })
}

async function psql(target: string, sql: string): Promise<string> {
  return execute(
    "psql",
    ["-h", host, "-p", postgresPort, "-U", user, "-d", target, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
    undefined,
    { ...process.env, PGPASSWORD: password }
  )
}

async function runMaven(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return process.platform === "win32"
    ? execute("cmd.exe", ["/d", "/s", "/c", ".\\mvnw.cmd", ...args], project, env)
    : execute("./mvnw", args, project, env)
}

async function waitForSpring(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Spring terminó con código ${child.exitCode}.`)
    try {
      if ((await fetch(`http://127.0.0.1:${applicationPort}/api/cliente`)).ok) return
    } catch { /* sigue iniciando */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
  }
  throw new Error("Spring no inició dentro de 120 segundos.")
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${applicationPort}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (response.status !== 201) throw new Error(`${path} respondió ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return
  if (process.platform === "win32") {
    await execute("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"]).catch(() => undefined)
  } else child.kill("SIGTERM")
}

async function ensurePortAvailable(): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const server = createServer()
    server.once("error", rejectPromise)
    server.listen(applicationPort, "127.0.0.1", () => server.close((error) => error ? rejectPromise(error) : resolvePromise()))
  })
}

async function main() {
  await rm(output, { recursive: true, force: true })
  await mkdir(project, { recursive: true })
  await execute("pg_isready", ["-h", host, "-p", postgresPort])
  evidence.postgresReachable = true
  await generarProyectoSpring(fixtureClienteProducto, project)
  await runMaven(["clean", "test"])
  evidence.mavenBuildSuccess = true
  if (!password) {
    evidence.blocked = true
    evidence.reason = "SW1_PG_PASSWORD no está configurada."
    await persistEvidence()
    throw new Error("POSTGRESQL SYNC PROOF BLOCKED: configure SW1_PG_PASSWORD.")
  }
  if (!/^sw1_[a-z0-9_]+$/.test(database)) throw new Error("Nombre de base de prueba inseguro.")

  await psql(adminDatabase, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`)
  await psql(adminDatabase, `CREATE DATABASE "${database}";`)
  await ensurePortAvailable()
  const springEnvironment = {
    ...process.env,
    DB_URL: `jdbc:postgresql://${host}:${postgresPort}/${database}`,
    DB_USERNAME: user,
    DB_PASSWORD: password,
    SERVER_PORT: String(applicationPort),
  }
  const spring = process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", ".\\mvnw.cmd", "spring-boot:run"], { cwd: project, env: springEnvironment, windowsHide: true })
    : spawn("./mvnw", ["spring-boot:run"], { cwd: project, env: springEnvironment })
  try {
    await waitForSpring(spring)
    evidence.springStarted = true
    const cliente = await post<{ id: number; nombre: string; correo: string }>("/api/cliente", { nombre: "Ana", correo: "ana@correo.com" })
    const producto = await post<{ id: number; nombre: string; precio: number }>("/api/producto", { nombre: "Laptop", precio: 3500 })
    evidence.clienteCreated = Number.isInteger(cliente.id) && cliente.nombre === "Ana" && cliente.correo === "ana@correo.com"
    evidence.productoCreated = Number.isInteger(producto.id) && producto.nombre === "Laptop" && producto.precio === 3500
    evidence.clienteRowVerified = Number(await psql(database, `SELECT count(*) FROM cliente WHERE id=${cliente.id} AND nombre='Ana' AND correo='ana@correo.com';`)) === 1
    evidence.productoRowVerified = Number(await psql(database, `SELECT count(*) FROM producto WHERE id=${producto.id} AND nombre='Laptop' AND precio=3500;`)) === 1
    if (!evidence.clienteCreated || !evidence.productoCreated || !evidence.clienteRowVerified || !evidence.productoRowVerified) {
      throw new Error("La evidencia REST/PostgreSQL no cumplió todas las condiciones.")
    }
    await persistEvidence()
    console.log(JSON.stringify(evidence, null, 2))
  } finally {
    await stop(spring)
  }
}

main().catch(async (error) => {
  evidence.reason = error instanceof Error ? error.message : String(error)
  await persistEvidence()
  console.error(evidence.reason)
  process.exitCode = 1
})
