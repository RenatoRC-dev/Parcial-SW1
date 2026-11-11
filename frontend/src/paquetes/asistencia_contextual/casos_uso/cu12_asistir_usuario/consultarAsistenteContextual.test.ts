import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContextoAsistente } from "./ContextoAsistente"
import { cargarMensajesColaborativos, combinarMensajes, consultarAsistenteContextual, descargarArchivoFlujo, ErrorConsultaContextual } from "./consultarAsistenteContextual"

const contexto: ContextoAsistente = {
  proyecto: { id: "p", nombre: "Ventas" }, area: "modelado_uml", idioma: "es", revisionModelo: 7,
  modeloActual: { id: "m", nombre: "Ventas", version: "1", truncado: false,
    clases: [{ id: "factura", nombre: "Factura", tipoClase: "normal", abstracta: false, atributos: [{ nombre: "total", tipo: "Double", visibilidad: "privada" }], operaciones: [] }], relaciones: [] },
  elementoSeleccionado: { tipo: "clase", id: "factura", nombre: "Factura", tipoClase: "normal", abstracta: false, atributos: [], operaciones: [], relacionesConectadas: [] },
  elementosRelevantes: [], resumenModelo: { clases: 1, relaciones: 0 },
  estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: ["Revisar total"] },
  generacion: { estado: "apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: true,
  candidatoImagenPendiente: false, accionesDisponibles: ["NINGUNA", "ENFOCAR_ELEMENTO"],
}

afterEach(() => vi.unstubAllGlobals())

describe("cliente del asistente colaborativo", () => {
  it("transporta texto, archivo, modelo y revisión en una única petición autenticada", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ kind: "workflow" })))
    vi.stubGlobal("fetch", fetch)
    const archivo = new File(["<XMI/>"], "modelo.xmi", { type: "application/xml" })
    const modelo = { id: "m", nombre: "M", version: "1", clases: [], relaciones: [] }
    await consultarAsistenteContextual("p", "cred", "id", "Importa este XMI", contexto, modelo, 9, archivo)
    const opciones = fetch.mock.calls[0][1]!
    expect(opciones.headers).toEqual({ Authorization: "Bearer cred" })
    expect(opciones.body).toBeInstanceOf(FormData)
    const datos = opciones.body as FormData
    expect(JSON.parse(String(datos.get("turno")))).toMatchObject({ requestId: "id", contenido: "Importa este XMI", modeloEjecucion: modelo, revisionEditor: 9 })
    expect((datos.get("archivo") as File).name).toBe("modelo.xmi")
    expect(fetch).toHaveBeenCalledOnce()
  })

  it("descarga el binario autorizado mediante Blob sin interpretar URLs del modelo", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("ZIP bytes", { headers: { "Content-Type": "application/zip" } }))
    vi.stubGlobal("fetch", fetch)
    const crear = vi.fn((_blob: Blob) => "blob:zip")
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: crear })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    await descargarArchivoFlujo("p", "cred", { requestId: "id", sourceMessageId: "h", participantId: "u", revision: 0, estado: "ready", operacion: "generar_spring", resumen: "Listo", advertencias: [], archivo: { nombre: "backend-generado.zip", mime: "application/zip" } })
    expect(String(fetch.mock.calls[0][0])).toContain("/turnos/id/archivo")
    expect(fetch.mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer cred" })
    expect(crear).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce()
    click.mockRestore()
  })
  it("envía Bearer, requestId, foco y solo la vista actual acotada", async () => {
    const fetch = vi.fn(async (_entrada: RequestInfo | URL, _opciones?: RequestInit) => new Response(JSON.stringify({ mensajeHumano: {}, mensajeIA: {} }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetch)
    await consultarAsistenteContextual("proyecto-1", "secreto-opaco", "11111111-1111-4111-8111-111111111111", "¿Y ahora?", contexto)
    const [url, opciones] = fetch.mock.calls[0]
    expect(String(url)).toContain("/api/proyectos/proyecto-1/asistente-colaborativo/interactuar")
    expect(opciones?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer secreto-opaco" }))
    const cuerpo = JSON.parse(String(opciones?.body))
    expect(cuerpo).toEqual(expect.objectContaining({ requestId: "11111111-1111-4111-8111-111111111111", contenido: "¿Y ahora?", foco: { elementoId: "factura" } }))
    expect(cuerpo.vistaActual.modeloActual.clases[0].nombre).toBe("Factura")
    expect(cuerpo).not.toHaveProperty("conversacion")
  })

  it("carga historial paginado con autorización", async () => {
    const fetch = vi.fn(async (_entrada: RequestInfo | URL, _opciones?: RequestInit) => new Response(JSON.stringify({ items: [], siguienteCursor: null }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetch)
    await cargarMensajesColaborativos("p", "cred", "cursor seguro")
    expect(String(fetch.mock.calls[0][0])).toContain("cursor=cursor+seguro")
    expect(fetch.mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer cred" })
  })

  it("combina, deduplica y ordena mensajes estables", () => {
    const base = { projectId: "p", tipoRemitente: "human" as const, participantId: "u", nombreVisibleSnapshot: "Ana", contenido: "x", requestId: null, replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0 }
    const a = { ...base, id: "a", creadoEn: "2026-01-01T00:00:02.000Z" }
    const b = { ...base, id: "b", creadoEn: "2026-01-01T00:00:01.000Z" }
    expect(combinarMensajes([a], [b, a]).map((mensaje) => mensaje.id)).toEqual(["b", "a"])
  })

  it.each([[409, "conflicto"], [429, "limite"], [503, "no_disponible"], [502, "respuesta_invalida"]] as const)("conserva el tipo controlado para HTTP %s", async (estado, tipo) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Mensaje seguro" }), { status: estado, headers: { "Content-Type": "application/json" } })))
    await expect(consultarAsistenteContextual("p", "c", crypto.randomUUID(), "Pregunta", contexto)).rejects.toEqual(expect.objectContaining<Partial<ErrorConsultaContextual>>({ tipo, message: "Mensaje seguro" }))
  })
})
