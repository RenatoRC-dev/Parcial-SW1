import { describe, expect, it } from "vitest"
import { ESQUEMA_RESPUESTA_GROQ, normalizarRespuestaGroq } from "./EsquemaRespuestaGroq.js"
import { esRespuestaInterpretacionUML } from "../../../casos_uso/cu04_modelar_con_ia/validarPlanCambiosUML.js"

describe("esquema estricto CU04 para Groq", () => {
  it("usa un discriminador exclusivo por alternativa", () => {
    const items = ESQUEMA_RESPUESTA_GROQ.properties.comandos.items.anyOf
    const discriminadores = items.map((item) => item.properties.tipo.const)
    expect(new Set(discriminadores).size).toBe(discriminadores.length)
  })

  it.each([
    ["crear_asociacion", "asociacion", { claseOrigenRef: "cliente", claseDestinoRef: "pedido", cantidadDestinoPorOrigen: "0..*", cantidadOrigenPorDestino: "1", rolOrigen: null, rolDestino: null }],
    ["crear_agregacion", "agregacion", { parteRef: "linea", todoRef: "pedido", cantidadPartesPorTodo: "1..*", cantidadTodosPorParte: "1", rolParte: null, rolTodo: null }],
    ["crear_composicion", "composicion", { parteRef: "linea", todoRef: "pedido", cantidadPartesPorTodo: "1..*", cantidadTodosPorParte: "1", rolParte: null, rolTodo: null }],
    ["crear_generalizacion", "generalizacion", { subclaseRef: "cliente", superclaseRef: "persona" }],
  ] as const)("normaliza %s al contrato interno crear_relacion", (tipo, tipoRelacion, campos) => {
    const respuesta = normalizarRespuestaGroq({
      resultado: "aplicar",
      mensaje: "Relación creada.",
      comandos: [{ tipo, refTemporal: "tmp_relacion", ...campos }],
    })
    expect(respuesta).toMatchObject({ comandos: [{ tipo: "crear_relacion", tipoRelacion }] })
    expect(esRespuestaInterpretacionUML(respuesta)).toBe(true)
  })

  it("no relaja la validación del contrato interno", () => {
    const respuesta = normalizarRespuestaGroq({ resultado: "aplicar", mensaje: "", comandos: [{ tipo: "desconocido" }] })
    expect(esRespuestaInterpretacionUML(respuesta)).toBe(false)
  })
})
