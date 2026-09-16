import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { dirname, join, resolve } from "node:path"
import JSZip from "jszip"
import { fixtureClientePedido } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureClientePedido.js"
import { crearAplicacionGeneracionBackend } from "../api/ServidorGeneracionBackend.js"

interface EvidenciaRuntime {
  database: string
  postgresVersion?: string
  postgresReachable: boolean
  mavenBuildSuccess: boolean
  springStarted: boolean
  tablesVerified: boolean
  foreignKeyVerified: boolean
  clienteCreated: boolean
  pedidoCreated: boolean
  pedidoRead: boolean
  pedidoUpdated: boolean
  pedidoDeleted: boolean
  blocked?: boolean
  reason?: string
}

const host = process.env.SW1_PG_HOST ?? "127.0.0.1"
const port = process.env.SW1_PG_PORT ?? "5432"
const user = process.env.SW1_PG_USER ?? "postgres"
const password = process.env.SW1_PG_PASSWORD
const adminDatabase = process.env.SW1_PG_ADMIN_DB ?? "postgres"
const testDatabase = process.env.SW1_PG_TEST_DB ?? "sw1_iteracion07"
const applicationPort = 18080
const outputDirectory = resolve("generated-test-output", "postgres-proof")
const evidencePath = join(outputDirectory, "runtime-evidence.json")
const zipPath = join(outputDirectory, "backend-generado.zip")
const extractionDirectory = join(outputDirectory, "extraido")
const projectDirectory = join(extractionDirectory, "backend-generado")

const evidence: EvidenciaRuntime = {
  database: testDatabase,
  postgresReachable: false,
  mavenBuildSuccess: false,
  springStarted: false,
  tablesVerified: false,
  foreignKeyVerified: false,
  clienteCreated: false,
  pedidoCreated: false,
  pedidoRead: false,
  pedidoUpdated: false,
  pedidoDeleted: false,
}

async function persistEvidence() {
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")
}

async function execute(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const processChild = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
    })
    let output = ""
    let errors = ""
    processChild.stdout.on("data", (data: Buffer) => { output += data.toString() })
    processChild.stderr.on("data", (data: Buffer) => { errors += data.toString() })
    processChild.once("error", rejectPromise)
    processChild.once("exit", (code) => {
      if (code === 0) resolvePromise(output.trim())
      else rejectPromise(new Error(`${command} terminó con código ${code}: ${errors.trim() || output.trim()}`))
    })
  })
}

function postgresEnvironment(): NodeJS.ProcessEnv {
  return { ...process.env, PGPASSWORD: password }
}

async function psql(database: string, sql: string): Promise<string> {
  return execute(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
    { env: postgresEnvironment() }
  )
}

async function verifyPortAvailable(): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const server = createServer()
    server.once("error", () => rejectPromise(new Error(`El puerto ${applicationPort} no está disponible.`)))
    server.listen(applicationPort, "127.0.0.1", () => server.close((error) => error ? rejectPromise(error) : resolvePromise()))
  })
}

async function generateThroughRealHttp(): Promise<void> {
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(extractionDirectory, { recursive: true })
  const server = crearAplicacionGeneracionBackend().listen(0, "127.0.0.1")
  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.once("listening", resolvePromise)
      server.once("error", rejectPromise)
    })
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("No se obtuvo el puerto de la API CASE.")
    const response = await fetch(`http://127.0.0.1:${address.port}/api/generacion/spring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixtureClientePedido),
    })
    if (!response.ok) throw new Error(`La API CASE respondió ${response.status}: ${await response.text()}`)
    const content = Buffer.from(await response.arrayBuffer())
    await writeFile(zipPath, content)
    const zip = await JSZip.loadAsync(content)
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      if (!name.startsWith("backend-generado/") || name.includes("..")) {
        throw new Error(`Entrada ZIP inesperada: ${name}`)
      }
      const destination = join(extractionDirectory, ...name.split("/"))
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, await entry.async("nodebuffer"))
    }
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) => server.close((error) => error ? rejectPromise(error) : resolvePromise()))
  }
}

async function runMaven(args: string[]): Promise<string> {
  if (process.platform === "win32") {
    return execute("cmd.exe", ["/d", "/s", "/c", "mvnw.cmd", ...args], { cwd: projectDirectory })
  }
  return execute("./mvnw", args, { cwd: projectDirectory })
}

async function waitForApplication(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Spring terminó antes de estar listo con código ${child.exitCode}.`)
    try {
      const response = await fetch(`http://127.0.0.1:${applicationPort}/api/cliente`)
      if (response.status === 200) return
    } catch {
      // La aplicación todavía está iniciando.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
  }
  throw new Error("Spring no estuvo disponible dentro de 120 segundos.")
}

async function stopApplication(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return
  if (process.platform === "win32") {
    await execute("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"]).catch(() => undefined)
  } else {
    child.kill("SIGTERM")
  }
}

async function requestJson<T>(path: string, method: string, body: unknown, expectedStatus: number): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${applicationPort}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path} respondió ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

