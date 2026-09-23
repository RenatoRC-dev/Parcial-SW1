import { afterEach, describe, expect, it, vi } from "vitest"
import { construirUrlBackend, obtenerUbicacionBackend } from "./BackendRemoto"

afterEach(() => vi.unstubAllEnvs())

describe("configuración remota del backend", () => {
  it("conserva rutas relativas para el proxy local", () => {
    vi.stubEnv("VITE_API_BASE_URL", "")
    expect(construirUrlBackend("/api/health")).toBe("/api/health")
    expect(obtenerUbicacionBackend({ protocol: "http:", host: "localhost:5173" }))
      .toEqual({ protocol: "http:", host: "localhost:5173" })
  })

  it("centraliza HTTPS y el host usado por WebSocket en producción", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://nexocase-backend.onrender.com/")
    expect(construirUrlBackend("/api/proyectos"))
      .toBe("https://nexocase-backend.onrender.com/api/proyectos")
    expect(obtenerUbicacionBackend({ protocol: "https:", host: "frontend.example" }))
      .toEqual({ protocol: "https:", host: "nexocase-backend.onrender.com" })
  })
})
