import { describe, expect, it } from "vitest"
import { esCandidatoModeloUMLImagen, esResultadoVisionUML } from "./validarCandidatoModeloUML.js"

function candidato() {
  return {
    clases: [
      { refTemporal: "tmp_cliente", nombre: "Cliente", atributos: [{ refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: null }] },
      { refTemporal: "tmp_pedido", nombre: "Pedido", atributos: [] },
    ],
    relaciones: [{ refTemporal: "tmp_r", tipo: "asociacion", origenRef: "tmp_cliente", destinoRef: "tmp_pedido", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "pedidos" }],
    advertencias: [],
  }
}

describe("validación del candidato visual CU05", () => {
  it("acepta el perfil soportado y conserva tipos desconocidos como null", () => {
    expect(esCandidatoModeloUMLImagen(candidato())).toBe(true)
    expect(esResultadoVisionUML({ resultado: "candidato", mensaje: "ok", modelo: "fake", candidato: candidato() })).toBe(true)
  })

  it("conserva honestamente id Long e id String en el candidato sin autoreparación", () => {
    const conTipo = (tipoDato: string) => ({
      clases: [{ refTemporal: "tmp_factura", nombre: "Factura", atributos: [{ refTemporal: "tmp_id", nombre: "id", tipoDato }] }],
      relaciones: [], advertencias: [],
    })
    expect(esCandidatoModeloUMLImagen(conTipo("Long"))).toBe(true)
    expect(esCandidatoModeloUMLImagen(conTipo("String"))).toBe(true)
    expect(conTipo("String").clases[0].atributos[0].tipoDato).toBe("String")
  })

  it.each([
    ["clases duplicadas", () => ({ ...candidato(), clases: [...candidato().clases, { refTemporal: "tmp_otro", nombre: "cliente", atributos: [] }] })],
    ["atributos duplicados", () => ({ ...candidato(), clases: [{ ...candidato().clases[0], atributos: [{ refTemporal: "a", nombre: "dato", tipoDato: "String" }, { refTemporal: "b", nombre: "DATO", tipoDato: "String" }] }] })],
    ["extremo inexistente", () => ({ ...candidato(), relaciones: [{ ...candidato().relaciones[0], destinoRef: "tmp_inexistente" }] })],
    ["multiplicidad inválida", () => ({ ...candidato(), relaciones: [{ ...candidato().relaciones[0], multiplicidadDestino: "*" }] })],
    ["tipo de relación no soportado", () => ({ ...candidato(), relaciones: [{ ...candidato().relaciones[0], tipo: "generalizacion" }] })],
  ])("rechaza %s", (_nombre, crear) => {
    expect(esCandidatoModeloUMLImagen(crear())).toBe(false)
  })
})
