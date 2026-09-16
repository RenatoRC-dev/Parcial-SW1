import { describe, expect, it } from "vitest"
import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"
import { fixtureClientePedido } from "./fixtureClientePedido.js"
import { ErrorModeloNoGenerable, prepararProyectoSpring } from "./PrepararProyectoSpring.js"

function esperarErrorIdentidad(modelo: ModeloUMLCanonicoEntrada, texto: string) {
  expect(() => prepararProyectoSpring(modelo)).toThrow(ErrorModeloNoGenerable)
  expect(() => prepararProyectoSpring(modelo)).toThrow(texto)
}

describe("integridad de ids canónicos en CU09", () => {
  it("rechaza el id de modelo vacío", () => {
    esperarErrorIdentidad({ ...fixtureClientePedido, id: "  " }, "id del modelo es obligatorio")
  })

  it("rechaza ids de clase vacíos o duplicados antes de construir mapas", () => {
    esperarErrorIdentidad({
      ...fixtureClientePedido,
      clases: fixtureClientePedido.clases.map((clase, indice) => indice === 0 ? { ...clase, id: " " } : clase),
    }, "no tiene id")
    esperarErrorIdentidad({
      ...fixtureClientePedido,
      clases: fixtureClientePedido.clases.map((clase, indice) => indice === 1 ? { ...clase, id: "cliente" } : clase),
    }, "Id de clase duplicado: cliente")
  })

  it("rechaza ids de atributo vacíos o duplicados en todo el modelo", () => {
    esperarErrorIdentidad({
      ...fixtureClientePedido,
      clases: fixtureClientePedido.clases.map((clase, indice) => indice === 0
        ? { ...clase, atributos: [{ ...clase.atributos[0], id: " " }, ...clase.atributos.slice(1)] }
        : clase),
    }, "no tiene id")
    esperarErrorIdentidad({
      ...fixtureClientePedido,
      clases: fixtureClientePedido.clases.map((clase, indice) => indice === 1
        ? { ...clase, atributos: [{ ...clase.atributos[0], id: "nombre" }] }
        : clase),
    }, "Id de atributo duplicado: nombre")
  })

  it("rechaza ids de relación vacíos o duplicados", () => {
    esperarErrorIdentidad({
      ...fixtureClientePedido,
      relaciones: [{ ...fixtureClientePedido.relaciones[0], id: " " }],
    }, "relación no tiene id")
    esperarErrorIdentidad({
      ...fixtureClientePedido,
      relaciones: [
        fixtureClientePedido.relaciones[0],
        { ...fixtureClientePedido.relaciones[0] },
      ],
    }, "Id de relación duplicado")
  })

  it("permite el mismo texto de id en namespaces de clase y relación", () => {
    const proyecto = prepararProyectoSpring({
      ...fixtureClientePedido,
      relaciones: [{ ...fixtureClientePedido.relaciones[0], id: "cliente" }],
    })
    expect(proyecto.entidades).toHaveLength(2)
  })
})
