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

describe("evaluarAptitudGeneracionSpring", () => {
  it("acepta un modelo válido con entidades independientes", () => {
    const modelo = crearModelo()
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo))).toEqual({ apto: true, motivos: [] })
  })

  it("rechaza errores de validación UML", () => {
    const modelo = crearModelo({ clases: [] })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).apto).toBe(false)
  })

  it("rechaza relaciones aunque CU08 solo emita advertencias", () => {
    const base = crearModelo()
    const modelo = crearModelo({
      clases: [...base.clases, { ...base.clases[0], id: "pedido", nombre: "Pedido" }],
      relaciones: [{ id: "r1", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" }],
    })
    const resultado = evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo))
    expect(resultado.apto).toBe(false)
    expect(resultado.motivos).toContain("La generación de relaciones todavía no está soportada.")
  })

  it("rechaza clases abstractas", () => {
    const modelo = crearModelo({ clases: [{ ...crearModelo().clases[0], abstracta: true }] })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos[0]).toContain("abstracta")
  })

  it("rechaza nombres que colisionan con tipos Java", () => {
    const modelo = crearModelo({ clases: [{ ...crearModelo().clases[0], nombre: "String" }] })
    expect(evaluarAptitudGeneracionSpring(modelo, validarModelo(modelo)).motivos).toContain("El nombre de entidad String entra en conflicto con un tipo Java.")
  })
})
