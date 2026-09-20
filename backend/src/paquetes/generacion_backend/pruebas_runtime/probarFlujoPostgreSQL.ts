import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { dirname, join, resolve } from "node:path"
import JSZip from "jszip"
import { fixtureUsuarioRol } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureClaseAsociativa.js"
import { crearAplicacionGeneracionBackend } from "../api/ServidorGeneracionBackend.js"

interface EvidenciaRuntime {
  database: string
  postgresVersion?: string
  postgresReachable: boolean
  mavenBuildSuccess: boolean
  springStarted: boolean
  tablesVerified: boolean
  associativeClassGenerated: boolean
  compositePrimaryKeyVerified: boolean
  compositePrimaryKeyColumnCount: number
  usuarioForeignKeyVerified: boolean
  rolForeignKeyVerified: boolean
  noSurrogateIdVerified: boolean
  usuarioCreated: boolean
  rolCreated: boolean
  usuarioRolCreated: boolean
  usuarioRolReadByCompositeId: boolean
  usuarioRolDeleted: boolean
  blocked?: boolean
  reason?: string
}

const host = process.env.SW1_PG_HOST ?? "127.0.0.1"
const port = process.env.SW1_PG_PORT ?? "5432"
const user = process.env.SW1_PG_USER ?? "postgres"
const password = process.env.SW1_PG_PASSWORD
const adminDatabase = process.env.SW1_PG_ADMIN_DB ?? "postgres"
const testDatabase = process.env.SW1_PG_TEST_DB ?? "sw1_asociativa_patch_b"
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
  associativeClassGenerated: false,
  compositePrimaryKeyVerified: false,
  compositePrimaryKeyColumnCount: 0,
  usuarioForeignKeyVerified: false,
  rolForeignKeyVerified: false,
  noSurrogateIdVerified: false,
  usuarioCreated: false,
  rolCreated: false,
  usuarioRolCreated: false,
  usuarioRolReadByCompositeId: false,
  usuarioRolDeleted: false,
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
      body: JSON.stringify(fixtureUsuarioRol),
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
      const response = await fetch(`http://127.0.0.1:${applicationPort}/api/usuario`)
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

    const tables = Number(await psql(testDatabase, "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('usuario','rol','usuario_rol');"))
    if (tables !== 3) throw new Error("El esquema físico no contiene usuario, rol y usuario_rol.")
    evidence.tablesVerified = true
    evidence.associativeClassGenerated = true

    const columns = (await psql(testDatabase, "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='usuario_rol' ORDER BY column_name;")).split(/\s+/).filter(Boolean)
    if (columns.includes("id")) throw new Error("usuario_rol contiene un id sustituto no permitido.")
    if (columns.length !== 2 || !columns.includes("usuario_id") || !columns.includes("rol_id")) {
      throw new Error(`Columnas inesperadas en usuario_rol: ${columns.join(", ")}.`)
    }
    evidence.noSurrogateIdVerified = true

    const primaryKeyColumns = (await psql(testDatabase, "SELECT a.attname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, orden) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum WHERE c.contype='p' AND t.relname='usuario_rol' ORDER BY k.orden;")).split(/\s+/).filter(Boolean)
    evidence.compositePrimaryKeyColumnCount = primaryKeyColumns.length
    if (primaryKeyColumns.length !== 2 || !primaryKeyColumns.includes("usuario_id") || !primaryKeyColumns.includes("rol_id")) {
      throw new Error(`PK inesperada en usuario_rol: ${primaryKeyColumns.join(", ")}.`)
    }
    evidence.compositePrimaryKeyVerified = true

    const usuarioForeignKey = Number(await psql(testDatabase, "SELECT count(*) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.constraint_schema=kcu.constraint_schema JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name AND tc.constraint_schema=ccu.constraint_schema WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name='usuario_rol' AND kcu.column_name='usuario_id' AND ccu.table_name='usuario' AND ccu.column_name='id';"))
    const rolForeignKey = Number(await psql(testDatabase, "SELECT count(*) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.constraint_schema=kcu.constraint_schema JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name AND tc.constraint_schema=ccu.constraint_schema WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name='usuario_rol' AND kcu.column_name='rol_id' AND ccu.table_name='rol' AND ccu.column_name='id';"))
    if (usuarioForeignKey !== 1 || rolForeignKey !== 1) throw new Error("No se encontraron las dos FK esperadas de usuario_rol.")
    evidence.usuarioForeignKeyVerified = true
    evidence.rolForeignKeyVerified = true

    const usuario = await requestJson<{ id: number }>("/api/usuario", "POST", { nombre: "Usuario Runtime" }, 201)
    if (!Number.isInteger(usuario.id)) throw new Error("POST Usuario no devolvió un id entero.")
    evidence.usuarioCreated = true
    const rol = await requestJson<{ id: number }>("/api/rol", "POST", { nombre: "Rol Runtime" }, 201)
    if (!Number.isInteger(rol.id)) throw new Error("POST Rol no devolvió un id entero.")
    evidence.rolCreated = true

    const usuarioRol = await requestJson<{ id: { usuarioId: number; rolId: number }; usuario: { id: number }; rol: { id: number } }>("/api/usuarioRol", "POST", {
      usuario: { id: usuario.id }, rol: { id: rol.id },
    }, 201)
    if (usuarioRol.id?.usuarioId !== usuario.id || usuarioRol.id?.rolId !== rol.id) throw new Error("POST UsuarioRol no devolvió la identidad compuesta esperada.")
    evidence.usuarioRolCreated = true

    const rutaCompuesta = `/api/usuarioRol/${usuario.id}/${rol.id}`
    const recuperado = await requestJson<typeof usuarioRol>(rutaCompuesta, "GET", undefined, 200)
    if (recuperado.id.usuarioId !== usuario.id || recuperado.id.rolId !== rol.id || recuperado.usuario.id !== usuario.id || recuperado.rol.id !== rol.id) {
      throw new Error("GET UsuarioRol no preservó ambos componentes de identidad y relaciones.")
    }
    evidence.usuarioRolReadByCompositeId = true

    await deleteRequest(rutaCompuesta)
    const remaining = Number(await psql(testDatabase, `SELECT count(*) FROM usuario_rol WHERE usuario_id=${usuario.id} AND rol_id=${rol.id};`))
    if (remaining !== 0) throw new Error("DELETE UsuarioRol no eliminó la fila asociativa.")
    evidence.usuarioRolDeleted = true
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
