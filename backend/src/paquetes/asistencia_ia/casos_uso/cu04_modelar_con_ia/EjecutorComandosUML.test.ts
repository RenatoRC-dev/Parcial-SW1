import { describe, expect, it } from "vitest"
import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import { ErrorPlanCambiosUML, ejecutarComandosUML } from "./EjecutorComandosUML.js"
import { validarPlanCambiosUML } from "./validarPlanCambiosUML.js"

const modeloBase: ModeloUMLCanonicoIA = {
  id: "modelo",
  nombre: "Modelo",
  version: "4.2.0",
  clases: [
    { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [{ id: "nombre", nombre: "nombre", tipo: "String", visibilidad: "privada" }] },
    { id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 450, y: 100 }, atributos: [] },
  ],
  relaciones: [{ id: "r1", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" }],
}

function ejecutar(comandos: ComandoModeloUML[]) {
  let contador = 0
  return ejecutarComandosUML(modeloBase, comandos, (categoria) => `${categoria}-${++contador}`)
}

describe("EjecutorComandosUML backend", () => {
  it("crea una clase con id estable generado por la aplicación", () => {
    const resultado = ejecutar([{ tipo: "crear_clase", refTemporal: "tmp_factura", nombre: "Factura", abstracta: false }])
    expect(resultado.clases.at(-1)).toMatchObject({ id: "clase-1", nombre: "Factura" })
  })

  it("agrega un atributo por id canónico y preserva contenido no relacionado", () => {
    const resultado = ejecutar([{ tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_correo", nombre: "correo", tipoDato: "String", visibilidad: "privada" }])
    expect(resultado.clases[0].atributos.at(-1)).toMatchObject({ id: "atributo-1", nombre: "correo", tipo: "String" })
    expect(resultado.clases[1]).toEqual(modeloBase.clases[1])
  })

  it("renombra una clase existente", () => {
    expect(ejecutar([{ tipo: "renombrar_clase", claseId: "cliente", nuevoNombre: "Persona" }]).clases[0].nombre).toBe("Persona")
  })

  it("la eliminación explícita de clase limpia relaciones colgantes", () => {
    const resultado = ejecutar([{ tipo: "eliminar_clase", claseId: "cliente" }])
    expect(resultado.clases.map((clase) => clase.id)).toEqual(["pedido"])
    expect(resultado.relaciones).toEqual([])
  })

  it("agrega varios atributos secuencialmente", () => {
    const resultado = ejecutar([
      { tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_correo", nombre: "correo", tipoDato: "String", visibilidad: "privada" },
      { tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_edad", nombre: "edad", tipoDato: "Integer", visibilidad: "privada" },
    ])
    expect(resultado.clases[0].atributos.map((atributo) => atributo.nombre)).toEqual(["nombre", "correo", "edad"])
  })

  it("resuelve una clase temporal para atributo y relación", () => {
    const resultado = ejecutar([
      { tipo: "crear_clase", refTemporal: "tmp_factura", nombre: "Factura", abstracta: false },
      { tipo: "agregar_atributo", claseRef: "tmp_factura", refTemporal: "tmp_fecha", nombre: "fecha", tipoDato: "LocalDate", visibilidad: "privada" },
      { tipo: "crear_relacion", refTemporal: "tmp_rel", claseOrigenRef: "cliente", claseDestinoRef: "tmp_factura", tipoRelacion: "asociacion", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "facturas" },
    ])
    const factura = resultado.clases.find((clase) => clase.nombre === "Factura")!
    expect(factura.atributos[0]).toMatchObject({ nombre: "fecha", tipo: "LocalDate" })
    expect(resultado.relaciones.at(-1)).toMatchObject({ claseOrigenId: "cliente", claseDestinoId: factura.id, multiplicidadDestino: "0..*" })
  })

  it("crea asociación entre clases existentes", () => {
    const sinRelaciones = { ...modeloBase, relaciones: [] }
    const resultado = ejecutarComandosUML(sinRelaciones, [{ tipo: "crear_relacion", refTemporal: "tmp_rel", claseOrigenRef: "cliente", claseDestinoRef: "pedido", tipoRelacion: "asociacion", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: null, rolDestino: null }], () => "relacion-nueva")
    expect(resultado.relaciones[0]).toMatchObject({ id: "relacion-nueva", claseOrigenId: "cliente", claseDestinoId: "pedido" })
  })

  it("modifica y elimina atributos", () => {
    const modificado = ejecutar([{ tipo: "modificar_atributo", atributoId: "nombre", nuevoNombre: "nombreCompleto", nuevoTipo: "String", nuevaVisibilidad: "publica" }])
    expect(modificado.clases[0].atributos[0]).toMatchObject({ nombre: "nombreCompleto", visibilidad: "publica" })
    const eliminado = ejecutar([{ tipo: "eliminar_atributo", atributoId: "nombre" }])
    expect(eliminado.clases[0].atributos).toEqual([])
  })

  it("cambia multiplicidades y elimina relaciones", () => {
    const cambiado = ejecutar([{ tipo: "cambiar_multiplicidad", relacionId: "r1", multiplicidadOrigen: "0..1", multiplicidadDestino: "1..*" }])
    expect(cambiado.relaciones[0]).toMatchObject({ multiplicidadOrigen: "0..1", multiplicidadDestino: "1..*" })
    expect(ejecutar([{ tipo: "eliminar_relacion", relacionId: "r1" }]).relaciones).toEqual([])
  })

  it("rechaza ids existentes y referencias temporales no resueltas", () => {
    expect(() => ejecutar([{ tipo: "renombrar_clase", claseId: "inexistente", nuevoNombre: "Otra" }])).toThrow(ErrorPlanCambiosUML)
    expect(() => ejecutar([{ tipo: "agregar_atributo", claseRef: "tmp_inexistente", refTemporal: "tmp_a", nombre: "dato", tipoDato: "String", visibilidad: null }])).toThrow(/No existe la clase/)
  })

  it("rechaza referencias temporales duplicadas", () => {
    expect(() => ejecutar([
      { tipo: "crear_clase", refTemporal: "tmp_x", nombre: "Factura", abstracta: false },
      { tipo: "crear_clase", refTemporal: "tmp_x", nombre: "Detalle", abstracta: false },
    ])).toThrow(/duplicada/)
  })

  it("la validación del plan es atómica y no muta el original", () => {
    const copia = structuredClone(modeloBase)
    expect(() => validarPlanCambiosUML(modeloBase, [
      { tipo: "crear_clase", refTemporal: "tmp_x", nombre: "Factura", abstracta: false },
      { tipo: "renombrar_clase", claseId: "inexistente", nuevoNombre: "Falla" },
    ])).toThrow()
    expect(modeloBase).toEqual(copia)
  })

  it("rechaza nombres de clase duplicados según CU08", () => {
    expect(() => validarPlanCambiosUML(modeloBase, [{ tipo: "crear_clase", refTemporal: "tmp_x", nombre: "Cliente", abstracta: false }])).toThrow(/duplicado/)
  })
})
