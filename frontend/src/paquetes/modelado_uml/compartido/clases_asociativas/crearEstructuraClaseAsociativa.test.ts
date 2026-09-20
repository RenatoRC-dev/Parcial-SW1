import { describe, expect, it } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { crearEstructuraClaseAsociativa } from "./crearEstructuraClaseAsociativa"

const modelo: ModeloUMLCanonico = {
  id: "modelo", nombre: "Accesos", version: "4.2.0",
  clases: [
    { id: "usuario", nombre: "Usuario", atributos: [], posicion: { x: 0, y: 0 }, abstracta: false },
    { id: "rol", nombre: "Rol", atributos: [], posicion: { x: 400, y: 0 }, abstracta: false },
  ],
  relaciones: [{
    id: "usuario-rol", tipo: "asociacion", claseOrigenId: "usuario", claseDestinoId: "rol",
    multiplicidadOrigen: "0..*", multiplicidadDestino: "0..*",
  }],
}

const solicitud = {
  nombre: "UsuarioRol",
  claseAId: "usuario",
  claseBId: "rol",
  relacionReemplazadaId: "usuario-rol",
  ids: { clase: "usuario-rol-clase", relacionA: "usuario-asociativa", relacionB: "asociativa-rol" },
}

describe("crearEstructuraClaseAsociativa", () => {
  it("convierte N:M atómicamente sin inventar atributos", () => {
    const resultado = crearEstructuraClaseAsociativa(modelo, solicitud)

    expect(resultado.clases.at(-1)).toMatchObject({
      id: "usuario-rol-clase", nombre: "UsuarioRol", tipoClase: "asociativa", atributos: [], metodos: [],
    })
    expect(resultado.relaciones).toEqual([
      expect.objectContaining({ claseOrigenId: "usuario", claseDestinoId: "usuario-rol-clase", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" }),
      expect.objectContaining({ claseOrigenId: "usuario-rol-clase", claseDestinoId: "rol", multiplicidadOrigen: "0..*", multiplicidadDestino: "1" }),
    ])
    expect(resultado.relaciones.some((relacion) => relacion.id === "usuario-rol")).toBe(false)
    expect(modelo.relaciones).toHaveLength(1)
    expect(modelo.clases).toHaveLength(2)
  })

  it("rechaza un nombre duplicado sin mutar el modelo", () => {
    const original = structuredClone(modelo)
    expect(() => crearEstructuraClaseAsociativa(modelo, { ...solicitud, nombre: "Usuario" })).toThrow(/Ya existe/)
    expect(modelo).toEqual(original)
  })

  it("rechaza una relación que dejó de ser N:M sin aplicar parcialmente", () => {
    const cambiado = { ...modelo, relaciones: [{ ...modelo.relaciones[0], multiplicidadDestino: "1" as const }] }
    const original = structuredClone(cambiado)
    expect(() => crearEstructuraClaseAsociativa(cambiado, solicitud)).toThrow(/ya no está disponible/)
    expect(cambiado).toEqual(original)
  })
})
