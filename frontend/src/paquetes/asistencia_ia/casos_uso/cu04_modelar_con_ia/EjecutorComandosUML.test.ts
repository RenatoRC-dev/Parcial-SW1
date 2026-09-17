import { describe, expect, it } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { ejecutarComandosUML } from "./EjecutorComandosUML"

const modelo: ModeloUMLCanonico = {
  id: "modelo", nombre: "Modelo", version: "4.2.0",
  clases: [
    { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [{ id: "nombre", nombre: "nombre", tipo: "String" }] },
    { id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 450, y: 100 }, atributos: [] },
  ],
  relaciones: [{ id: "r1", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" }],
}

function generador() {
  let numero = 0
  return (categoria: "clase" | "atributo" | "relacion") => `${categoria}-${++numero}`
}

describe("EjecutorComandosUML frontend", () => {
  it("ejecuta secuencialmente y resuelve referencias temporales", () => {
    const resultado = ejecutarComandosUML(modelo, [
      { tipo: "crear_clase", refTemporal: "tmp_factura", nombre: "Factura", abstracta: false },
      { tipo: "agregar_atributo", claseRef: "tmp_factura", refTemporal: "tmp_fecha", nombre: "fecha", tipoDato: "LocalDate", visibilidad: "privada" },
      { tipo: "crear_relacion", refTemporal: "tmp_rel", claseOrigenRef: "cliente", claseDestinoRef: "tmp_factura", tipoRelacion: "asociacion", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "facturas" },
    ], generador())
    const factura = resultado.clases.find((clase) => clase.nombre === "Factura")!
    expect(factura.id).toBe("clase-1")
    expect(factura.atributos[0]).toMatchObject({ id: "atributo-2", nombre: "fecha" })
    expect(resultado.relaciones.at(-1)).toMatchObject({ id: "relacion-3", claseDestinoId: "clase-1", multiplicidadDestino: "0..*" })
  })

  it("preserva elementos no relacionados", () => {
    const resultado = ejecutarComandosUML(modelo, [{ tipo: "renombrar_clase", claseId: "cliente", nuevoNombre: "Persona" }], generador())
    expect(resultado.clases[1]).toEqual(modelo.clases[1])
    expect(resultado.relaciones).toEqual(modelo.relaciones)
  })

  it("elimina relaciones colgantes al eliminar una clase", () => {
    const resultado = ejecutarComandosUML(modelo, [{ tipo: "eliminar_clase", claseId: "cliente" }], generador())
    expect(resultado.relaciones).toEqual([])
  })

  it("modifica y elimina atributos y relaciones", () => {
    const resultado = ejecutarComandosUML(modelo, [
      { tipo: "modificar_atributo", atributoId: "nombre", nuevoNombre: "nombreCompleto", nuevoTipo: "String", nuevaVisibilidad: "privada" },
      { tipo: "cambiar_multiplicidad", relacionId: "r1", multiplicidadOrigen: "0..1", multiplicidadDestino: "1..*" },
    ], generador())
    expect(resultado.clases[0].atributos[0].nombre).toBe("nombreCompleto")
    expect(resultado.relaciones[0].multiplicidadDestino).toBe("1..*")
    expect(ejecutarComandosUML(modelo, [{ tipo: "eliminar_atributo", atributoId: "nombre" }, { tipo: "eliminar_relacion", relacionId: "r1" }], generador())).toMatchObject({ relaciones: [], clases: [expect.objectContaining({ atributos: [] }), expect.anything()] })
  })

  it("un plan inválido no muta el modelo original", () => {
    const copia = structuredClone(modelo)
    expect(() => ejecutarComandosUML(modelo, [
      { tipo: "crear_clase", refTemporal: "tmp_x", nombre: "Factura", abstracta: false },
      { tipo: "renombrar_clase", claseId: "ausente", nuevoNombre: "Falla" },
    ], generador())).toThrow()
    expect(modelo).toEqual(copia)
  })
})
