import { afterEach, describe, expect, it, vi } from "vitest"
import { obtenerRuntimeXmi } from "./AdaptadorCrunchUML.js"

afterEach(() => vi.unstubAllEnvs())
describe("resolución del runtime XMI real", () => {
  it("resuelve el paquete instalado con el mismo Python y respeta las rutas explícitas", async () => {
    const runtime = await obtenerRuntimeXmi()
    expect(runtime.crunch).toBeTruthy()
    vi.stubEnv("SW1_PYTHON_PATH", runtime.python)
    vi.stubEnv("SW1_CRUNCH_UML_PATH", runtime.crunch)
    expect(await obtenerRuntimeXmi()).toEqual(runtime)
  })
  it("no oculta una ruta Crunch explícita incorrecta con el paquete instalado", async () => {
    vi.stubEnv("SW1_CRUNCH_UML_PATH", `/nexocase-ruta-inexistente-${crypto.randomUUID()}`)
    await expect(obtenerRuntimeXmi()).rejects.toMatchObject({ tipo: "configuracion", message: expect.stringContaining("SW1_CRUNCH_UML_PATH") })
  })
  it("no cambia de Python si el intérprete explícito no está disponible", async () => {
    vi.stubEnv("SW1_PYTHON_PATH", `/nexocase-python-inexistente-${crypto.randomUUID()}`)
    vi.stubEnv("SW1_CRUNCH_UML_PATH", "")
    await expect(obtenerRuntimeXmi()).rejects.toMatchObject({ tipo: "configuracion", message: expect.stringContaining("SW1_PYTHON_PATH") })
  })
})
