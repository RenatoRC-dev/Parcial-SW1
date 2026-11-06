import { beforeEach, describe, expect, it, vi } from "vitest"
import { abrirProyecto, crearProyecto, guardarModeloProyecto, registrarActividadIntegracion, registrarActividadModelado, unirseProyecto } from "./clienteProyectos"

const respuesta = (cuerpo: unknown) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } }))

describe("cliente HTTP de proyectos autorizados", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("envía nombre de proyecto y participante al crear", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => respuesta({}))
    await crearProyecto("Ventas", "Renato")
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ nombre: "Ventas", nombreParticipante: "Renato" })
  })

  it("envía código y participante al unirse", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => respuesta({}))
    await unirseProyecto("NX-2345-6789-ABCD", "Carlos")
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ codigoAcceso: "NX-2345-6789-ABCD", nombreParticipante: "Carlos" })
  })

  it("usa Bearer al abrir y Bearer más revisionBase al guardar", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => respuesta({}))
    await abrirProyecto("proyecto-1", "credencial-opaca")
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer credencial-opaca")

    const modelo = { id: "m", nombre: "Modelo", version: "4.2.0", clases: [], relaciones: [] }
    await guardarModeloProyecto("proyecto-1", "credencial-opaca", modelo, 7)
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe("Bearer credencial-opaca")
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ modelo, revisionBase: 7 })
  })

  it("reporta actividad manual con Bearer y clientChangeId sin campos de autoría", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => respuesta({}))
    await registrarActividadModelado("proyecto-1", "credencial-opaca", "11111111-1111-4111-8111-111111111111", {
      tipo: "UML_ELEMENT_CREATED", elemento: { id: "venta", tipo: "class", nombreSnapshot: "Venta" },
    })
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/proyectos/proyecto-1/actividad/modelado")
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer credencial-opaca")
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      clientChangeId: "11111111-1111-4111-8111-111111111111",
      tipo: "UML_ELEMENT_CREATED", elemento: { id: "venta", tipo: "class", nombreSnapshot: "Venta" },
    })
  })
  it("reporta integraciones CU05/XMI por la ruta protegida", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => respuesta({}))
    await registrarActividadIntegracion("proyecto-1", "credencial-opaca", "22222222-2222-4222-8222-222222222222", {
      mecanismo: "xmi", tipo: "XMI_IMPORTED", elemento: null,
    })
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/proyectos/proyecto-1/actividad/integracion")
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer credencial-opaca")
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      clientChangeId: "22222222-2222-4222-8222-222222222222", mecanismo: "xmi", tipo: "XMI_IMPORTED", elemento: null,
    })
  })
})
