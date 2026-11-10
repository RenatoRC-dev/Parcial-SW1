import { describe, expect, it, vi } from "vitest"
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
  const clasesPrestamo = [...Array.from({ length: 8 }, (_, indice) => ({ id: `c-${indice}`, nombre: `Clase${indice}`, tipoClase: "normal" as const, abstracta: false, atributos: [], operaciones: [] })),
    { id: "prestamo-canonico", nombre: "Prestamo", tipoClase: "normal" as const, abstracta: false, atributos: [], operaciones: [] }]
  const consultaPrestamo: SolicitudAsistenteContextual = { ...solicitud, requestId: "11111111-1111-4111-8111-111111111111",
    pregunta: "Recomiéndame exactamente un atributo adicional para Prestamo que registre su estado. No modifiques el diagrama.",
    contexto: { ...solicitud.contexto, modeloActual: { ...solicitud.contexto.modeloActual, clases: clasesPrestamo, relaciones: [] },
      elementosRelevantes: clasesPrestamo.slice(0, 8).map((clase) => ({ id: clase.id, nombre: clase.nombre, tipo: "clase" })) } }
  const consejoPrestamo = { respuesta: "OPCIONAL: estado: String permite registrar el estado de Prestamo; define los valores según tus reglas de negocio.",
    accionSugerida: "NINGUNA" as const, elementoRelacionadoId: "prestamo-canonico", nivel: "sugerencia" as const, categoriaRecomendacion: "OPCIONAL" as const,
    recomendacion: { resumen: "Añadir estado", targetElementIds: ["prestamo-canonico"], normalizedInstruction: "Agrega estado String a Prestamo." } }

  it("acepta un atributo opcional para una clase real fuera de los ocho elementos relevantes", async () => {
    const responder = vi.fn(async () => consejoPrestamo)
    const respuesta = await asistirUsuario(consultaPrestamo, { responder })
    expect(respuesta).toMatchObject(consejoPrestamo)
    expect(responder).toHaveBeenCalledTimes(1)
    expect(consultaPrestamo.contexto.modeloActual.clases[8].atributos).toEqual([])
  })

  it.each([
    { resumen: "Añadir estado", targetElementIds: ["tmp_estado"], normalizedInstruction: "Agrega estado String a Prestamo." },
    { resumen: "Añadir estado", targetElementIds: [123], normalizedInstruction: "Agrega estado String a Prestamo." },
    { resumen: "Añadir estado", targetElementIds: ["prestamo-canonico"], normalizedInstruction: " " },
  ])("descarta recomendación opcional inválida sin inventar IDs ni repetir IA: %j", async (recomendacion) => {
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {})
    const responder = vi.fn(async () => ({ ...consejoPrestamo, recomendacion })) as unknown as ProveedorAsistenteContextual["responder"]
    const respuesta = await asistirUsuario(consultaPrestamo, { responder })
    expect(respuesta.respuesta).toBe(consejoPrestamo.respuesta)
    expect(respuesta.recomendacion).toBeNull()
    expect(respuesta.elementoRelacionadoId).toBe("prestamo-canonico")
    expect(responder).toHaveBeenCalledTimes(1)
    expect(avisos).toHaveBeenCalledWith("[CU12] response_validation", expect.objectContaining({ outcome: "metadata_discarded", requestId: consultaPrestamo.requestId }))
    expect(JSON.stringify(avisos.mock.calls)).not.toMatch(/Prestamo|estado: String|tmp_estado|prestamo-canonico/)
    avisos.mockRestore()
  })

  it("limpia un ID opcional inválido de una respuesta sin acción sin modificar el original", async () => {
    const candidata = { ...consejoPrestamo, elementoRelacionadoId: "id-otro-proyecto" }
    const respuesta = await asistirUsuario(consultaPrestamo, { responder: async () => candidata })
    expect(respuesta.elementoRelacionadoId).toBeNull()
    expect(candidata.elementoRelacionadoId).toBe("id-otro-proyecto")
    expect(respuesta.recomendacion).toEqual(consejoPrestamo.recomendacion)
  })

  it.each([
    { accionSugerida: "ELIMINAR_CLASE" },
    { accionSugerida: "ENFOCAR_ELEMENTO", elementoRelacionadoId: "tmp_estado" },
    { accionSugerida: "ENFOCAR_ELEMENTO", elementoRelacionadoId: null },
    { accionSugerida: "IR_A_XMI", elementoRelacionadoId: "id-inexistente" },
    { categoriaRecomendacion: "INVALIDA" },
    { respuesta: "Pulsa IR_A_GENERACION." },
  ])("rechaza acción o campos esenciales inválidos sin degradarlos silenciosamente: %j", async (cambio) => {
    const responder = vi.fn(async () => ({ ...consejoPrestamo, ...cambio, recomendacion: { targetElementIds: ["tmp_estado"] } })) as unknown as ProveedorAsistenteContextual["responder"]
    await expect(asistirUsuario(consultaPrestamo, { responder })).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    expect(responder).toHaveBeenCalledTimes(1)
  })

  it.each(["IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI", "MOSTRAR_IMAGEN_CANDIDATA", "ENFOCAR_ELEMENTO"] as const)("degrada navegación opcional no disponible %s conservando consejo e IDs válidos", async (accionSugerida) => {
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {})
    const candidata = { ...consejoPrestamo, accionSugerida }
    const responder = vi.fn(async () => candidata)
    const respuesta = await asistirUsuario({ ...consultaPrestamo, contexto: { ...consultaPrestamo.contexto, accionesDisponibles: ["NINGUNA"] } }, { responder })
    expect(respuesta).toMatchObject({ ...consejoPrestamo, accionSugerida: "NINGUNA" })
    expect(candidata.accionSugerida).toBe(accionSugerida)
    expect(responder).toHaveBeenCalledTimes(1)
    expect(avisos).toHaveBeenCalledWith("[CU12] response_validation", expect.objectContaining({ stage: "semantic", reason: "OPTIONAL_UI_ACTION_UNAVAILABLE", outcome: "metadata_discarded" }))
    avisos.mockRestore()
  })

  it("conserva la navegación disponible y no la degrada por defecto", async () => {
    const respuesta = await asistirUsuario(consultaPrestamo, { responder: async () => ({ ...consejoPrestamo, accionSugerida: "IR_A_GENERACION" }) })
    expect(respuesta.accionSugerida).toBe("IR_A_GENERACION")
    expect(respuesta.recomendacion).toEqual(consejoPrestamo.recomendacion)
  })
  it("no confunde pedir una propuesta completa con evaluar completitud del negocio", async () => {
    const responder = vi.fn(async () => ({ respuesta: "Propuesta según tus reglas.", accionSugerida: "NINGUNA" as const, elementoRelacionadoId: null, nivel: "sugerencia" as const, categoriaRecomendacion: "RECOMENDADO" as const,
      recomendacion: { resumen: "Modelo acotado", targetElementIds: [], normalizedInstruction: "Crea Compra con id Long." } }))
    const respuesta = await asistirUsuario({ ...solicitud, pregunta: "Recomienda un modelo completo con la clase Compra y atributo id Long; no necesito otras clases ni relaciones." }, { responder })
    expect(responder).toHaveBeenCalledTimes(1)
    expect(respuesta.recomendacion?.normalizedInstruction).toBe("Crea Compra con id Long.")
  })
  it("explica conceptos UML sin proveedor ni reglas de negocio inventadas", async () => {
    const responder = vi.fn()
    const respuesta = await asistirUsuario({ ...solicitud, pregunta: "¿Qué significa multiplicidad?" }, { responder })
    expect(respuesta.respuesta).toContain("reglas del negocio")
    expect(respuesta.origen).toBe("determinista")
    expect(responder).not.toHaveBeenCalled()
  })
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
    const respuesta = await asistirUsuario(solicitud, { responder })

    expect(respuesta.respuesta).toContain("N:M")
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
    expect(contenido.contextoProducto).toBeUndefined() // Producto constante en el prefijo de sistema.
    expect(contenido.contextoAplicacion.modeloDurable).toBeUndefined()
    expect(contenido.contextoAplicacion.conversacionCompartida).toBeUndefined()
    const serializado = JSON.stringify(CONTEXTO_PRODUCTO_SW1)
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

  it("propaga una indisponibilidad como error controlado", async () => {
    const proveedor: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("no_disponible", "sin servicio") } }
    await expect(asistirUsuario(solicitud, proveedor)).rejects.toMatchObject({ tipo: "no_disponible" })
  })

  it("distingue límite temporal de una respuesta contractual inválida", async () => {
    const limitada: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("limite", "límite") } }
    const invalida: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("respuesta_invalida", "contrato") } }
    await expect(asistirUsuario(solicitud, limitada)).rejects.toMatchObject({ tipo: "limite" })
    await expect(asistirUsuario(solicitud, invalida)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })
})
