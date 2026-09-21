import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContextoAsistente, MensajeConversacionContextual } from "./ContextoAsistente"
import { consultarAsistenteContextual, ErrorConsultaContextual } from "./consultarAsistenteContextual"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Ventas" },
  area: "modelado_uml",
  idioma: "es",
  revisionModelo: 7,
  modeloActual: {
    id: "m", nombre: "Ventas", version: "1", truncado: false,
    clases: [{ id: "factura", nombre: "Factura", tipoClase: "normal", abstracta: false, atributos: [{ nombre: "total", tipo: "Double", visibilidad: "privada" }], operaciones: [] }],
    relaciones: [],
  },
  elementoSeleccionado: { tipo: "clase", id: "factura", nombre: "Factura", tipoClase: "normal", abstracta: false, atributos: [{ nombre: "total", tipo: "Double", visibilidad: "privada" }], operaciones: [], relacionesConectadas: [] },
  elementosRelevantes: [],
  resumenModelo: { clases: 1, relaciones: 0 },
  estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: ["Revisar total"] },
  generacion: { estado: "apto", bloqueos: [], advertencias: ["Regla mínima"] },
  cambiosSinGuardar: true,
  candidatoImagenPendiente: false,
  accionesDisponibles: ["NINGUNA", "ENFOCAR_ELEMENTO", "IR_A_GENERACION"],
}

afterEach(() => vi.unstubAllGlobals())

describe("consultarAsistenteContextual", () => {
  it("envía el modelo actual, selección, estados y solamente ocho mensajes recientes", async () => {
    const fetch = vi.fn(async (_entrada: RequestInfo | URL, _opciones?: RequestInit) => new Response(JSON.stringify({ respuesta: "Lista.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO" }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetch)
    const conversacion: MensajeConversacionContextual[] = Array.from({ length: 12 }, (_, indice) => ({ rol: indice % 2 === 0 ? "usuario" : "asistente", contenido: `mensaje-${indice}` }))

    await consultarAsistenteContextual("¿Y ahora?", contexto, conversacion)

    const cuerpo = JSON.parse(String(fetch.mock.calls[0][1]?.body))
    expect(cuerpo.contexto.modeloActual.clases[0].atributos[0]).toEqual(expect.objectContaining({ nombre: "total", tipo: "Double" }))
    expect(cuerpo.contexto.elementoSeleccionado).toEqual(expect.objectContaining({ tipo: "clase", nombre: "Factura" }))
    expect(cuerpo.contexto.estadoUml.advertencias).toEqual(["Revisar total"])
    expect(cuerpo.contexto.generacion).toEqual(expect.objectContaining({ estado: "apto", advertencias: ["Regla mínima"] }))
    expect(cuerpo.conversacion).toHaveLength(8)
    expect(cuerpo.conversacion[0].contenido).toBe("mensaje-4")
  })

  it.each([
    [429, "limite"],
    [503, "no_disponible"],
    [502, "respuesta_invalida"],
  ] as const)("conserva el tipo controlado para HTTP %s", async (estado, tipo) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Mensaje seguro", tipo }), { status: estado, headers: { "Content-Type": "application/json" } })))
    await expect(consultarAsistenteContextual("Pregunta", contexto, [])).rejects.toEqual(expect.objectContaining<Partial<ErrorConsultaContextual>>({ tipo, message: "Mensaje seguro" }))
  })
})
