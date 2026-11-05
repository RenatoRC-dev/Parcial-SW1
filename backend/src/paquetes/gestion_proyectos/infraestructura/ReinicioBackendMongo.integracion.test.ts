import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { randomUUID } from "node:crypto"
import { MongoClient } from "mongodb"
import { describe, expect, it } from "vitest"

const uri = process.env.MONGODB_TEST_URI?.trim()
const describeIntegracion = uri ? describe : describe.skip

async function puertoDisponible(): Promise<number> {
  const servidor = createServer()
  await new Promise<void>((resolver, rechazar) => servidor.once("error", rechazar).listen(0, "127.0.0.1", resolver))
  const direccion = servidor.address()
  const puerto = typeof direccion === "object" && direccion ? direccion.port : 0
  await new Promise<void>((resolver) => servidor.close(() => resolver()))
  return puerto
}

async function esperarSalud(base: string, proceso: ChildProcess, diagnostico: () => string): Promise<void> {
  const limite = Date.now() + 15_000
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`El backend terminó antes de iniciar. ${diagnostico()}`)
    try {
      const respuesta = await fetch(`${base}/api/health`)
      if (respuesta.ok) return
    } catch { /* El socket todavía no está disponible. */ }
    await new Promise((resolver) => setTimeout(resolver, 100))
  }
  throw new Error(`El backend no inició dentro del tiempo esperado. ${diagnostico()}`)
}

async function detener(proceso: ChildProcess | null): Promise<void> {
  if (!proceso || proceso.exitCode !== null) return
  proceso.kill("SIGTERM")
  await new Promise<void>((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error("El backend no cerró limpiamente.")), 10_000)
    proceso.once("exit", () => { clearTimeout(limite); resolver() })
  })
}

describeIntegracion("reinicio real del proceso backend con MongoDB", () => {
  it("conserva proyecto, snapshot, revisión y credencial tras detener e iniciar otro proceso", async () => {
    const baseDatos = `nexocase_reinicio_${randomUUID().replaceAll("-", "")}`
    const puerto = await puertoDisponible()
    const base = `http://127.0.0.1:${puerto}`
    let proceso: ChildProcess | null = null
    let salida = ""
    const iniciar = async () => {
      salida = ""
      proceso = spawn(process.execPath, ["--import", "tsx", "src/paquetes/generacion_backend/api/iniciarServidorGeneracionBackend.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(puerto),
          MONGODB_URI: uri!,
          MONGODB_DB_NAME: baseDatos,
          PROJECT_ACCESS_PEPPER: "pepper-reinicio-real-f4-d",
        },
        stdio: ["ignore", "pipe", "pipe"],
      })
      proceso.stdout?.on("data", (datos) => { salida += datos.toString() })
      proceso.stderr?.on("data", (datos) => { salida += datos.toString() })
      await esperarSalud(base, proceso, () => salida)
    }

    const modelo = {
      id: "modelo-reinicio", nombre: "Reinicio", version: "4.2.0",
      clases: [{ id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 5, y: 10 }, atributos: [] }],
      relaciones: [],
    }

    try {
      await iniciar()
      const creadoHttp = await fetch(`${base}/api/proyectos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "Reinicio", nombreParticipante: "Renato" }),
      })
      expect(creadoHttp.status).toBe(201)
      const creado = await creadoHttp.json() as { proyecto: { id: string }; credencial: string }
      const guardado = await fetch(`${base}/api/proyectos/${creado.proyecto.id}/modelo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creado.credencial}` },
        body: JSON.stringify({ modelo, revisionBase: 0 }),
      })
      expect(guardado.status).toBe(200)
      expect((await guardado.json() as { revisionModelo: number }).revisionModelo).toBe(1)

      await detener(proceso)
      proceso = null
      await iniciar()

      const recuperado = await fetch(`${base}/api/proyectos/${creado.proyecto.id}`, {
        headers: { Authorization: `Bearer ${creado.credencial}` },
      })
      expect(recuperado.status).toBe(200)
      const proyecto = await recuperado.json() as { revisionModelo: number; modelo: unknown }
      expect(proyecto.revisionModelo).toBe(1)
      expect(proyecto.modelo).toEqual(modelo)
    } finally {
      await detener(proceso).catch(() => undefined)
      const cliente = new MongoClient(uri!, { serverSelectionTimeoutMS: 5_000 })
      await cliente.connect()
      await cliente.db(baseDatos).dropDatabase()
      await cliente.close()
    }
  }, 30_000)
})
