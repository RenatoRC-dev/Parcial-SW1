import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { cargarConfiguracionEntorno } from "./cargarConfiguracionEntorno.js"

const originales = { ...process.env }

afterEach(() => {
  for (const nombre of Object.keys(process.env)) delete process.env[nombre]
  Object.assign(process.env, originales)
})

describe("cargarConfiguracionEntorno", () => {
  it("preserva el entorno existente, carga .env y elimina opcionales vacías", async () => {
    const directorio = await mkdtemp(join(tmpdir(), "sw1-env-"))
    const ruta = join(directorio, ".env")
    try {
      await writeFile(ruta, "GROQ_MODEL=modelo-del-archivo\nGROQ_VISION_MODEL=qwen/prueba\nSW1_PROJECTS_DIR=   \n")
      process.env.GROQ_MODEL = "modelo-del-proceso"
      cargarConfiguracionEntorno(ruta)
      expect(process.env.GROQ_MODEL).toBe("modelo-del-proceso")
      expect(process.env.GROQ_VISION_MODEL).toBe("qwen/prueba")
      expect(process.env.SW1_PROJECTS_DIR).toBeUndefined()
    } finally {
      await rm(directorio, { recursive: true, force: true })
    }
  })

  it("rechaza un PORT explícito inválido", async () => {
    process.env.PORT = "no-es-puerto"
    expect(() => cargarConfiguracionEntorno(join(tmpdir(), "sw1-env-ausente"))).toThrow("PORT debe ser un entero")
  })
})
