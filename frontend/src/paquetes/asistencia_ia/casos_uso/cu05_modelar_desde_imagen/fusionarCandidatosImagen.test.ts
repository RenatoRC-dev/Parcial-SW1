import { describe, expect, it } from "vitest"
import type { CandidatoModeloUMLImagen } from "./CandidatoModeloUMLImagen"
import { fusionarCandidatosImagen } from "./fusionarCandidatosImagen"

const candidato = (nombre: string, atributos: Array<[string, string | null]> = []): CandidatoModeloUMLImagen => ({
  clases: [{ refTemporal: `tmp_${nombre.toLowerCase()}`, nombre, atributos: atributos.map(([nombreAtributo, tipoDato]) => ({
    refTemporal: `tmp_${nombreAtributo.toLowerCase()}`,
    nombre: nombreAtributo,
    tipoDato,
  })) }],
  relaciones: [],
  advertencias: [],
})

describe("fusión progresiva de candidatos CU05", () => {
  it("acumula clases detectadas en imágenes diferentes sin mutar las entradas", () => {
    const primero = candidato("Cliente")
    const segundo = candidato("Factura")
    const resultado = fusionarCandidatosImagen(primero, segundo)
    expect(resultado.clases.map((clase) => clase.nombre)).toEqual(["Cliente", "Factura"])
    expect(primero.clases).toHaveLength(1)
    expect(segundo.clases).toHaveLength(1)
  })

  it("reúne atributos complementarios de la misma clase por nombre normalizado", () => {
    const resultado = fusionarCandidatosImagen(candidato("Factura", [["numero", "String"]]), candidato(" FACTURA ", [["total", "Double"]]))
    expect(resultado.clases).toHaveLength(1)
    expect(resultado.clases[0]?.nombre).toBe("Factura")
    expect(resultado.clases[0]?.atributos.map((atributo) => [atributo.nombre, atributo.tipoDato])).toEqual([
      ["numero", "String"], ["total", "Double"],
    ])
  })

  it("deduplica el mismo atributo y enriquece null con un tipo conocido", () => {
    const repetido = fusionarCandidatosImagen(candidato("Factura", [["numero", "String"]]), candidato("Factura", [["NUMERO", "String"]]))
    expect(repetido.clases[0]?.atributos).toHaveLength(1)
    const enriquecido = fusionarCandidatosImagen(candidato("Factura", [["total", null]]), candidato("Factura", [["total", "Double"]]))
    expect(enriquecido.clases[0]?.atributos[0]?.tipoDato).toBe("Double")
    const noDegradado = fusionarCandidatosImagen(candidato("Factura", [["total", "Double"]]), candidato("Factura", [["total", null]]))
    expect(noDegradado.clases[0]?.atributos[0]?.tipoDato).toBe("Double")
  })

  it("conserva el primer tipo y advierte un conflicto sin reemplazarlo", () => {
    const resultado = fusionarCandidatosImagen(candidato("Factura", [["precio", "Double"]]), candidato("Factura", [["precio", "String"]]))
    expect(resultado.clases[0]?.atributos[0]?.tipoDato).toBe("Double")
    expect(resultado.advertencias).toContain("Factura.precio fue detectado con tipos diferentes: Double / String.")
  })

  it("deduplica una asociación repetida incluso si llega con extremos invertidos", () => {
    const base: CandidatoModeloUMLImagen = {
      clases: [candidato("Cliente").clases[0]!, candidato("Factura").clases[0]!],
      relaciones: [{ refTemporal: "tmp_r1", tipo: "asociacion", origenRef: "tmp_cliente", destinoRef: "tmp_factura", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: null, rolDestino: null }],
      advertencias: [],
    }
    const repetido: CandidatoModeloUMLImagen = {
      clases: [{ ...candidato("Cliente").clases[0]!, refTemporal: "tmp_c2" }, { ...candidato("Factura").clases[0]!, refTemporal: "tmp_f2" }],
      relaciones: [{ refTemporal: "tmp_r2", tipo: "asociacion", origenRef: "tmp_f2", destinoRef: "tmp_c2", multiplicidadOrigen: "0..*", multiplicidadDestino: "1", rolOrigen: "facturas", rolDestino: "cliente" }],
      advertencias: [],
    }
    const resultado = fusionarCandidatosImagen(base, repetido)
    expect(resultado.relaciones).toHaveLength(1)
    expect(resultado.relaciones[0]).toMatchObject({ rolOrigen: "cliente", rolDestino: "facturas" })
  })

  it("advierte multiplicidades incompatibles y conserva las primeras", () => {
    const base: CandidatoModeloUMLImagen = {
      clases: [candidato("Cliente").clases[0]!, candidato("Factura").clases[0]!],
      relaciones: [{ refTemporal: "tmp_r1", tipo: "asociacion", origenRef: "tmp_cliente", destinoRef: "tmp_factura", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: null, rolDestino: null }],
      advertencias: [],
    }
    const conflicto = structuredClone(base)
    conflicto.relaciones[0]!.multiplicidadDestino = "1..*"
    const resultado = fusionarCandidatosImagen(base, conflicto)
    expect(resultado.relaciones[0]?.multiplicidadDestino).toBe("0..*")
    expect(resultado.advertencias.some((aviso) => aviso.includes("Cliente / Factura") && aviso.includes("multiplicidades diferentes"))).toBe(true)
  })
})
