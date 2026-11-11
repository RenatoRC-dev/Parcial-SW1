import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProveedorGroq } from "./ProveedorGroq.js"
import { ESQUEMA_RESPUESTA_GROQ } from "./EsquemaRespuestaGroq.js"
import { ProveedorAsistenteContextualGroq, ESQUEMA, construirContenidoPreguntaContextual } from "../../../../asistencia_contextual/compartido/proveedores/groq/ProveedorAsistenteContextualGroq.js"
import type { SolicitudAsistenteContextual } from "../../../../asistencia_contextual/compartido/ContratoAsistenteContextual.js"
import { registrarLimiteGroq } from "./ControlLimiteGroq.js"

const { crear, configuraciones } = vi.hoisted(() => ({ crear: vi.fn(), configuraciones: [] as Array<{ maxRetries: number }> }))
vi.mock("groq-sdk", () => ({ default: class {
  chat = { completions: { create: crear } }
  constructor(configuracion: { maxRetries: number }) { configuraciones.push(configuracion) }
} }))

const modelo = { id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [] }
const solicitud = { instruccion: "Crea Cliente.", modelo, contexto: modelo, requestId: "correlacion-prueba" }
const consulta: SolicitudAsistenteContextual = { pregunta: "Revisa el modelo", conversacion: [], requestId: "correlacion-prueba", contexto: {
  proyecto: null, area: "modelado_uml", idioma: "es", revisionModelo: 0, modeloActual: { ...modelo, truncado: false }, elementoSeleccionado: null,
  elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 }, estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
  generacion: { estado: "apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: false, candidatoImagenPendiente: false, accionesDisponibles: ["NINGUNA"],
} }
const respuestaCU12 = { respuesta: "Necesito los requisitos.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", recomendacion: null }
const completar = (contenido: unknown) => ({ choices: [{ message: { content: JSON.stringify(contenido) } }], usage: { prompt_tokens: 100, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 80 } } })
let dia = 0
beforeEach(() => {
  crear.mockReset(); configuraciones.length = 0
  vi.useFakeTimers(); vi.setSystemTime(new Date(2100, 0, ++dia))
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe("Groq CU04/CU12 sin red", () => {
  it("CU04 conserva tipoDato null por esquema, instrucciones y adaptador real sin consumir red", async () => {
    const contenido = { resultado: "aplicar", mensaje: "Nombre sin tipo", comandos: [{ tipo: "agregar_atributo", claseRef: "tmp_cliente", refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: null, visibilidad: null }] }
    crear.mockResolvedValueOnce(completar(contenido))
    expect(await new ProveedorGroq("clave-prueba").interpretarCambiosUML(solicitud)).toEqual(contenido)
    const enviada = crear.mock.calls[0][0]
    expect(enviada.response_format.json_schema).toMatchObject({ strict: true, schema: ESQUEMA_RESPUESTA_GROQ })
    expect(enviada.messages[0].content).toContain("tipoDato=null")
    expect(enviada.messages[0].content).toContain("PK/FK")
    expect(crear).toHaveBeenCalledOnce()
  })

  it("CU04 rechaza campos de tipo inventados aunque el proveedor devuelva JSON con tipoDato null", async () => {
    crear.mockResolvedValueOnce(completar({ resultado: "aplicar", mensaje: "Inválido", comandos: [{ tipo: "agregar_atributo", claseRef: "tmp_cliente", refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: null, visibilidad: null, inferredType: "String" }] }))
    await expect(new ProveedorGroq("clave-prueba").interpretarCambiosUML(solicitud)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it("recupera metadatos opcionales de un atributo sugerido conservando la clase real y sin reintentar", async () => {
    const contenido = { ...respuestaCU12, respuesta: "OPCIONAL: estado: String para registrar el estado.", categoriaRecomendacion: "OPCIONAL", elementoRelacionadoId: "tmp_estado",
      recomendacion: { resumen: "Estado", targetElementIds: ["tmp_estado"], normalizedInstruction: "Agrega estado String a Prestamo." } }
    crear.mockResolvedValueOnce(completar(contenido))
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {})
    const resultado = await new ProveedorAsistenteContextualGroq("clave-prueba").responder({ ...consulta,
      pregunta: "Recomiéndame exactamente un atributo adicional para Prestamo que registre su estado. No modifiques el diagrama.",
      contexto: { ...consulta.contexto, modeloActual: { ...consulta.contexto.modeloActual, clases: [{ id: "prestamo-real", nombre: "Prestamo", tipoClase: "normal", abstracta: false, atributos: [], operaciones: [] }] } } })
    expect(resultado).toMatchObject({ respuesta: contenido.respuesta, accionSugerida: "NINGUNA", elementoRelacionadoId: null, recomendacion: null })
    expect(crear).toHaveBeenCalledTimes(1)
    expect(avisos).toHaveBeenCalledWith("[CU12] response_validation", expect.objectContaining({ stage: "semantic", outcome: "metadata_discarded" }))
    expect(JSON.stringify(avisos.mock.calls)).not.toMatch(/Prestamo|estado: String|clave-prueba|tmp_estado|prestamo-real/)
  })

  it.each([
    { content: "{json", stage: "json", reason: "PROVIDER_JSON_PARSE_FAILED" },
    { content: null, stage: "json", reason: "PROVIDER_CONTENT_EMPTY" },
    { content: JSON.stringify({ ...respuestaCU12, nivel: "inválido" }), stage: "schema", reason: "LOCAL_SCHEMA_LEVEL" },
    { content: JSON.stringify({ ...respuestaCU12, accionSugerida: "ENFOCAR_ELEMENTO", elementoRelacionadoId: "desconocido" }), stage: "semantic", reason: "LOCAL_ELEMENT_REFERENCE_INVALID" },
  ])("distingue rechazo $stage/$reason tras una completion", async ({ content, stage, reason }) => {
    crear.mockResolvedValueOnce({ choices: [{ message: { content } }] })
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(new ProveedorAsistenteContextualGroq("clave-prueba").responder(consulta)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    expect(avisos).toHaveBeenCalledWith("[CU12] response_validation", { requestId: consulta.requestId, stage, reason, outcome: "rejected" })
    expect(crear).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(avisos.mock.calls)).not.toMatch(/clave-prueba|\{json|desconocido|inválido/)
  })

  it("acota una revisión concreta a la clase y su vecindad sin perder el modelo original", () => {
    const clases = ["Cliente", "Venta", "Proveedor"].map((nombre) => ({ id: nombre, nombre, tipoClase: "normal" as const, abstracta: false, atributos: [], operaciones: [] }))
    const relacion = { id: "rel", nombre: null, tipoRelacion: "asociacion", origen: { id: "Cliente", nombre: "Cliente", multiplicidad: null, rol: null }, destino: { id: "Venta", nombre: "Venta", multiplicidad: null, rol: null } }
    const concreta = { ...consulta, pregunta: "Revisa Cliente", contexto: { ...consulta.contexto, modeloActual: { ...consulta.contexto.modeloActual, clases, relaciones: [relacion] } } }
    const contenido = JSON.parse(construirContenidoPreguntaContextual(concreta))
    expect(contenido.contextoAplicacion.modeloActual.clases.map((clase: { nombre: string }) => clase.nombre)).toEqual(["Cliente", "Venta"])
    expect(contenido.contextoAplicacion.modeloActual.truncado).toBe(true)
    expect(concreta.contexto.modeloActual.clases).toHaveLength(3)
    expect(JSON.parse(construirContenidoPreguntaContextual({ ...concreta, pregunta: "Revisa todo el modelo" })).contextoAplicacion.modeloActual.clases).toHaveLength(3)
  })
  it("permite overrides independientes y conserva el fallback GROQ_MODEL", () => {
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b")
    vi.stubEnv("GROQ_CU04_MODEL", "openai/gpt-oss-120b")
    vi.stubEnv("GROQ_CU12_MODEL", " ")
    expect(new ProveedorGroq("clave-prueba").modelo).toBe("openai/gpt-oss-120b")
    expect(new ProveedorAsistenteContextualGroq("clave-prueba").modelo).toBe("openai/gpt-oss-20b")
    vi.stubEnv("GROQ_CU12_MODEL", "openai/gpt-oss-120b")
    expect(new ProveedorAsistenteContextualGroq("clave-prueba").modelo).toBe("openai/gpt-oss-120b")
  })

  it.each(["CU04", "CU12"])("propaga fallos de programación en %s sin convertirlos en indisponibilidad", async (flujo) => {
    const fallo = new TypeError("detalle interno privado")
    crear.mockRejectedValueOnce(fallo)
    const llamada = flujo === "CU04" ? new ProveedorGroq("clave-prueba").interpretarCambiosUML(solicitud) : new ProveedorAsistenteContextualGroq("clave-prueba").responder(consulta)
    await expect(llamada).rejects.toBe(fallo)
    expect(crear).toHaveBeenCalledTimes(1)
  })

  it.each(["CU04", "CU12"])("clasifica un HTTP 500 upstream como indisponibilidad en %s", async (flujo) => {
    crear.mockRejectedValueOnce({ status: 500 })
    const llamada = flujo === "CU04" ? new ProveedorGroq("clave-prueba").interpretarCambiosUML(solicitud) : new ProveedorAsistenteContextualGroq("clave-prueba").responder(consulta)
    await expect(llamada).rejects.toMatchObject({ tipo: "no_disponible" })
  })
  it.each(["openai/gpt-oss-20b", "openai/gpt-oss-120b"])("envía esquema estricto y valida ambos contratos con %s", async (model) => {
    crear.mockResolvedValueOnce(completar({ resultado: "aplicar", mensaje: "Clase preparada", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente", abstracta: false }] }))
    expect((await new ProveedorGroq("clave-prueba", model).interpretarCambiosUML(solicitud)).resultado).toBe("aplicar")
    crear.mockResolvedValueOnce(completar(respuestaCU12))
    await new ProveedorAsistenteContextualGroq("clave-prueba", model).responder(consulta)
    for (const [peticion] of crear.mock.calls) {
      expect(peticion).toMatchObject({ model, response_format: { type: "json_schema", json_schema: { strict: true } } })
      expect(peticion.max_completion_tokens).toBeGreaterThan(700)
    }
    expect(configuraciones.every((configuracion) => configuracion.maxRetries === 0)).toBe(true)
  })

  it.each(["CU04", "CU12"])("clasifica 400 json_validate_failed en %s sin reintentar ni filtrar detalles", async (flujo) => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {}); const avisos = vi.spyOn(console, "warn").mockImplementation(() => {})
    crear.mockRejectedValueOnce({ status: 400, error: { error: { code: "json_validate_failed", message: "secreto-privado" } } })
    const llamada = flujo === "CU04" ? new ProveedorGroq("clave-prueba").interpretarCambiosUML(solicitud) : new ProveedorAsistenteContextualGroq("clave-prueba").responder(consulta)
    await expect(llamada).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    if (flujo === "CU12") expect(avisos).toHaveBeenCalledWith("[CU12] response_validation", expect.objectContaining({ stage: "provider", reason: "UPSTREAM_JSON_SCHEMA_REJECTED" }))
    expect(crear).toHaveBeenCalledTimes(1)
    expect(JSON.stringify([...logs.mock.calls, ...avisos.mock.calls])).not.toMatch(/secreto-privado|clave-prueba|Crea Cliente/)
  })

  it("comparte pausa 429 entre CU04 y CU12, honra retry-after y permite reintentar al vencer", async () => {
    crear.mockRejectedValueOnce({ status: 429, headers: new Headers({ "retry-after": "12" }) })
    const cu04 = new ProveedorGroq("clave-prueba")
    const cu12 = new ProveedorAsistenteContextualGroq("clave-prueba")
    await expect(cu04.interpretarCambiosUML(solicitud)).rejects.toMatchObject({ tipo: "limite", retryAfterSeconds: 12 })
    await expect(cu12.responder(consulta)).rejects.toMatchObject({ tipo: "limite", retryAfterSeconds: 12 })
    expect(crear).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(12_000)
    crear.mockResolvedValueOnce(completar(respuestaCU12))
    await cu12.responder(consulta)
    expect(crear).toHaveBeenCalledTimes(2)
  })

  it("acota retry-after malformado o excesivo", () => {
    expect(registrarLimiteGroq("prueba-invalido", { headers: { "retry-after": "inválido" } })).toBe(30)
    expect(registrarLimiteGroq("prueba-excesivo", { headers: { "retry-after": "999999" } })).toBe(300)
  })

  it("mantiene todos los objetos de ambos esquemas cerrados y requeridos", () => {
    function verificar(valor: unknown) {
      if (!valor || typeof valor !== "object") return
      const nodo = valor as Record<string, unknown>
      if (nodo.type === "object") {
        expect(nodo.additionalProperties).toBe(false)
        expect([...(nodo.required as string[])].sort()).toEqual(Object.keys(nodo.properties as object).sort())
      }
      Object.values(nodo).forEach(verificar)
    }
    verificar(ESQUEMA); verificar(ESQUEMA_RESPUESTA_GROQ)
  })

  it("no duplica modelo durable ni historial y limita conversación al participante actual", async () => {
    const mensaje = (id: string, tipoRemitente: "human" | "ai", participantId: string | null, replyToMessageId: string | null, contenido: string) => ({ id, tipoRemitente, participantId, replyToMessageId, contenido, requestId: null, creadoEn: "", nombreVisibleSnapshot: null })
    const extensa: SolicitudAsistenteContextual = { ...consulta, conversacion: Array.from({ length: 16 }, () => ({ rol: "usuario", contenido: "x".repeat(2400) })), contexto: { ...consulta.contexto,
      participanteActual: { id: "yo", nombreVisible: "Yo" }, modeloDurable: { revision: 0, actualizadoEn: "", resumen: consulta.contexto.modeloActual },
      conversacionCompartida: [mensaje("1", "human", "otro", null, "privado-otro"), mensaje("2", "ai", null, "1", "respuesta-otro"), mensaje("3", "human", "yo", null, "consulta-propia"), mensaje("4", "ai", null, "3", "respuesta-propia")],
    } }
    const contenido = construirContenidoPreguntaContextual(extensa)
    expect(contenido).not.toMatch(/modeloDurable|conversacionCompartida|contextoProducto/)
    crear.mockResolvedValueOnce(completar(respuestaCU12))
    await new ProveedorAsistenteContextualGroq("clave-prueba").responder(extensa)
    const mensajes = crear.mock.calls[0][0].messages
    expect(mensajes).toHaveLength(4)
    expect(JSON.stringify(mensajes)).toContain("respuesta-propia")
    expect(JSON.stringify(mensajes)).not.toContain("respuesta-otro")
    expect(crear).toHaveBeenCalledTimes(1)
  })
})