async function deleteRequest(path: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${applicationPort}${path}`, { method: "DELETE" })
  if (response.status !== 204) throw new Error(`DELETE ${path} respondió ${response.status}: ${await response.text()}`)
}

async function main(): Promise<void> {
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(outputDirectory, { recursive: true })

  await execute("psql", ["--version"])
  await execute("pg_isready", ["-h", host, "-p", port])
  evidence.postgresReachable = true

  if (!password) {
    evidence.blocked = true
    evidence.reason = "SW1_PG_PASSWORD no está configurada."
    await persistEvidence()
    throw new Error("POSTGRESQL RUNTIME PROOF BLOCKED: configure SW1_PG_PASSWORD.")
  }
  if (!/^sw1_[a-z0-9_]+$/.test(testDatabase)) {
    throw new Error("SW1_PG_TEST_DB debe comenzar con sw1_ y contener solo minúsculas, números o guion bajo.")
  }
  if (["postgres", "backend_generado"].includes(testDatabase)) {
    throw new Error("El nombre de base de prueba está reservado y no puede eliminarse.")
  }

  evidence.postgresVersion = await psql(adminDatabase, "select version();")
  await psql(adminDatabase, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDatabase}' AND pid <> pg_backend_pid();`)
  await psql(adminDatabase, `DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE);`)
  await psql(adminDatabase, `CREATE DATABASE "${testDatabase}";`)
  await generateThroughRealHttp()
  await runMaven(["clean", "test"])
  evidence.mavenBuildSuccess = true
  await verifyPortAvailable()

  const springEnvironment = {
    ...process.env,
    DB_URL: `jdbc:postgresql://${host}:${port}/${testDatabase}`,
    DB_USERNAME: user,
    DB_PASSWORD: password,
    SERVER_PORT: String(applicationPort),
  }
  const spring = process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", "mvnw.cmd", "spring-boot:run"], { cwd: projectDirectory, env: springEnvironment, windowsHide: true })
    : spawn("./mvnw", ["spring-boot:run"], { cwd: projectDirectory, env: springEnvironment })
  let springOutput = ""
  spring.stdout.on("data", (data: Buffer) => { springOutput = `${springOutput}${data.toString()}`.slice(-12_000) })
  spring.stderr.on("data", (data: Buffer) => { springOutput = `${springOutput}${data.toString()}`.slice(-12_000) })

  try {
    await waitForApplication(spring).catch((error) => {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${springOutput}`)
    })
    evidence.springStarted = true

    const tables = Number(await psql(testDatabase, "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('cliente','pedido');"))
    const nullable = await psql(testDatabase, "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='pedido' AND column_name='cliente_id';")
    const foreignKey = Number(await psql(testDatabase, "SELECT count(*) FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid WHERE c.contype='f' AND child.relname='pedido' AND parent.relname='cliente' AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (cliente_id) REFERENCES cliente(id)%';"))
    if (tables !== 2 || nullable !== "NO") throw new Error("El esquema físico no contiene las tablas o cliente_id NOT NULL esperados.")
    if (foreignKey < 1) throw new Error("No se encontró la FK pedido.cliente_id → cliente.id.")
    evidence.tablesVerified = true
    evidence.foreignKeyVerified = true

    const cliente = await requestJson<{ id: number }>("/api/cliente", "POST", {
      nombre: "Cliente Iteracion 07",
      email: "iteracion07@sw1.local",
    }, 201)
    if (!Number.isInteger(cliente.id)) throw new Error("POST Cliente no devolvió un id entero.")
    evidence.clienteCreated = true

    const pedido = await requestJson<{ id: number; fecha: string; cliente: { id: number } }>("/api/pedido", "POST", {
      fecha: "2026-09-16",
      cliente: { id: cliente.id },
    }, 201)
    if (!Number.isInteger(pedido.id)) throw new Error("POST Pedido no devolvió un id entero.")
    evidence.pedidoCreated = true
    const storedForeignKey = Number(await psql(testDatabase, `SELECT cliente_id FROM pedido WHERE id=${pedido.id};`))
    if (storedForeignKey !== cliente.id) throw new Error("El valor físico de pedido.cliente_id no coincide con Cliente.")

    const readPedido = await requestJson<{ id: number; fecha: string; cliente: { id: number } }>(`/api/pedido/${pedido.id}`, "GET", undefined, 200)
    if (readPedido.id !== pedido.id || readPedido.fecha !== "2026-09-16" || readPedido.cliente.id !== cliente.id) {
      throw new Error("GET Pedido no preservó id, fecha y relación Cliente.")
    }
    evidence.pedidoRead = true

    const updatedPedido = await requestJson<{ fecha: string; cliente: { id: number } }>(`/api/pedido/${pedido.id}`, "PUT", {
      fecha: "2026-09-17",
      cliente: { id: cliente.id },
    }, 200)
    if (updatedPedido.fecha !== "2026-09-17" || updatedPedido.cliente.id !== cliente.id) {
      throw new Error("PUT Pedido no actualizó la fecha o perdió la relación Cliente.")
    }
    evidence.pedidoUpdated = true

    await deleteRequest(`/api/pedido/${pedido.id}`)
    const remaining = Number(await psql(testDatabase, `SELECT count(*) FROM pedido WHERE id=${pedido.id};`))
    if (remaining !== 0) throw new Error("DELETE Pedido no eliminó la fila física.")
    evidence.pedidoDeleted = true
    await persistEvidence()
    console.log(`Prueba PostgreSQL completada. Evidencia: ${evidencePath}`)
  } finally {
    await stopApplication(spring)
  }
}

main().catch(async (error) => {
  if (!evidence.reason) evidence.reason = error instanceof Error ? error.message : String(error)
  await persistEvidence()
  console.error(evidence.reason)
  process.exitCode = 1
})
