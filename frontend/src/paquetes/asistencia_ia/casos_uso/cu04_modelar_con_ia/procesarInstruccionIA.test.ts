import { describe, expect, it, vi } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { procesarInstruccionIA } from "./procesarInstruccionIA"

const modelo: ModeloUMLCanonico = {
  id: "modelo", nombre: "Modelo", version: "4.2.0",
  clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [] }],
  relaciones: [],
}
const comando = { tipo: "agregar_atributo" as const, claseRef: "cliente", refTemporal: "tmp_correo", nombre: "correo", tipoDato: "String", visibilidad: "privada" as const }

describe("procesarInstruccionIA", () => {
  it("aplica automáticamente un plan válido sin confirmación", async () => {
    const aplicar = vi.fn()
    const resultado = await procesarInstruccionIA({ instruccion: "Agrega correo", obtenerEstado: () => ({ modelo, revision: 1 }), solicitar: vi.fn(async () => ({ resultado: "aplicar" as const, mensaje: "Correo agregado.", comandos: [comando], revision: 1 })), aplicar, alCambiarEstado: vi.fn(), generarId: () => "atributo-correo" })
    expect(resultado.resultado).toBe("aplicado")
    expect(aplicar).toHaveBeenCalledWith(expect.objectContaining({ clases: [expect.objectContaining({ atributos: [expect.objectContaining({ nombre: "correo" })] })] }))
  })

  it.each(["aclarar", "rechazar"] as const)("%s no modifica el modelo", async (tipo) => {
    const aplicar = vi.fn()
    const resultado = await procesarInstruccionIA({ instruccion: "Ambigua", obtenerEstado: () => ({ modelo, revision: 1 }), solicitar: vi.fn(async () => ({ resultado: tipo, mensaje: "Mensaje", comandos: [], revision: 1 })), aplicar, alCambiarEstado: vi.fn() })
    expect(resultado.resultado).toBe(tipo)
    expect(aplicar).not.toHaveBeenCalled()
  })

  it("una revisión obsoleta provoca exactamente un replan automático", async () => {
    let revision = 10
    const solicitar = vi.fn(async () => {
      const respondida = revision
      if (solicitar.mock.calls.length === 1) revision = 11
      return { resultado: "aplicar" as const, mensaje: "Listo", comandos: [comando], revision: respondida }
    })
    const aplicar = vi.fn()
    const resultado = await procesarInstruccionIA({ instruccion: "Agrega correo", obtenerEstado: () => ({ modelo, revision }), solicitar, aplicar, alCambiarEstado: vi.fn(), generarId: () => "atributo-correo" })
    expect(solicitar).toHaveBeenCalledTimes(2)
    expect(resultado.resultado).toBe("aplicado")
    expect(aplicar).toHaveBeenCalledOnce()
  })

  it("un segundo cambio de revisión impide aplicar un plan obsoleto", async () => {
    let revision = 10
    const solicitar = vi.fn(async () => {
      const respondida = revision
      revision += 1
      return { resultado: "aplicar" as const, mensaje: "Listo", comandos: [comando], revision: respondida }
    })
    const aplicar = vi.fn()
    const resultado = await procesarInstruccionIA({ instruccion: "Agrega correo", obtenerEstado: () => ({ modelo, revision }), solicitar, aplicar, alCambiarEstado: vi.fn() })
    expect(solicitar).toHaveBeenCalledTimes(2)
    expect(resultado.resultado).toBe("error")
    expect(aplicar).not.toHaveBeenCalled()
  })

  it("un error de API no modifica el modelo", async () => {
    const aplicar = vi.fn()
    await expect(procesarInstruccionIA({ instruccion: "Agrega correo", obtenerEstado: () => ({ modelo, revision: 1 }), solicitar: vi.fn(async () => { throw new Error("sin servicio") }), aplicar, alCambiarEstado: vi.fn() })).rejects.toThrow("sin servicio")
    expect(aplicar).not.toHaveBeenCalled()
  })
})
