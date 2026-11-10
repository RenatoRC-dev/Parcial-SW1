import { describe, expect, it } from "vitest"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"
import { evaluarAptitudGeneracionSpring, prepararProyectoSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import { validarPlanCambiosUML } from "./validarPlanCambiosUML.js"
import { ejecutarComandosUML } from "./EjecutorComandosUML.js"

function modelo(): ModeloUMLCanonicoIA {
  return { id: "m", nombre: "Modelo", version: "1", relaciones: [], clases: [
    { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] },
    { id: "venta", nombre: "Venta", abstracta: false, posicion: { x: 100, y: 0 }, atributos: [] },
  ] }
}

describe("F8-S4 validez UML frente a aptitud Spring", () => {
  it.each([
    { id: "saldo", nombre: "saldo", tipo: "Money" },
    { id: "pendiente", nombre: "pendiente", tipo: null },
    { id: "identificador", nombre: "id", tipo: "UUID" },
  ])("CU04 conserva el atributo conceptual existente $nombre:$tipo al editar otra clase", (atributo) => {
    const entrada = modelo()
    entrada.clases[0].atributos = [atributo]
    const copia = structuredClone(entrada)
    expect(validarModelo(entrada).valido).toBe(true)
    expect(evaluarAptitudGeneracionSpring(entrada).apto).toBe(false)
    expect(() => validarPlanCambiosUML(entrada, [{ tipo: "renombrar_clase", claseId: "venta", nuevoNombre: "Compra" }])).not.toThrow()
    expect(entrada).toEqual(copia)
  })

  it.each<ComandoModeloUML>([
    { tipo: "crear_relacion", refTemporal: "tmp_r", tipoRelacion: "asociacion", claseOrigenRef: "cliente", claseDestinoRef: "venta", cantidadOrigenPorDestino: "1", cantidadDestinoPorOrigen: "1", rolOrigen: null, rolDestino: null },
    { tipo: "crear_relacion", refTemporal: "tmp_r", tipoRelacion: "generalizacion", subclaseRef: "venta", superclaseRef: "cliente" },
  ])("CU04 permite diseño válido fuera de Spring ($tipoRelacion)", (comando) => {
    const entrada = modelo()
    expect(() => validarPlanCambiosUML(entrada, [comando])).not.toThrow()
    const resultado = ejecutarComandosUML(entrada, [comando], () => "r_nueva")
    expect(validarModelo(resultado).valido).toBe(true)
    expect(evaluarAptitudGeneracionSpring(resultado).apto).toBe(false)
  })

  it.each<ComandoModeloUML>([
    { tipo: "renombrar_clase", claseId: "venta", nuevoNombre: "Cliente" },
    { tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_a", nombre: "class", tipoDato: "String", visibilidad: "privada" },
    { tipo: "agregar_atributo", claseRef: "inexistente", refTemporal: "tmp_a", nombre: "nombre", tipoDato: "String", visibilidad: "privada" },
    { tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_a", nombre: "saldo", tipoDato: "Money", visibilidad: "privada" },
    { tipo: "crear_metodo", claseRef: "cliente", refTemporal: "tmp_m", nombre: "calcular", tipoRetorno: "Money", visibilidad: "publica", parametros: [] },
  ])("rechaza cambios inválidos o fuera del canal IA sin mutar ($tipo)", (comando) => {
    const entrada = modelo()
    const copia = structuredClone(entrada)
    expect(() => validarPlanCambiosUML(entrada, [comando])).toThrow()
    expect(entrada).toEqual(copia)
  })

  it("acepta el borrador vacío y la eliminación validada de la última clase, pero no genera Spring vacío", () => {
    const entrada = modelo()
    entrada.clases.splice(1)
    expect(() => validarPlanCambiosUML(entrada, [{ tipo: "eliminar_clase", claseId: "cliente" }])).not.toThrow()
    const vacio = { ...entrada, clases: [] }
    expect(validarModelo(vacio)).toEqual({ valido: true, diagnosticos: [] })
    expect(evaluarAptitudGeneracionSpring(vacio).apto).toBe(false)
    expect(() => prepararProyectoSpring(vacio)).toThrow()
  })

  it("CU09 rechaza firmas inválidas aunque sus campos persistentes sean generables", () => {
    const entrada = modelo()
    entrada.clases[0].metodos = [{ id: "m1", nombre: "calcular", visibilidad: "publica", tipoRetorno: "Money", parametros: [] }]
    expect(validarModelo(entrada).valido).toBe(false)
    expect(() => prepararProyectoSpring(entrada)).toThrow(/retorno/)
  })

  it("rechaza colisiones de IDs al simular CU04", () => {
    const entrada = modelo()
    entrada.clases[0].atributos.push({ id: "validacion-atributo-1", nombre: "nombre", tipo: "String" })
    expect(() => validarPlanCambiosUML(entrada, [{ tipo: "agregar_atributo", claseRef: "venta", refTemporal: "tmp_a", nombre: "total", tipoDato: "Double", visibilidad: "privada" }])).toThrow(/duplicado/)
    expect(entrada.clases[1].atributos).toEqual([])
  })

  it("no disfraza errores de programación como falta de aptitud", () => {
    expect(() => evaluarAptitudGeneracionSpring(null as unknown as ModeloUMLCanonicoIA)).toThrow(TypeError)
  })
})
