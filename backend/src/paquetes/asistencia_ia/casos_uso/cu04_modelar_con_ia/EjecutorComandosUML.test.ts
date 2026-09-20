import { describe, expect, it } from "vitest"
import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import { ErrorPlanCambiosUML, ejecutarComandosUML } from "./EjecutorComandosUML.js"
import { esComandoModeloUML, validarPlanCambiosUML } from "./validarPlanCambiosUML.js"

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
      { tipo: "crear_relacion", refTemporal: "tmp_rel", claseOrigenRef: "cliente", claseDestinoRef: "tmp_factura", tipoRelacion: "asociacion", cantidadDestinoPorOrigen: "0..*", cantidadOrigenPorDestino: "1", rolOrigen: "cliente", rolDestino: "facturas" },
    ])
    const factura = resultado.clases.find((clase) => clase.nombre === "Factura")!
    expect(factura.atributos[0]).toMatchObject({ nombre: "fecha", tipo: "LocalDate" })
    expect(resultado.relaciones.at(-1)).toMatchObject({ claseOrigenId: "cliente", claseDestinoId: factura.id, multiplicidadDestino: "0..*" })
  })

  it("crea asociación entre clases existentes", () => {
    const sinRelaciones = { ...modeloBase, relaciones: [] }
    const resultado = ejecutarComandosUML(sinRelaciones, [{ tipo: "crear_relacion", refTemporal: "tmp_rel", claseOrigenRef: "cliente", claseDestinoRef: "pedido", tipoRelacion: "asociacion", cantidadDestinoPorOrigen: "0..*", cantidadOrigenPorDestino: "1", rolOrigen: null, rolDestino: null }], () => "relacion-nueva")
    expect(resultado.relaciones[0]).toMatchObject({ id: "relacion-nueva", claseOrigenId: "cliente", claseDestinoId: "pedido" })
  })

  it("crea los cuatro tipos con la misma convención canónica del editor manual", () => {
    const clases = ["Persona", "Auto", "Equipo", "Jugador", "Pedido", "DetallePedido", "Cliente"].map((nombre, indice) => ({
      id: nombre.toLowerCase(), nombre, abstracta: false, posicion: { x: indice * 100, y: 0 }, atributos: [],
    }))
    const base: ModeloUMLCanonicoIA = { id: "relaciones", nombre: "Relaciones", version: "4.2.0", clases, relaciones: [] }
    let secuencia = 0
    const comandos: ComandoModeloUML[] = [
      { tipo: "crear_relacion", refTemporal: "tmp_asociacion", tipoRelacion: "asociacion", claseOrigenRef: "persona", claseDestinoRef: "auto", cantidadDestinoPorOrigen: null, cantidadOrigenPorDestino: null, rolOrigen: null, rolDestino: null },
      { tipo: "crear_relacion", refTemporal: "tmp_agregacion", tipoRelacion: "agregacion", parteRef: "jugador", todoRef: "equipo", cantidadPartesPorTodo: null, cantidadTodosPorParte: null, rolParte: null, rolTodo: null },
      { tipo: "crear_relacion", refTemporal: "tmp_composicion", tipoRelacion: "composicion", parteRef: "detallepedido", todoRef: "pedido", cantidadPartesPorTodo: null, cantidadTodosPorParte: null, rolParte: null, rolTodo: null },
      { tipo: "crear_relacion", refTemporal: "tmp_generalizacion", tipoRelacion: "generalizacion", subclaseRef: "cliente", superclaseRef: "persona" },
    ]
    expect(comandos.every(esComandoModeloUML)).toBe(true)
    const resultado = ejecutarComandosUML(base, comandos, (categoria) => `${categoria}-${++secuencia}`)

    expect(resultado.relaciones).toEqual([
      expect.objectContaining({ tipo: "asociacion", claseOrigenId: "persona", claseDestinoId: "auto", multiplicidadOrigen: null, multiplicidadDestino: null }),
      expect.objectContaining({ tipo: "agregacion", claseOrigenId: "jugador", claseDestinoId: "equipo", multiplicidadOrigen: null, multiplicidadDestino: null }),
      expect.objectContaining({ tipo: "composicion", claseOrigenId: "detallepedido", claseDestinoId: "pedido", multiplicidadOrigen: null, multiplicidadDestino: null }),
      expect.objectContaining({ tipo: "generalizacion", claseOrigenId: "cliente", claseDestinoId: "persona", multiplicidadOrigen: null, multiplicidadDestino: null }),
    ])
  })

  it("rechaza un comando Todo/Parte ambiguo en la frontera estructurada", () => {
    expect(esComandoModeloUML({
      tipo: "crear_relacion",
      refTemporal: "tmp_ambigua",
      tipoRelacion: "agregacion",
      parteRef: "jugador",
    })).toBe(false)
  })

  it.each([
    ["Persona/Auto", "0..*", "1", "1", "0..*"],
    ["Usuario/Perfil", "0..1", "1", "1", "0..1"],
    ["Departamento/Empleado", "1..*", "0..1", "0..1", "1..*"],
  ] as const)("convierte cantidades de negocio %s a extremos UML sin invertirlos", (_caso, destinosPorOrigen, origenesPorDestino, extremoOrigen, extremoDestino) => {
    const sinRelaciones = { ...modeloBase, relaciones: [] }
    const resultado = ejecutarComandosUML(sinRelaciones, [{
      tipo: "crear_relacion", refTemporal: "tmp_rel", claseOrigenRef: "cliente", claseDestinoRef: "pedido",
      tipoRelacion: "asociacion", cantidadDestinoPorOrigen: destinosPorOrigen,
      cantidadOrigenPorDestino: origenesPorDestino, rolOrigen: null, rolDestino: null,
    }], () => "relacion-asimetrica")
    expect(resultado.relaciones[0]).toMatchObject({ multiplicidadOrigen: extremoOrigen, multiplicidadDestino: extremoDestino })
  })

  it("modifica y elimina atributos", () => {
    const modificado = ejecutar([{ tipo: "modificar_atributo", atributoId: "nombre", nuevoNombre: "nombreCompleto", nuevoTipo: "String", nuevaVisibilidad: "publica" }])
    expect(modificado.clases[0].atributos[0]).toMatchObject({ nombre: "nombreCompleto", visibilidad: "publica" })
    const eliminado = ejecutar([{ tipo: "eliminar_atributo", atributoId: "nombre" }])
    expect(eliminado.clases[0].atributos).toEqual([])
  })

  it("crea un método con parámetros y valores controlados", () => {
    const resultado = ejecutar([{
      tipo: "crear_metodo", claseRef: "cliente", refTemporal: "tmp_cobrar", nombre: "cobrar",
      tipoRetorno: "Boolean", visibilidad: "privada",
      parametros: [{ refTemporal: "tmp_monto", nombre: "monto", tipo: "Double" }],
    }])
    expect(resultado.clases[0].metodos).toEqual([{
      id: "metodo-1", nombre: "cobrar", tipoRetorno: "Boolean", visibilidad: "privada",
      parametros: [{ id: "parametro-2", nombre: "monto", tipo: "Double" }],
    }])
  })

  it("modifica y elimina métodos y parámetros sin afectar otros elementos", () => {
    const conMetodo: ModeloUMLCanonicoIA = structuredClone(modeloBase)
    conMetodo.clases[0].metodos = [{ id: "cobrar", nombre: "cobrar", tipoRetorno: "void", visibilidad: "publica", parametros: [{ id: "monto", nombre: "monto", tipo: "Integer" }] }]
    const ejecutarEnModelo = (comandos: ComandoModeloUML[]) => ejecutarComandosUML(conMetodo, comandos, (categoria) => `${categoria}-nuevo`)

    expect(ejecutarEnModelo([{ tipo: "modificar_metodo", metodoId: "cobrar", nuevoNombre: "procesarCobro", nuevoTipoRetorno: "Boolean", nuevaVisibilidad: "privada" }]).clases[0].metodos?.[0]).toMatchObject({ nombre: "procesarCobro", tipoRetorno: "Boolean", visibilidad: "privada" })
    expect(ejecutarEnModelo([{ tipo: "agregar_parametro", metodoId: "cobrar", refTemporal: "tmp_moneda", nombre: "moneda", tipoDato: "String" }]).clases[0].metodos?.[0].parametros).toHaveLength(2)
    expect(ejecutarEnModelo([{ tipo: "modificar_parametro", parametroId: "monto", nuevoNombre: "importe", nuevoTipo: "Double" }]).clases[0].metodos?.[0].parametros[0]).toMatchObject({ nombre: "importe", tipo: "Double" })
    expect(ejecutarEnModelo([{ tipo: "eliminar_parametro", parametroId: "monto" }]).clases[0].metodos?.[0].parametros).toEqual([])
    const eliminado = ejecutarEnModelo([{ tipo: "eliminar_metodo", metodoId: "cobrar" }])
    expect(eliminado.clases[0].metodos).toEqual([])
    expect(eliminado.clases[0].atributos).toEqual(modeloBase.clases[0].atributos)
  })

  it("rechaza un tipo de parámetro no soportado sin mutar el original", () => {
    const copia = structuredClone(modeloBase)
    expect(() => validarPlanCambiosUML(modeloBase, [{
      tipo: "crear_metodo", claseRef: "cliente", refTemporal: "tmp_cobrar", nombre: "cobrar",
      tipoRetorno: "void", visibilidad: "publica",
      parametros: [{ refTemporal: "tmp_monto", nombre: "monto", tipo: "Money" }],
    }])).toThrow(/Tipo de parámetro no soportado/)
    expect(modeloBase).toEqual(copia)
  })

  it("cambia multiplicidades y elimina relaciones", () => {
    const cambiado = ejecutar([{ tipo: "cambiar_multiplicidad", relacionId: "r1", cantidadDestinoPorOrigen: "1..*", cantidadOrigenPorDestino: "0..1" }])
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
