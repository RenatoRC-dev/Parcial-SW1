import { describe, expect, it } from "vitest"
import { ErrorProveedorVision } from "../ProveedorVisionUML.js"
import { adaptarRespuestaCompactaVision } from "./AdaptadorRespuestaCompactaVision.js"

describe("adaptador de respuesta compacta Groq Vision", () => {
  it("preserva clases y atributos y genera referencias temporales internamente", () => {
    const resultado = adaptarRespuestaCompactaVision({
      c: [["Cliente", [["id", "Long"], ["nombre", "String"]]], ["Factura", [["total", "Double"], ["nota", null]]]],
      r: [],
      w: [],
    }, "vision")
    expect(resultado.resultado).toBe("candidato")
    if (resultado.resultado !== "candidato") return
    expect(resultado.candidato.clases).toEqual([
      { refTemporal: "tmp_clase_1", nombre: "Cliente", atributos: [
        { refTemporal: "tmp_atributo_1_1", nombre: "id", tipoDato: "Long" },
        { refTemporal: "tmp_atributo_1_2", nombre: "nombre", tipoDato: "String" },
      ] },
      { refTemporal: "tmp_clase_2", nombre: "Factura", atributos: [
        { refTemporal: "tmp_atributo_2_1", nombre: "total", tipoDato: "Double" },
        { refTemporal: "tmp_atributo_2_2", nombre: "nota", tipoDato: null },
      ] },
    ])
  })

  it("preserva símbolos de visibilidad explícitos y deja la ausencia para el valor privado al aplicar", () => {
    const resultado = adaptarRespuestaCompactaVision({
      c: [["Cliente", [["codigo", "String", "+"], ["saldo", "Double", "#"], ["interno", "String", "~"], ["nombre", "String", null]]]],
      r: [],
      w: [],
    }, "vision")
    if (resultado.resultado !== "candidato") throw new Error("Se esperaba candidato")
    expect(resultado.candidato.clases[0].atributos).toEqual([
      expect.objectContaining({ nombre: "codigo", visibilidad: "publica" }),
      expect.objectContaining({ nombre: "saldo", visibilidad: "protegida" }),
      expect.objectContaining({ nombre: "interno", visibilidad: "paquete" }),
      expect.objectContaining({ nombre: "nombre" }),
    ])
    expect(resultado.candidato.clases[0].atributos[3]).not.toHaveProperty("visibilidad")
  })

  it("preserva asociaciones, multiplicidades y roles mediante referencias locales", () => {
    const resultado = adaptarRespuestaCompactaVision({
      c: [["Cliente", []], ["Factura", []]],
      r: [["Cliente", "Factura", "1", "0..*", "cliente", "facturas"]],
      w: ["diagrama_parcial"],
    }, "vision")
    if (resultado.resultado !== "candidato") throw new Error("Se esperaba candidato")
    expect(resultado.candidato.relaciones).toEqual([{
      refTemporal: "tmp_relacion_1", tipo: "asociacion", origenRef: "tmp_clase_1", destinoRef: "tmp_clase_2",
      multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "facturas",
    }])
    expect(resultado.candidato.advertencias).toEqual(["El análisis visual puede ser parcial."])
  })

  it.each([
    null,
    {},
    { c: [["Cliente"]], r: [], w: [] },
    { c: [["Cliente", []]], r: [["Cliente", "Ausente", "1", "0..*", null, null]], w: [] },
    { c: [["Cliente", []]], r: [], w: ["codigo_inventado"] },
  ])("rechaza un DTO compacto malformado", (valor) => {
    expect(() => adaptarRespuestaCompactaVision(valor, "vision")).toThrow(ErrorProveedorVision)
  })
})
