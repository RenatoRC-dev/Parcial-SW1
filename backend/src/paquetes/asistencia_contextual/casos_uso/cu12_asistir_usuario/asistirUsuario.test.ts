import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import type { SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { CONTEXTO_PRODUCTO_SW1 } from "../../compartido/ContextoProductoSW1.js"
import { construirContenidoPreguntaContextual } from "../../compartido/proveedores/groq/ProveedorAsistenteContextualGroq.js"
import { asistirUsuario } from "./asistirUsuario.js"

const solicitud: SolicitudAsistenteContextual = {
  pregunta: "Explícame el bloqueo contextual actual.",
  contexto: {
    proyecto: { id: "proyecto-1", nombre: "Accesos" },
    area: "modelado_uml",
    idioma: "es",
    revisionModelo: 1,
    modeloActual: { id: "modelo", nombre: "Accesos", version: "1", clases: [{ id: "usuario", nombre: "Usuario", atributos: [] }, { id: "rol", nombre: "Rol", atributos: [] }], relaciones: [{ id: "rel-nm", origen: { nombre: "Usuario", multiplicidad: "0..*" }, destino: { nombre: "Rol", multiplicidad: "0..*" } }], truncado: false },
    elementoSeleccionado: null,
    elementosRelevantes: [{ id: "rel-nm", tipo: "relacion", nombre: "Usuario — Rol" }],
    resumenModelo: { clases: 2, relaciones: 1 },
    estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
    generacion: {
      estado: "no_apto",
      bloqueos: ["Usuario (0..*) ↔ Rol (0..*) representa un N:M directo; conviértelo en clase asociativa."],
      advertencias: [],
    },
    cambiosSinGuardar: true,
    candidatoImagenPendiente: false,
    accionesDisponibles: ["NINGUNA", "ENFOCAR_ELEMENTO", "IR_A_GENERACION"],
  },
  conversacion: [],
}

describe("CU12 asistir usuario", () => {
  async function consultarAyudaDeterminista(pregunta: string, idioma: "es" | "en" = "es") {
    const responder = vi.fn(async () => { throw new Error("Groq no debe invocarse para ayuda determinista") })
    const respuesta = await asistirUsuario({ ...solicitud, pregunta, contexto: { ...solicitud.contexto, idioma } }, { responder })
    expect(responder).not.toHaveBeenCalled()
    expect(respuesta.origen).toBe("determinista")
    return respuesta.respuesta
  }

  it("responde cómo usar IA de modelado sin invocar Groq", async () => {
    const respuesta = await consultarAyudaDeterminista("¿Cómo uso el asistente IA?")
    expect(respuesta).toContain("Asistente IA")
    expect(respuesta).toContain("Pulsa Enviar")
    expect(respuesta).toContain("aplica automáticamente")
  })

  it("explica voz, imagen y XMI con sus flujos reales", async () => {
    const voz = await consultarAyudaDeterminista("¿Cómo funciona la voz?")
    expect(voz).toContain("transcribe el audio y envía automáticamente")
    expect(voz).toContain("No debes pulsar Enviar después")
    const imagen = await consultarAyudaDeterminista("¿Cómo uso Desde imagen?")
    expect(imagen).toContain("modelo UML candidato")
    expect(imagen).toContain("Agregar al diagrama")
    expect(imagen).toContain("Cancelar")
    const xmi = await consultarAyudaDeterminista("¿Cómo importo o exporto XMI?")
    expect(xmi).toContain("reemplazará el diagrama actual")
    expect(xmi).toContain("modelo.xmi")
    expect(xmi).not.toContain("candidato")
    expect(xmi).toContain("XMI no es necesario para generar Spring")
  })

  it("explica Spring desde la aptitud actual y no equipara validez con completitud", async () => {
    const spring = await consultarAyudaDeterminista("¿Cómo genero Spring?")
    expect(spring).toContain("N:M directo")
    expect(spring).toContain("No está listo")
    const completitud = await consultarAyudaDeterminista("¿Está completo mi modelo?")
    expect(completitud).toContain("completitud del negocio no puede demostrarse")
    expect(completitud).toContain("requisitos del negocio o casos de uso")
  })

  it("no inventa entidades ante una pregunta genérica de dominio y conserva ES/EN", async () => {
    const respuesta = await consultarAyudaDeterminista("¿Qué podría faltar en mi dominio?")
    expect(respuesta).not.toMatch(/Dirección|EstadoFactura|teléfono|MetodoPago/)
    expect(respuesta).toContain("proporciona los requisitos")
    const ingles = await consultarAyudaDeterminista("How do I use voice?", "en")
    expect(ingles).toContain("automatically sends")
    expect(ingles).toContain("do not press Send")
  })

  it("entrega al proveedor el bloqueo real en un contexto compacto", async () => {
    const responder = vi.fn(async () => ({
      respuesta: "El modelo UML es válido, pero el N:M directo debe convertirse en clase asociativa.",
      accionSugerida: "IR_A_GENERACION" as const,
      elementoRelacionadoId: null,
      nivel: "advertencia" as const,
      categoriaRecomendacion: "OBLIGATORIO" as const,
    }))
    const aplicacion = crearAplicacionGeneracionBackend({ proveedorAsistenteContextual: { responder } })
    const respuesta = await request(aplicacion).post("/api/ia/contextual/preguntar").send(solicitud).expect(200)

    expect(respuesta.body.respuesta).toContain("N:M")
    expect(responder).toHaveBeenCalledWith(expect.objectContaining({ contexto: expect.objectContaining({ generacion: expect.objectContaining({ bloqueos: expect.arrayContaining([expect.stringContaining("clase asociativa")]) }) }) }))
    const enviado = JSON.stringify(responder.mock.calls[0][0])
    expect(enviado).not.toContain("UMLModel")
    expect(enviado).not.toContain("yjs")
    expect(enviado).not.toContain("base64")
  })

  it("rechaza una acción generada fuera de la lista permitida", async () => {
    const proveedor = { responder: vi.fn(async () => ({ respuesta: "Hecho", accionSugerida: "BORRAR_MODELO", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO" })) } as unknown as ProveedorAsistenteContextual
    await expect(asistirUsuario(solicitud, proveedor)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it("incluye el producto verificado junto al modelo actual sin enviar internals", () => {
    const contenido = JSON.parse(construirContenidoPreguntaContextual(solicitud))
    expect(contenido.contextoAplicacion.modeloActual.nombre).toBe("Accesos")
    expect(contenido.contextoProducto).toEqual(CONTEXTO_PRODUCTO_SW1)
    expect(contenido.contextoProducto.capacidades.iaModelado).toEqual(expect.objectContaining({ requiereConfirmacion: false, aplicaCambiosValidosAutomaticamente: true }))
    expect(contenido.contextoProducto.capacidades.imagenUml).toEqual(expect.objectContaining({ produceCandidato: true, requiereConfirmacion: true }))
    expect(contenido.contextoProducto.capacidades.iaModelado.voz).toContain("envía automáticamente")
    expect(contenido.contextoProducto.capacidades.xmi.produceCandidato).toBe(false)
    expect(contenido.contextoProducto.capacidades.xmi.exportar).toContain("no es un requisito ni el flujo de generación Spring")
    const serializado = JSON.stringify(contenido.contextoProducto)
    expect(serializado).not.toMatch(/Yjs|Apollon|GROQ_API_KEY|IR_A_/i)
  })

  it("evita delegar al proveedor una expansión genérica del dominio", async () => {
    const solicitudCliente: SolicitudAsistenteContextual = {
      ...solicitud,
      pregunta: "¿Qué podría faltarle a Cliente?",
      contexto: {
        ...solicitud.contexto,
        modeloActual: { id: "modelo", nombre: "Ventas", version: "1", clases: [{ id: "cliente", nombre: "Cliente", atributos: [{ nombre: "correo", tipo: "String" }] }], relaciones: [], truncado: false },
        resumenModelo: { clases: 1, relaciones: 0 },
        generacion: { estado: "apto", bloqueos: [], advertencias: [] },
      },
    }
    const responder = vi.fn(async () => { throw new Error("No debe delegarse a Groq") })
    const proveedor: ProveedorAsistenteContextual = { responder }
    const respuesta = await asistirUsuario(solicitudCliente, proveedor)
    expect(responder).not.toHaveBeenCalled()
    expect(respuesta.respuesta).toContain("completitud del negocio no puede demostrarse")
    expect(respuesta.respuesta).not.toMatch(/Dirección|EstadoFactura|teléfono/)
  })

  it("rechaza identificadores internos incluidos en la respuesta visible", async () => {
    const proveedor: ProveedorAsistenteContextual = { responder: async () => ({ respuesta: "Usa IR_A_GENERACION.", accionSugerida: "IR_A_GENERACION", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO" }) }
    await expect(asistirUsuario(solicitud, proveedor)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it("rechaza una clasificación de recomendación fuera del contrato", async () => {
    const proveedor = { responder: vi.fn(async () => ({ respuesta: "Hecho", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "URGENTE" })) } as unknown as ProveedorAsistenteContextual
    await expect(asistirUsuario(solicitud, proveedor)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it("degrada una indisponibilidad sin afectar el resto de la aplicación", async () => {
    const proveedor: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("no_disponible", "sin servicio") } }
    const aplicacion = crearAplicacionGeneracionBackend({ proveedorAsistenteContextual: proveedor })
    const respuesta = await request(aplicacion).post("/api/ia/contextual/preguntar").send(solicitud).expect(503)
    expect(respuesta.body.error).toContain("ayuda de uso, validación y orientación local continúan disponibles")
    expect(respuesta.body.tipo).toBe("no_disponible")
    await request(aplicacion).get("/api/health").expect(200)
  })

  it("distingue límite temporal de una respuesta contractual inválida", async () => {
    const limitada: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("limite", "límite") } }
    const invalida: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("respuesta_invalida", "contrato") } }
    const respuestaLimite = await request(crearAplicacionGeneracionBackend({ proveedorAsistenteContextual: limitada })).post("/api/ia/contextual/preguntar").send(solicitud).expect(429)
    const respuestaInvalida = await request(crearAplicacionGeneracionBackend({ proveedorAsistenteContextual: invalida })).post("/api/ia/contextual/preguntar").send(solicitud).expect(502)
    expect(respuestaLimite.body.tipo).toBe("limite")
    expect(respuestaInvalida.body.tipo).toBe("respuesta_invalida")
  })
})
