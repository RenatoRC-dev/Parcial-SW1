import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { evaluarAptitudGeneracionSpring } from "./EvaluadorAptitudGeneracionSpring"

function crearModelo(cambios: Partial<ModeloUMLCanonico> = {}): ModeloUMLCanonico {
  return {
    id: "modelo", nombre: "Modelo", version: "1.0.0",
    clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 10, y: 20 }, atributos: [{ id: "nombre", nombre: "nombre", tipo: "String" }] }],
    relaciones: [], ...cambios,
  }
}

function crearModeloRelacionado(
  cambiosRelacion: Partial<ModeloUMLCanonico["relaciones"][number]> = {}
): ModeloUMLCanonico {
  const base = crearModelo()
  return crearModelo({
    clases: [
      ...base.clases,
      { id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 100, y: 20 }, atributos: [{ id: "fecha", nombre: "fecha", tipo: "LocalDate" }] },
    ],
    relaciones: [{
      id: "r1", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido",
      multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "pedidos",
      ...cambiosRelacion,
    }],
  })
}

describe("evaluarAptitudGeneracionSpring", () => {
  it("acepta un modelo válido con entidades independientes", () => {
    const modelo = crearModelo()
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo))).toEqual({ apto: true, motivos: [] })
  })

  it("rechaza errores de validación UML", () => {
    const modelo = crearModelo({ clases: [] })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).apto).toBe(false)
  })

  it("acepta una asociación 1 a 0..*", () => {
    const modelo = crearModeloRelacionado()
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo))).toEqual({ apto: true, motivos: [] })
  })

  it("acepta la orientación invertida 0..* a 1", () => {
    const modelo = crearModeloRelacionado({
      claseOrigenId: "pedido", claseDestinoId: "cliente",
      multiplicidadOrigen: "0..*", multiplicidadDestino: "1",
      rolOrigen: "pedidos", rolDestino: "cliente",
    })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).apto).toBe(true)
  })

  it("rechaza multiplicidades no soportadas", () => {
    const modelo = crearModeloRelacionado({ multiplicidadDestino: "1" })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos[0]).toContain("multiplicidades 1 y 0..*")
  })

  it("rechaza asociación muchos a muchos 0..* a 0..*", () => {
    const modelo = crearModeloRelacionado({
      multiplicidadOrigen: "0..*",
      multiplicidadDestino: "0..*",
    })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).apto).toBe(false)
  })

  it.each(["agregacion", "composicion", "generalizacion"] as const)(
    "rechaza relaciones %s",
    (tipo) => {
      const modelo = crearModeloRelacionado({ tipo })
      expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).apto).toBe(false)
    }
  )

  it("rechaza relaciones autorreferentes", () => {
    const modelo = crearModeloRelacionado({ claseDestinoId: "cliente" })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos[0]).toContain("autorreferente")
  })

  it("rechaza colisiones entre atributos y campos de relación", () => {
    const modelo = crearModeloRelacionado()
    modelo.clases[1].atributos.push({ id: "cliente-campo", nombre: "cliente", tipo: "String" })
    const resultado = evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo))
    expect(resultado.apto).toBe(false)
    expect(resultado.motivos).toContain("El campo de relación cliente colisiona en Pedido.")
  })

  it("rechaza colisiones entre campos de relaciones distintas", () => {
    const modelo = crearModeloRelacionado()
    modelo.relaciones.push({ ...modelo.relaciones[0], id: "r2" })
    const resultado = evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo))
    expect(resultado.apto).toBe(false)
    expect(resultado.motivos).toContain("El campo de relación cliente colisiona en Pedido.")
  })

  it("rechaza clases abstractas", () => {
    const modelo = crearModelo({ clases: [{ ...crearModelo().clases[0], abstracta: true }] })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos[0]).toContain("abstracta")
  })

  it("rechaza nombres que colisionan con tipos Java", () => {
    const modelo = crearModelo({ clases: [{ ...crearModelo().clases[0], nombre: "String" }] })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos).toContain("El nombre de entidad String entra en conflicto con un tipo Java.")
  })

  it("rechaza ids canónicos duplicados mediante CU08", () => {
    const modelo = crearModeloRelacionado()
    modelo.clases[1].id = modelo.clases[0].id
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).apto).toBe(false)
  })

  it("separa un borrador UML editable de la aptitud Spring cuando falta el tipo", () => {
    const modelo = crearModelo({ clases: [{ ...crearModelo().clases[0], atributos: [{ id: "nombre", nombre: "nombre", tipo: null }] }] })
    const validacion = validarModelo(modelo)
    const aptitud = evaluarAptitudGeneracionSpring(modelo, validacion)

    expect(validacion.valido).toBe(true)
    expect(aptitud.apto).toBe(false)
    expect(aptitud.motivos.join(" ")).toContain("Cliente.nombre")
  })

  it("mantiene editable un tipo conceptual y lo bloquea sólo para generación", () => {
    const modelo = crearModelo({ clases: [{ ...crearModelo().clases[0], atributos: [{ id: "saldo", nombre: "saldo", tipo: "Money" }] }] })
    expect(validarModelo(modelo).valido).toBe(true)
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos.join(" ")).toContain("Cliente.saldo (Money)")
  })
})
