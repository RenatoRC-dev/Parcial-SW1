import { afterEach, describe, expect, it, vi } from "vitest"
import { nombreUsuarioActualizado, sqlCrearBasePrueba, verificarActualizacionUsuario } from "./contratoRuntimePostgreSQL.js"

afterEach(() => vi.unstubAllGlobals())

describe("aislamiento de la prueba PostgreSQL", () => {
  it("solo crea una base nueva; PostgreSQL rechazará nombres existentes", () => {
    expect(sqlCrearBasePrueba("sw1_runtime_123")).toBe('CREATE DATABASE "sw1_runtime_123";')
  })
  it.each(["postgres", "backend_generado", "sw1_x\"; DROP DATABASE postgres;--", `sw1_${"a".repeat(60)}`])("rechaza nombre inseguro %s", (database) => {
    expect(() => sqlCrearBasePrueba(database)).toThrow("SW1_PG_TEST_DB")
  })
})

describe("actualización y lectura del Usuario generado", () => {
  it("comprueba PUT y una lectura posterior con la misma identidad y valor", async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json({ id: 7, nombre: nombreUsuarioActualizado }))
    vi.stubGlobal("fetch", fetch)
    await verificarActualizacionUsuario("http://127.0.0.1:18080", 7)
    expect(fetch.mock.calls).toEqual([
      ["http://127.0.0.1:18080/api/usuario/7", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombreUsuarioActualizado }) }],
      ["http://127.0.0.1:18080/api/usuario/7", { method: "GET" }],
    ])
  })
  it.each([
    [500, { id: 7, nombre: nombreUsuarioActualizado }],
    [200, { id: 8, nombre: nombreUsuarioActualizado }],
    [200, { id: 7, nombre: "Usuario Runtime" }],
  ])("no acepta PUT inválido (%s)", async (status, body) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body, { status })))
    await expect(verificarActualizacionUsuario("http://127.0.0.1:18080", 7)).rejects.toThrow()
  })
  it("rechaza una lectura que conserva el valor anterior tras PUT exitoso", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 7, nombre: nombreUsuarioActualizado }))
      .mockResolvedValueOnce(Response.json({ id: 7, nombre: "Usuario Runtime" })))
    await expect(verificarActualizacionUsuario("http://127.0.0.1:18080", 7)).rejects.toThrow("GET Usuario")
  })
})
