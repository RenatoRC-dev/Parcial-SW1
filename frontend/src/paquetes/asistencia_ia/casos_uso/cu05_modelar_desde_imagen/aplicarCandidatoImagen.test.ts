import { describe, expect, it } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { aplicarCandidatoImagen, ErrorIntegracionCandidato } from "./aplicarCandidatoImagen"
import type { CandidatoModeloUMLImagen } from "./CandidatoModeloUMLImagen"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"

const vacio: ModeloUMLCanonico = { id: "modelo", nombre: "Modelo", version: "4.2.0", clases: [], relaciones: [] }
const candidato: CandidatoModeloUMLImagen = {
  clases: [
    { refTemporal: "tmp_cliente", nombre: "Cliente", atributos: [{ refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: "String" }] },
    { refTemporal: "tmp_pedido", nombre: "Pedido", atributos: [] },
  ],
  relaciones: [{ refTemporal: "tmp_r", tipo: "asociacion", origenRef: "tmp_cliente", destinoRef: "tmp_pedido", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "pedidos" }],
  advertencias: [],
}

function ids() {
  let indice = 0
  return (categoria: "clase" | "atributo" | "relacion") => `${categoria}-${++indice}`
}

describe("aplicación atómica de candidato de imagen", () => {
  it("genera ids, posiciones y asociación de forma controlada", () => {
    const resultado = aplicarCandidatoImagen(vacio, candidato, ids())
    expect(resultado.clases.map((clase) => clase.id)).toEqual(["clase-1", "clase-3"])
    expect(resultado.clases[0]?.atributos[0]).toMatchObject({ id: "atributo-2", nombre: "nombre", tipo: "String", visibilidad: "privada" })
    expect(resultado.clases.map((clase) => clase.posicion)).toEqual([{ x: 100, y: 100 }, { x: 450, y: 100 }])
    expect(resultado.relaciones[0]).toMatchObject({ id: "relacion-4", claseOrigenId: "clase-1", claseDestinoId: "clase-3", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" })
  })

  it("es aditivo y coloca el grupo a la derecha del modelo actual", () => {
    const actual = { ...vacio, clases: [{ id: "x", nombre: "Existente", abstracta: false, posicion: { x: 700, y: 20 }, atributos: [] }] }
    const resultado = aplicarCandidatoImagen(actual, { ...candidato, relaciones: [] }, ids())
    expect(resultado.clases[0]).toEqual(actual.clases[0])
    expect(resultado.clases[1]?.posicion.x).toBe(1050)
  })

  it("bloquea colisiones de nombre sin modificar el original", () => {
    const actual = { ...vacio, clases: [{ id: "x", nombre: "cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }] }
    expect(() => aplicarCandidatoImagen(actual, candidato, ids())).toThrow(ErrorIntegracionCandidato)
    expect(actual.clases).toHaveLength(1)
    expect(actual.clases[0]?.atributos).toEqual([])
  })

  it("importa el subconjunto válido sin inventar tipos ni perder otras semánticas", () => {
    const mixto = structuredClone(candidato)
    mixto.clases[0]!.atributos.push(
      { refTemporal: "tmp_sin_tipo", nombre: "observacion", tipoDato: null },
      { refTemporal: "tmp_money", nombre: "saldo", tipoDato: "Money" },
    )
    const originalAntes = structuredClone(vacio)
    const candidatoAntes = structuredClone(mixto)

    const resultado = aplicarCandidatoImagen(vacio, mixto, ids())

    expect(mixto.clases[0]?.atributos).toContainEqual({ refTemporal: "tmp_sin_tipo", nombre: "observacion", tipoDato: null })
    expect(resultado.clases[0]?.atributos).toEqual([{ id: "atributo-2", nombre: "nombre", tipo: "String", visibilidad: "privada" }])
    expect(resultado.clases[0]?.atributos.some((atributo) => atributo.tipo === "String" && atributo.nombre === "observacion")).toBe(false)
    expect(resultado.clases[0]?.atributos.some((atributo) => atributo.nombre === "saldo")).toBe(false)
    expect(resultado.clases).toHaveLength(2)
    expect(resultado.clases[1]?.id).toBe("clase-3")
    expect(resultado.relaciones).toHaveLength(1)
    expect(resultado.relaciones[0]?.id).toBe("relacion-4")
    expect(validarModelo(resultado).valido).toBe(true)
    expect(vacio).toEqual(originalAntes)
    expect(mixto).toEqual(candidatoAntes)
  })

  it("importa el identificador visual explícito id Long sin reservarlo ni cambiarlo", () => {
    const conId: CandidatoModeloUMLImagen = {
      clases: [{ refTemporal: "tmp_factura", nombre: "Factura", atributos: [
        { refTemporal: "tmp_id", nombre: "id", tipoDato: "Long" },
        { refTemporal: "tmp_numero", nombre: "numero", tipoDato: "String" },
      ] }],
      relaciones: [], advertencias: [],
    }
    const resultado = aplicarCandidatoImagen(vacio, conId, ids())
    expect(resultado.clases[0].atributos).toEqual([
      { id: "atributo-2", nombre: "id", tipo: "Long", visibilidad: "privada" },
      { id: "atributo-3", nombre: "numero", tipo: "String", visibilidad: "privada" },
    ])
    expect(validarModelo(resultado).valido).toBe(true)
  })

  it("preserva visibilidad explícita del candidato visual", () => {
    const explicito: CandidatoModeloUMLImagen = {
      clases: [{ refTemporal: "tmp_cliente", nombre: "Cliente", atributos: [
        { refTemporal: "tmp_publico", nombre: "codigo", tipoDato: "String", visibilidad: "publica" },
        { refTemporal: "tmp_protegido", nombre: "saldo", tipoDato: "Double", visibilidad: "protegida" },
      ] }],
      relaciones: [], advertencias: [],
    }
    const resultado = aplicarCandidatoImagen(vacio, explicito, ids())
    expect(resultado.clases[0].atributos).toEqual([
      expect.objectContaining({ nombre: "codigo", visibilidad: "publica" }),
      expect.objectContaining({ nombre: "saldo", visibilidad: "protegida" }),
    ])
  })

  it("rechaza id con tipo String sin repararlo ni mutar candidato/modelo", () => {
    const conIdInvalido: CandidatoModeloUMLImagen = {
      clases: [{ refTemporal: "tmp_factura", nombre: "Factura", atributos: [{ refTemporal: "tmp_id", nombre: "id", tipoDato: "String" }] }],
      relaciones: [], advertencias: [],
    }
    const candidatoAntes = structuredClone(conIdInvalido)
    const modeloAntes = structuredClone(vacio)
    expect(() => aplicarCandidatoImagen(vacio, conIdInvalido, ids())).toThrow(/debe utilizar el tipo Long/)
    expect(conIdInvalido).toEqual(candidatoAntes)
    expect(vacio).toEqual(modeloAntes)
  })

  it("rechaza extremos internos inválidos sin mutación parcial", () => {
    const invalido = structuredClone(candidato)
    invalido.relaciones[0]!.destinoRef = "tmp_ausente"
    expect(() => aplicarCandidatoImagen(vacio, invalido, ids())).toThrow(/extremos inválidos/)
    expect(vacio.relaciones).toEqual([])
  })
})
