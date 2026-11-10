import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import type { ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import type { ProveedorModeloLenguaje } from "../../../asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import { clasificarIntencionInteraccion } from "./OrquestarInteraccionIA.js"
import { ErrorProveedorIA } from "../../../asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import type { ModeloUMLCanonicoIA } from "../../../asistencia_ia/compartido/contrato/ComandoModeloUML.js"
import { ejecutarComandosUML } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/EjecutorComandosUML.js"

const modelo = {
  id: "modelo", nombre: "Ventas", version: "4.2.0", relaciones: [],
  clases: [
    { id: "venta", nombre: "Venta", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] },
    { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 300, y: 0 }, atributos: [] },
  ],
}
const vistaActual = {
  idioma: "es", cambiosSinGuardar: true, candidatoImagenPendiente: false,
  modeloActual: { id: "modelo", nombre: "Ventas", version: "4.2.0", truncado: false,
    clases: modelo.clases.map((clase) => ({ id: clase.id, nombre: clase.nombre, tipoClase: "normal", abstracta: false, atributos: [], operaciones: [] })), relaciones: [] },
  estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
  generacion: { estado: "apto", bloqueos: [], advertencias: [] },
}

function modeloS4(caso: string): ModeloUMLCanonicoIA {
  const vivo: ModeloUMLCanonicoIA = structuredClone(modelo)
  if (caso === "dominio") vivo.clases[0].atributos.push({ id: "saldo", nombre: "saldo", tipo: "Money" })
  if (caso === "duplicado") vivo.clases[1].nombre = "Venta"
  if (caso === "vacio") vivo.clases = []
  if (caso === "minimo" || caso === "unoAuno") vivo.relaciones = [{ id: "r", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "venta", multiplicidadOrigen: "1", multiplicidadDestino: caso === "minimo" ? "1..*" : "1" }]
  return vivo
}

describe("orquestacion controlada CU12-CU04", () => {
  let directorio: string
  let mensajes: RepositorioMensajesMemoria
  let eventos: RepositorioEventosMemoria
  let interpretar: ReturnType<typeof vi.fn>
  let responder: ReturnType<typeof vi.fn>
  let aplicacion: ReturnType<typeof crearAplicacionGeneracionBackend>

  beforeEach(async () => {
    directorio = await mkdtemp(join(tmpdir(), "nexocase-p6-")); mensajes = new RepositorioMensajesMemoria(); eventos = new RepositorioEventosMemoria()
    interpretar = vi.fn(async ({ instruccion }: { instruccion: string }) => {
      if (/elimina/i.test(instruccion)) return { resultado: "aplicar" as const, mensaje: "Venta eliminada.", comandos: [{ tipo: "eliminar_clase" as const, claseId: "venta" }] }
      const claseRef = /cliente/i.test(instruccion) && !/venta/i.test(instruccion) ? "cliente" : "venta"
      return { resultado: "aplicar" as const, mensaje: "Total agregado.", comandos: [{ tipo: "agregar_atributo" as const, claseRef, refTemporal: "tmp_total", nombre: "total", tipoDato: "Double", visibilidad: "privada" as const }] }
    })
    responder = vi.fn(async (solicitud: { pregunta: string; contexto: { participanteActual?: { nombreVisible: string } } }) => {
      const cliente = /cliente/i.test(solicitud.pregunta)
      const target = cliente ? "cliente" : "venta"; const nombre = cliente ? "Cliente" : "Venta"
      return { respuesta: `Recomiendo agregar total a ${nombre}.`, accionSugerida: "NINGUNA" as const, elementoRelacionadoId: target,
        nivel: "sugerencia" as const, categoriaRecomendacion: "RECOMENDADO" as const,
        recomendacion: { resumen: `Agregar total a ${nombre}`, targetElementIds: [target], normalizedInstruction: `Agrega atributo total Double a la clase ${nombre}.` } }
    })
    aplicacion = crearAplicacionGeneracionBackend({
      proveedorIA: { interpretarCambiosUML: interpretar } as ProveedorModeloLenguaje,
      proveedorAsistenteContextual: { responder } as ProveedorAsistenteContextual,
      accesoProyectos: { proyectos: new RepositorioProyectosArchivos(directorio), participantes: new RepositorioParticipantesMemoria(),
        protector: new ProtegerAccesoProyecto("pepper-p6"), mensajes, eventos },
    })
  })
  afterEach(async () => { await rm(directorio, { recursive: true, force: true }) })

  it.each([
    ["dominio", "valido", "no_apto"], ["duplicado", "invalido", "no_apto"],
    ["vacio", "valido", "no_apto"], ["minimo", "valido", "apto"], ["unoAuno", "valido", "no_apto"],
  ])("F8-S4 CU12 diagnostica el canónico con reglas autoritativas (%s)", async (caso, uml, spring) => {
    const creado = await crear()
    responder.mockResolvedValueOnce({ respuesta: "Diagnóstico consultivo.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", recomendacion: null })
    await request(aplicacion).post(`/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo/interactuar`)
      .set({ Authorization: `Bearer ${creado.body.credencial}` })
      .send({ requestId: crypto.randomUUID(), contenido: "Revisa el modelo actual.", modeloEjecucion: modeloS4(caso), revisionEditor: 7, vistaActual }).expect(200)
    const contexto = responder.mock.calls[0][0].contexto
    expect(contexto.estadoUml.estado).toBe(uml)
    expect(contexto.generacion.estado).toBe(spring)
    expect(contexto.estadoUml.errores.length > 0).toBe(caso === "duplicado")
    expect(contexto.generacion.advertencias.length > 0).toBe(caso === "minimo")
    expect(interpretar).not.toHaveBeenCalled()
    expect((await request(aplicacion).get(`/api/proyectos/${creado.body.proyecto.id}`).set({ Authorization: `Bearer ${creado.body.credencial}` })).body.revisionModelo).toBe(0)
  })

  async function crear(nombreParticipante = "Renato") {
    return request(aplicacion).post("/api/proyectos").send({ nombre: "Ventas", nombreParticipante }).expect(201)
  }
  function interactuar(id: string, credencial: string, contenido: string, requestId = crypto.randomUUID(), foco?: string) {
    return request(aplicacion).post(`/api/proyectos/${id}/asistente-colaborativo/interactuar`).set({ Authorization: `Bearer ${credencial}` })
      .send({ requestId, contenido, ...(foco ? { foco: { elementoId: foco } } : {}), vistaActual, modeloEjecucion: modelo, revisionEditor: 7 })
  }

  it.each([
    ["¿Cómo exporto XMI?", "PRODUCT_QUERY"], ["¿Qué significa composición?", "CONCEPTUAL_QUERY"],
    ["¿Quién creó Venta?", "ACTIVITY_QUERY"], ["Revisa Venta.", "REVIEW_REQUEST"],
    ["Agrega total Double a Venta.", "EXPLICIT_MODIFICATION"], ["¿Puedes agregar total Double a Venta?", "EXPLICIT_MODIFICATION"],
    ["¿Qué pasaría si agregara total Double a Venta?", "MODEL_QUERY"], ["Corrígelo.", "CONTEXTUAL_MODIFICATION"],
    ["Hazme todo el modelo", "CONTEXTUAL_MODIFICATION"], ["Diseña el diagrama completo", "CONTEXTUAL_MODIFICATION"],
    ["Aplica la propuesta de devoluciones", "CONTEXTUAL_MODIFICATION"],
    ["Hazme todo el modelo: crea Cliente con id Long", "EXPLICIT_MODIFICATION"],
    ["Diseña el diagrama completo de ventas con Cliente y Venta", "EXPLICIT_MODIFICATION"],
    ["¿Cómo aplico la propuesta que dijiste?", "MODEL_QUERY"], ["¿Qué opinas de crear lo que dijiste?", "MODEL_QUERY"],
    ["No crees el modelo que dijiste", "MODEL_QUERY"], ["Si te pidiera crear todo, ¿qué harías?", "MODEL_QUERY"],
    ["Sí, hazlo", "CONTEXTUAL_MODIFICATION"], ["Sí, crea las clases recomendadas", "CONTEXTUAL_MODIFICATION"],
    ["De acuerdo, aplica la propuesta", "CONTEXTUAL_MODIFICATION"], ["Quiero que crees un modelo de ventas", "EXPLICIT_MODIFICATION"],
    ["Sí, no lo hagas", "MODEL_QUERY"], ["De acuerdo, no apliques la propuesta", "MODEL_QUERY"],
    ["Si creas las clases recomendadas, ¿qué ocurriría?", "MODEL_QUERY"], ["Quiero saber si puedes crear un modelo de ventas", "MODEL_QUERY"],
    ["Quiero que no crees un modelo de ventas", "MODEL_QUERY"], ["¿Qué significa decir sí, hazlo?", "CONCEPTUAL_QUERY"],
    ["Me refería a que agregues lo que me recomendaste", "CONTEXTUAL_MODIFICATION"],
    ["No me refería a que agregues lo que me recomendaste", "MODEL_QUERY"],
    ["Me refería a que no agregues lo que me recomendaste", "MODEL_QUERY"],
    ["¿Qué pasaría si agregues lo que me recomendaste?", "MODEL_QUERY"],
    ["Me refería a que agregues lo que me recomendaste, pero no lo hagas", "MODEL_QUERY"],
    ["Bien agrégalo entonces", "CONTEXTUAL_MODIFICATION"], ["Bien agrégalo", "CONTEXTUAL_MODIFICATION"],
    ["Agrégalo entonces", "CONTEXTUAL_MODIFICATION"], ["Ejecuta", "CONTEXTUAL_MODIFICATION"],
    ["No ejecutes", "MODEL_QUERY"], ["¿Cómo ejecuto la propuesta?", "MODEL_QUERY"],
    ["Si lo agregara, ¿qué pasaría?", "MODEL_QUERY"], ["Bien agrégalo entonces, pero no lo hagas", "MODEL_QUERY"],
    ["Bien, agrégalo entonces.", "CONTEXTUAL_MODIFICATION"], ["Sí, agrégalo", "CONTEXTUAL_MODIFICATION"],
    ["Bien", "MODEL_QUERY"], ["Ejecuta?", "MODEL_QUERY"],
  ] as const)("clasifica %s como %s", (texto, esperado) => expect(clasificarIntencionInteraccion(texto)).toBe(esperado))

  it("crea un plan requester-only, confirma una vez y conserva CU11 sin autosave", async () => {
    const creado = await crear(); const projectId = creado.body.proyecto.id; const credential = creado.body.credencial
    const solicitudId = crypto.randomUUID()
    const accion = await interactuar(projectId, credential, "Agrega total Double a Venta.", solicitudId).expect(200)
    expect(accion.body).toMatchObject({ kind: "action", baseEditorRevision: 7, normalizedInstruction: "Agrega total Double a Venta." })
    expect((await eventos.listarPorProyecto({ projectId, limite: 20 })).items.filter((item) => item.mecanismo === "ai_cu04")).toHaveLength(0)
    const cambio = { commandIndex: 0, tipo: "UML_ELEMENT_CREATED", elemento: { id: "atributo-total", tipo: "attribute", nombreSnapshot: "total" } }
    const ruta = `/api/proyectos/${projectId}/modelado-ia/acciones/${accion.body.actionId}/completar`
    await request(aplicacion).post(ruta).set({ Authorization: `Bearer ${credential}` }).send({ resultado: "applied", cambios: [cambio] }).expect(200)
    const repetida = await request(aplicacion).post(ruta).set({ Authorization: `Bearer ${credential}` }).send({ resultado: "applied", cambios: [cambio] }).expect(200)
    expect(repetida.body.kind).toBe("action_already_applied")
    const actividad = (await eventos.listarPorProyecto({ projectId, limite: 20 })).items.filter((item) => item.mecanismo === "ai_cu04")
    expect(actividad).toHaveLength(1)
    expect(actividad[0]).toMatchObject({ solicitadoPorParticipantId: creado.body.participante.id, sourceMessageId: accion.body.mensajeHumano.id })
    expect(creado.body.proyecto.revisionModelo).toBe(0)
  })

  it.each(["Sí, hazlo", "Sí, crea las clases recomendadas", "De acuerdo, aplica la propuesta", "Me refería a que agregues lo que me recomendaste", "Bien agrégalo entonces", "Bien agrégalo", "Agrégalo entonces", "Ejecuta", "Aplica eso"])("resuelve autorización afirmativa sin consulta CU12 adicional: %s", async (texto) => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    const id = crypto.randomUUID()
    const accion = await interactuar(creado.body.proyecto.id, creado.body.credencial, texto, id).expect(200)
    const repetida = await interactuar(creado.body.proyecto.id, creado.body.credencial, texto, id).expect(200)
    expect(accion.body).toMatchObject({ kind: "action", intent: "CONTEXTUAL_MODIFICATION", normalizedInstruction: "Agrega atributo total Double a la clase Venta." })
    expect(repetida.body.actionId).toBe(accion.body.actionId)
    expect(interpretar).toHaveBeenCalledTimes(1); expect(responder).toHaveBeenCalledTimes(1)
  })

  it("mantiene la propuesta de Prestamo durante Bien agrégalo → Ejecuta → reformulación, con otro participante y fallos CU04", async () => {
    const creado = await crear("Renato")
    const unido = await request(aplicacion).post("/api/proyectos/unirse").send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Carlos" }).expect(200)
    const original: ModeloUMLCanonicoIA = { ...modelo, clases: [
      { ...modelo.clases[0], id: "prestamo-id", nombre: "Prestamo" },
      { ...modelo.clases[1], id: "producto-id", nombre: "Producto" },
    ] }
    let vivo = structuredClone(original)
    let revision = 1
    responder.mockImplementation(async ({ pregunta }: { pregunta: string }) => {
      const producto = /Producto/.test(pregunta)
      const nombre = producto ? "Producto" : "Prestamo"; const target = producto ? "producto-id" : "prestamo-id"
      return { respuesta: `Sugiero estado: String para ${nombre}.`, accionSugerida: "NINGUNA", elementoRelacionadoId: target, nivel: "sugerencia", categoriaRecomendacion: "OPCIONAL",
        recomendacion: { resumen: `Estado de ${nombre}`, targetElementIds: [target], normalizedInstruction: `Agrega estado String a ${nombre}.` } }
    })
    let intentos = 0
    interpretar.mockImplementation(async () => ({ resultado: "aplicar", mensaje: "Estado preparado.", comandos: [{ tipo: "agregar_atributo", claseRef: "prestamo-id", refTemporal: "tmp_estado", nombre: "estado", tipoDato: ++intentos === 1 ? "TipoInexistente" : "String", visibilidad: "privada" }] }))
    const enviar = (contenido: string, credential = creado.body.credencial, requestId = crypto.randomUUID()) => request(aplicacion)
      .post(`/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo/interactuar`).set({ Authorization: `Bearer ${credential}` })
      .send({ requestId, contenido, modeloEjecucion: vivo, revisionEditor: revision })
    await enviar("Recomiéndame un atributo de estado para Prestamo. No modifiques el diagrama.").expect(200)
    await enviar("Recomiéndame un atributo para Producto.", unido.body.credencial).expect(200)
    const primerId = crypto.randomUUID()
    const fallido = await enviar("Bien agrégalo entonces", creado.body.credencial, primerId).expect(200)
    expect(fallido.body.kind).toBe("clarification")
    expect((await enviar("Bien agrégalo entonces", creado.body.credencial, primerId).expect(200)).body.mensajeIA.id).toBe(fallido.body.mensajeIA.id)
    expect(interpretar).toHaveBeenCalledTimes(1)
    const segundoId = crypto.randomUUID()
    const segundo = await enviar("Ejecuta", creado.body.credencial, segundoId).expect(200)
    expect(segundo.body).toMatchObject({ kind: "action", normalizedInstruction: "Agrega estado String a Prestamo." })
    const ruta = (id: string) => `/api/proyectos/${creado.body.proyecto.id}/modelado-ia/acciones/${id}/completar`
    await request(aplicacion).post(ruta(segundo.body.actionId)).set({ Authorization: `Bearer ${unido.body.credencial}` }).send({ resultado: "failed" }).expect(403)
    await request(aplicacion).post(ruta(segundo.body.actionId)).set({ Authorization: `Bearer ${creado.body.credencial}` }).send({ resultado: "failed", mensaje: "El editor cambió antes de aplicar." }).expect(200)
    expect((await enviar("Ejecuta", creado.body.credencial, segundoId).expect(200)).body.kind).toBe("action_already_finished")
    const ultimoId = crypto.randomUUID()
    const texto = "Me refería a que agregues lo que me recomendaste"
    const ultimo = await enviar(texto, creado.body.credencial, ultimoId).expect(200)
    expect(ultimo.body).toMatchObject({ kind: "action", normalizedInstruction: "Agrega estado String a Prestamo." })
    expect(ultimo.body.actionId).not.toBe(segundo.body.actionId)
    vivo = ejecutarComandosUML(vivo, ultimo.body.plan.comandos, () => "estado-prestamo")
    revision++
    const completar = () => request(aplicacion).post(ruta(ultimo.body.actionId)).set({ Authorization: `Bearer ${creado.body.credencial}` })
      .send({ resultado: "applied", cambios: [{ commandIndex: 0, tipo: "UML_ELEMENT_CREATED", elemento: { id: "estado-prestamo", tipo: "attribute", nombreSnapshot: "estado" } }] })
    await completar().expect(200); await completar().expect(200)
    expect((await enviar(texto, creado.body.credencial, ultimoId).expect(200)).body.kind).toBe("action_already_applied")
    expect(interpretar).toHaveBeenCalledTimes(3)
    const duplicada = await enviar("Agrégalo entonces").expect(200)
    expect(duplicada.body.kind).toBe("clarification")
    expect(await mensajes.obtenerAccionIAPorMensaje(creado.body.proyecto.id, duplicada.body.mensajeHumano.id)).toBeNull()
    expect(vivo.clases[0].atributos).toHaveLength(1); expect(vivo.clases[1].atributos).toHaveLength(0)
    expect(responder).toHaveBeenCalledTimes(2)
    expect(interpretar.mock.calls.every(([solicitud]) => solicitud.instruccion === "Agrega estado String a Prestamo.")).toBe(true)
    expect(await mensajes.buscarRecomendaciones(creado.body.proyecto.id, creado.body.participante.id, 32)).toHaveLength(1)
    const actividad = (await eventos.listarPorProyecto({ projectId: creado.body.proyecto.id, limite: 20 })).items.filter((evento) => evento.mecanismo === "ai_cu04")
    expect(actividad).toHaveLength(1)
    expect(actividad[0]).toMatchObject({ solicitadoPorParticipantId: creado.body.participante.id, sourceMessageId: ultimo.body.mensajeHumano.id })
    const durable = (await request(aplicacion).get(`/api/proyectos/${creado.body.proyecto.id}`).set({ Authorization: `Bearer ${creado.body.credencial}` }).expect(200)).body
    expect(durable.revisionModelo).toBe(0); expect(durable.modelo.clases).toHaveLength(0)
    expect(original.clases[0].atributos).toHaveLength(0)
  })

  it("deriva Quiero que crees directamente a CU04", async () => {
    const creado = await crear()
    const texto = "Quiero que crees un modelo de ventas"
    interpretar.mockResolvedValueOnce({ resultado: "aclarar", mensaje: "Indica las clases y reglas de negocio del modelo de ventas.", comandos: [] })
    expect((await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)).body.kind).toBe("clarification")
    expect(interpretar.mock.calls[0][0].instruccion).toBe(texto)
    expect(responder).not.toHaveBeenCalled()
  })

  it("resuelve el incidente Prestamo: consejo con navegación no disponible, reformulación y temporal con guiones", async () => {
    const creado = await crear()
    const vivo = { ...modelo, clases: [{ ...modelo.clases[0], id: "prestamo-estable", nombre: "Prestamo" }] }
    const instruccion = "Agrega estado String a la clase Prestamo."
    responder.mockResolvedValueOnce({ respuesta: "Sugiero estado: String sin modificar el diagrama.", accionSugerida: "ENFOCAR_ELEMENTO", elementoRelacionadoId: "prestamo-estable", nivel: "sugerencia", categoriaRecomendacion: "OPCIONAL",
      recomendacion: { resumen: "Estado de Prestamo", targetElementIds: ["prestamo-estable"], normalizedInstruction: instruccion } })
    interpretar.mockResolvedValueOnce({ resultado: "aplicar", mensaje: "Estado preparado.", comandos: [{ tipo: "agregar_atributo", claseRef: "prestamo-estable", refTemporal: "tmp-attr-1", nombre: "estado", tipoDato: "String", visibilidad: "privada" }] })
    const enviar = (contenido: string, requestId = crypto.randomUUID()) => request(aplicacion).post(`/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo/interactuar`)
      .set({ Authorization: `Bearer ${creado.body.credencial}` }).send({ requestId, contenido, modeloEjecucion: vivo, revisionEditor: 9 })
    const consejo = await enviar("Recomiéndame un atributo para el estado de Prestamo. No modifiques el diagrama.").expect(200)
    expect(consejo.body.kind).toBe("advisory")
    expect(consejo.body.mensajeIA.recomendacion.normalizedInstruction).toBe(instruccion)
    expect(interpretar).not.toHaveBeenCalled()
    const requestId = crypto.randomUUID()
    const texto = "Me refería a que agregues lo que me recomendaste"
    const accion = await enviar(texto, requestId).expect(200)
    expect(accion.body).toMatchObject({ kind: "action", intent: "CONTEXTUAL_MODIFICATION", normalizedInstruction: instruccion,
      plan: { comandos: [{ tipo: "agregar_atributo", claseRef: "prestamo-estable", refTemporal: "tmp_attr_1", nombre: "estado", tipoDato: "String" }] } })
    expect((await enviar(texto, requestId).expect(200)).body.actionId).toBe(accion.body.actionId)
    expect(responder).toHaveBeenCalledTimes(1); expect(interpretar).toHaveBeenCalledTimes(1)
    const completar = () => request(aplicacion).post(`/api/proyectos/${creado.body.proyecto.id}/modelado-ia/acciones/${accion.body.actionId}/completar`)
      .set({ Authorization: `Bearer ${creado.body.credencial}` }).send({ resultado: "applied", cambios: [{ commandIndex: 0, tipo: "UML_ELEMENT_CREATED", elemento: { id: "estado-aplicado", tipo: "attribute", nombreSnapshot: "estado" } }] })
    await completar().expect(200); await completar().expect(200)
    const actividad = (await eventos.listarPorProyecto({ projectId: creado.body.proyecto.id, limite: 20 })).items.filter((evento) => evento.mecanismo === "ai_cu04")
    expect(actividad).toHaveLength(1)
    expect(actividad[0]).toMatchObject({ solicitadoPorParticipantId: creado.body.participante.id, sourceMessageId: accion.body.mensajeHumano.id })
    expect((await request(aplicacion).get(`/api/proyectos/${creado.body.proyecto.id}`).set({ Authorization: `Bearer ${creado.body.credencial}` }).expect(200)).body.revisionModelo).toBe(0)
    expect(vivo.clases[0].atributos).toEqual([])
  })

  it.each(["Sí, no lo hagas", "De acuerdo, no apliques la propuesta", "Si creas las clases recomendadas, ¿qué ocurriría?", "Quiero saber si puedes crear un modelo de ventas"])("no interpreta como ejecución una consulta o negación: %s", async (texto) => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    expect((await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)).body.kind).toBe("advisory")
    expect(interpretar).not.toHaveBeenCalled()
  })

  it.each(["Sí, hazlo", "Sí, crea las clases recomendadas", "De acuerdo, aplica la propuesta", "Bien agrégalo entonces", "Ejecuta"])("pide contexto si no hay propuesta para %s", async (texto) => {
    const creado = await crear()
    expect((await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)).body.kind).toBe("clarification")
    expect(interpretar).not.toHaveBeenCalled(); expect(responder).not.toHaveBeenCalled()
  })

  it.each([
    { destinos: [["venta"], ["cliente"]], esperado: "clarification" },
    { destinos: [["venta"], ["venta"]], esperado: "action" },
    { destinos: [["venta", "cliente"], ["cliente", "venta"]], esperado: "action" },
  ])("deduplica propuesta por instrucción y conjunto de destinos: $destinos", async ({ destinos, esperado }) => {
    const creado = await crear()
    for (const [indice, targetElementIds] of destinos.entries()) {
      responder.mockResolvedValueOnce({ respuesta: "Propuesta guardada.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "sugerencia", categoriaRecomendacion: "RECOMENDADO",
        recomendacion: { resumen: "Agregar total", targetElementIds, normalizedInstruction: indice ? "  Agrega  atributo total Double a Venta.  " : "Agrega atributo total Double a Venta." } })
      await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa el modelo.").expect(200)
    }
    responder.mockResolvedValueOnce({ respuesta: "Otra consulta.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", recomendacion: null })
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Tengo otra duda.").expect(200)
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú").expect(200)
    expect(respuesta.body.kind).toBe(esperado)
    expect(interpretar).toHaveBeenCalledTimes(esperado === "action" ? 1 : 0)
  })

  it("aclara una referencia contextual ambigua sin invocar CU04", async () => {
    const creado = await crear(); interpretar.mockClear()
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Bórralo.").expect(200)
    expect(respuesta.body.kind).toBe("clarification"); expect(respuesta.body.mensajeIA.contenido).toContain("inequivoca")
    expect(interpretar).not.toHaveBeenCalled()
  })

  it.each(["Hazlo", "Hazlo tú", "Aplica eso", "Crea todo lo que dijiste", "Crea todas las clases y relaciones que dijiste", "Crea todas las tablas y relaciones que dijiste", "Las que me indicaste anteriormente", "Hace rato me dijiste sobre modelar un sistema, hazme todo el modelo con sus relaciones y todo"])("resuelve %s sin otra consulta CU12", async (texto) => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)
    expect(respuesta.body).toMatchObject({ kind: "action", intent: "CONTEXTUAL_MODIFICATION", normalizedInstruction: "Agrega atributo total Double a la clase Venta." })
    expect(responder).toHaveBeenCalledTimes(1)
    expect(interpretar).toHaveBeenCalledTimes(1)
  })

  it.each([["limite", 429], ["timeout", 504], ["respuesta_invalida", 502]] as const)("controla error CU04 %s sin HTTP 500 ni acción", async (tipo, estado) => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    interpretar.mockRejectedValueOnce(new ErrorProveedorIA(tipo, "detalle privado", 12))
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú").expect(estado)
    expect(JSON.stringify(respuesta.body)).not.toContain("detalle privado")
    if (tipo === "limite") expect(respuesta.headers["retry-after"]).toBe("12")
  })

  it.each(["Hazlo tú", "Sí, hazlo", "De acuerdo, aplica la propuesta", "Me refería a que agregues lo que me recomendaste", "Bien agrégalo entonces", "Ejecuta"])("pide aclaración ante propuestas ambiguas con %s", async (texto) => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Cliente.").expect(200)
    responder.mockResolvedValueOnce({ respuesta: "Necesito requisitos adicionales.", accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", recomendacion: null })
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Tengo otra duda.").expect(200)
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)
    expect(respuesta.body.kind).toBe("clarification")
    expect(interpretar).not.toHaveBeenCalled()
  })

  it.each(["Hazlo tú", "Aplica la propuesta de Cliente"])("elige entre varias propuestas por continuidad o tema: %s", async (texto) => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Cliente.").expect(200)
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)
    expect(respuesta.body).toMatchObject({ kind: "action", normalizedInstruction: "Agrega atributo total Double a la clase Cliente." })
    expect(interpretar).toHaveBeenCalledTimes(1); expect(responder).toHaveBeenCalledTimes(2)
  })

  it("recupera una propuesta durable antigua por tema y aísla participantes intercalados", async () => {
    const creado = await crear()
    const unido = await request(aplicacion).post("/api/proyectos/unirse").send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Carlos" }).expect(200)
    responder.mockResolvedValueOnce({ respuesta: "Propuesta de devoluciones.", accionSugerida: "NINGUNA", elementoRelacionadoId: "venta", nivel: "sugerencia", categoriaRecomendacion: "RECOMENDADO",
      recomendacion: { resumen: "Devoluciones", targetElementIds: ["venta"], normalizedInstruction: "Agrega total Double a Venta para devoluciones." } })
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa devoluciones.").expect(200)
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Cliente.").expect(200)
    for (let indice = 0; indice < 20; indice++) await mensajes.crear({ id: `intercalado-${indice}`, projectId: creado.body.proyecto.id, tipoRemitente: "human", participantId: unido.body.participante.id,
      nombreVisibleSnapshot: "Carlos", contenido: "Otra conversación", requestId: null, replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: new Date(Date.now() + indice + 1000).toISOString() })
    await interactuar(creado.body.proyecto.id, unido.body.credencial, "Revisa Cliente.").expect(200)
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Aplica la propuesta de devoluciones").expect(200)
    expect(respuesta.body).toMatchObject({ kind: "action", normalizedInstruction: expect.stringContaining("devoluciones") })
    expect(interpretar).toHaveBeenCalledTimes(1); expect(responder).toHaveBeenCalledTimes(3)
  })

  it("distingue solicitud inválida HTTP 400 de error interno HTTP 500", async () => {
    const creado = await crear()
    await request(aplicacion).post(`/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo/interactuar`).set({ Authorization: `Bearer ${creado.body.credencial}` }).send({ contenido: "Hazlo tú" }).expect(400)
    interpretar.mockRejectedValueOnce(new TypeError("detalle-programacion-privado"))
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Crea Producto.").expect(500)
    expect(respuesta.body.codigo).toBe("ERROR_INTERNO")
    expect(JSON.stringify(respuesta.body)).not.toContain("detalle-programacion-privado")
  })

  it("construye contexto desde el UML vivo aunque la vista consultiva esté atrasada", async () => {
    const creado = await crear()
    await request(aplicacion).post(`/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo/interactuar`).set({ Authorization: `Bearer ${creado.body.credencial}` })
      .send({ requestId: crypto.randomUUID(), contenido: "Revisa el modelo actual.", modeloEjecucion: modelo, revisionEditor: 7,
        vistaActual: { ...vistaActual, modeloActual: { ...vistaActual.modeloActual, clases: [] } } }).expect(200)
    expect(responder.mock.calls[0][0].contexto.modeloActual.clases.map((clase: { id: string }) => clase.id)).toEqual(["venta", "cliente"])
  })

  it.each([true, false])("deriva modelo y diagnósticos de la misma versión viva (incompleto=%s)", async (incompleto) => {
    const creado = await crear()
    const vivo = { ...modelo, clases: [{ ...modelo.clases[1], atributos: [{ id: "id-cliente", nombre: "id", tipo: incompleto ? null : "Long", visibilidad: "privada" }] }] }
    const vistaObsoleta = { ...vistaActual,
      estadoUml: incompleto ? vistaActual.estadoUml : { estado: "invalido", problemas: ["diagnóstico obsoleto"], errores: ["diagnóstico obsoleto"], advertencias: [] },
      generacion: incompleto ? vistaActual.generacion : { estado: "no_apto", bloqueos: ["bloqueo obsoleto"], advertencias: [] },
    }
    await request(aplicacion).post(`/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo/interactuar`).set({ Authorization: `Bearer ${creado.body.credencial}` })
      .send({ requestId: crypto.randomUUID(), contenido: "Revisa Cliente en el modelo actual.", modeloEjecucion: vivo, revisionEditor: 8, vistaActual: vistaObsoleta }).expect(200)
    const contexto = responder.mock.calls[0][0].contexto
    expect(contexto.modeloActual.clases).toHaveLength(1)
    expect(contexto.modeloActual.clases[0].atributos[0].tipo).toBe(incompleto ? null : "Long")
    expect(contexto.estadoUml.estado).toBe(incompleto ? "incompleto" : "valido")
    expect(contexto.generacion.estado).toBe(incompleto ? "no_apto" : "apto")
    expect(JSON.stringify(contexto.estadoUml)).not.toContain("obsoleto")
    expect(JSON.stringify(contexto.generacion)).not.toContain("obsoleto")
  })

  it.each(["Hazlo tú", "Hazme todo el modelo", "Diseña el diagrama completo", "Hazme todo el modelo: crea Producto con id Long y OrdenCompra; asocia ambas clases de cero a muchos en ambos extremos."])("prepara modelo completo desde vacío una vez sin guardar: %s", async (orden) => {
    const creado = await crear()
    const projectId = creado.body.proyecto.id; const credential = creado.body.credencial
    const instruccion = "Crea Producto y OrdenCompra. Cada OrdenCompra se asocia a cero o muchos Producto; cada Producto a cero o muchas OrdenCompra."
    responder.mockResolvedValueOnce({ respuesta: instruccion, accionSugerida: "NINGUNA", elementoRelacionadoId: null, nivel: "sugerencia", categoriaRecomendacion: "RECOMENDADO",
      recomendacion: { resumen: "Modelo de compras", targetElementIds: [], normalizedInstruction: instruccion } })
    const comandos = [
      { tipo: "crear_clase", refTemporal: "tmp_producto", nombre: "Producto", abstracta: false },
      { tipo: "crear_clase", refTemporal: "tmp_orden", nombre: "OrdenCompra", abstracta: false },
      { tipo: "agregar_atributo", claseRef: "tmp_producto", refTemporal: "tmp_id", nombre: "id", tipoDato: "Long", visibilidad: "privada" },
      { tipo: "crear_relacion", tipoRelacion: "asociacion", refTemporal: "tmp_rel", claseOrigenRef: "tmp_orden", claseDestinoRef: "tmp_producto", cantidadDestinoPorOrigen: "0..*", cantidadOrigenPorDestino: "0..*", rolOrigen: null, rolDestino: null },
    ]
    interpretar.mockResolvedValueOnce({ resultado: "aplicar", mensaje: "Modelo preparado.", comandos })
    const vacio = { ...modelo, clases: [], relaciones: [] }
    const enviar = (contenido: string, requestId = crypto.randomUUID()) => request(aplicacion).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`)
      .set({ Authorization: `Bearer ${credential}` }).send({ contenido, requestId, modeloEjecucion: vacio, revisionEditor: 0 })
    await enviar("Recomienda un modelo concreto de compras.").expect(200)
    const requestId = crypto.randomUUID()
    const [a, b] = await Promise.all([enviar(orden, requestId).expect(200), enviar(orden, requestId).expect(200)])
    expect(a.body.kind).toBe("action"); expect(b.body.actionId).toBe(a.body.actionId)
    expect(a.body.plan.comandos).toHaveLength(4)
    expect(responder).toHaveBeenCalledTimes(1); expect(interpretar).toHaveBeenCalledTimes(1)
    const cambios = ["Producto", "OrdenCompra", "id", "Compras"].map((nombreSnapshot, commandIndex) => ({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id: `nuevo-${commandIndex}`, tipo: commandIndex === 3 ? "relationship" : commandIndex === 2 ? "attribute" : "class", nombreSnapshot } }))
    const completar = () => request(aplicacion).post(`/api/proyectos/${projectId}/modelado-ia/acciones/${a.body.actionId}/completar`).set({ Authorization: `Bearer ${credential}` }).send({ resultado: "applied", cambios })
    await completar().expect(200); await completar().expect(200)
    expect((await eventos.listarPorProyecto({ projectId, limite: 20 })).items.filter((item) => item.mecanismo === "ai_cu04")).toHaveLength(4)
    expect((await enviar(orden, requestId).expect(200)).body.kind).toBe("action_already_applied")
    const durable = (await request(aplicacion).get(`/api/proyectos/${projectId}`).set({ Authorization: `Bearer ${credential}` }).expect(200)).body
    expect(durable.revisionModelo).toBe(0); expect(durable.modelo.clases).toHaveLength(0)
  })

  it.each(["sin recomendación", "otro participante", "referencia obsoleta"].flatMap((caso) => ["Hazlo tú", "Me refería a que agregues lo que me recomendaste", "Bien agrégalo entonces", "Ejecuta"].map((texto) => ({ caso, texto }))))("aclara $caso con $texto sin preparar cambios", async ({ caso, texto }) => {
    const creado = await crear()
    if (caso === "otro participante") {
      const unido = await request(aplicacion).post("/api/proyectos/unirse").send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Carlos" }).expect(200)
      await interactuar(creado.body.proyecto.id, unido.body.credencial, "Revisa Venta.").expect(200)
    }
    if (caso === "referencia obsoleta") {
      await mensajes.crear({ id: "h-previo", projectId: creado.body.proyecto.id, tipoRemitente: "human", participantId: creado.body.participante.id, nombreVisibleSnapshot: "Renato", contenido: "Revisa", requestId: null, replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: new Date().toISOString() })
      await mensajes.crear({ id: "ia-previo", projectId: creado.body.proyecto.id, tipoRemitente: "ai", participantId: null, nombreVisibleSnapshot: null, contenido: "Propuesta", requestId: null, replyToMessageId: "h-previo", elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: new Date().toISOString(), recomendacion: { resumen: "Cambio obsoleto", targetElementIds: ["ya-no-existe"], normalizedInstruction: "Agrega total Double a Venta." } })
    }
    expect((await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)).body.kind).toBe("clarification")
    expect(interpretar).not.toHaveBeenCalled()
  })

  it("reanuda la misma solicitud tras límite sin duplicar humano ni acción", async () => {
    const creado = await crear(); const id = crypto.randomUUID()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    interpretar.mockRejectedValueOnce(new ErrorProveedorIA("limite", "privado", 1))
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú", id).expect(429)
    const accion = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú", id).expect(200)
    const repetida = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú", id).expect(200)
    expect(repetida.body.actionId).toBe(accion.body.actionId)
    expect((await mensajes.listarPorProyecto({ projectId: creado.body.proyecto.id, limite: 20 })).items.filter((mensaje) => mensaje.requestId === id && mensaje.tipoRemitente === "human")).toHaveLength(1)
    expect(interpretar).toHaveBeenCalledTimes(2)
  })

  it("valida nombres duplicados contra el modelo vigente antes de reservar una acción", async () => {
    const creado = await crear()
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    interpretar.mockResolvedValueOnce({ resultado: "aplicar", mensaje: "Preparado", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_venta", nombre: "Venta", abstracta: false }] })
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú").expect(200)
    expect(respuesta.body.kind).toBe("clarification")
    expect(await mensajes.obtenerAccionIAPorMensaje(creado.body.proyecto.id, respuesta.body.mensajeHumano.id)).toBeNull()
  })

  it.each(["Hazlo tú", "Sí, hazlo", "De acuerdo, aplica la propuesta", "Me refería a que agregues lo que me recomendaste", "Bien agrégalo entonces", "Ejecuta"])("no convierte %s en autorización implícita para eliminar", async (texto) => {
    const creado = await crear()
    responder.mockResolvedValueOnce({ respuesta: "Se podría eliminar Venta.", accionSugerida: "NINGUNA", elementoRelacionadoId: "venta", nivel: "sugerencia", categoriaRecomendacion: "RECOMENDADO",
      recomendacion: { resumen: "Eliminar Venta", targetElementIds: ["venta"], normalizedInstruction: "Elimina la clase Venta." } })
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    expect((await interactuar(creado.body.proyecto.id, creado.body.credencial, texto).expect(200)).body.kind).toBe("clarification")
    expect(interpretar).not.toHaveBeenCalled()
  })

  it("conserva la aclaración de un requestId aunque luego aparezca contexto nuevo", async () => {
    const creado = await crear(); const id = crypto.randomUUID()
    const aclaracion = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú", id).expect(200)
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    const repetida = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo tú", id).expect(200)
    expect(repetida.body.mensajeIA.id).toBe(aclaracion.body.mensajeIA.id)
    expect(interpretar).not.toHaveBeenCalled()
  })

  it("prefiere el hilo del participante ante mensajes intercalados", async () => {
    const creado = await crear("Renato")
    const unido = await request(aplicacion).post("/api/proyectos/unirse").send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Carlos" }).expect(200)
    await interactuar(creado.body.proyecto.id, creado.body.credencial, "Revisa Venta.").expect(200)
    await interactuar(creado.body.proyecto.id, unido.body.credencial, "Revisa Cliente.").expect(200)
    const accion = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Hazlo.").expect(200)
    expect(accion.body).toMatchObject({ kind: "action", normalizedInstruction: expect.stringContaining("Venta") })
    expect(interpretar.mock.calls.at(-1)?.[0].instruccion).toContain("Venta")
  })

  it("impide secuestro y cruce de proyecto al completar una accion", async () => {
    const a = await crear("Renato"); const b = await request(aplicacion).post("/api/proyectos").send({ nombre: "Otro", nombreParticipante: "Carlos" }).expect(201)
    const accion = await interactuar(a.body.proyecto.id, a.body.credencial, "Agrega total Double a Venta.").expect(200)
    await request(aplicacion).post(`/api/proyectos/${a.body.proyecto.id}/modelado-ia/acciones/${accion.body.actionId}/completar`)
      .set({ Authorization: `Bearer ${b.body.credencial}` }).send({ resultado: "failed" }).expect(403)
    await request(aplicacion).post(`/api/proyectos/${b.body.proyecto.id}/modelado-ia/acciones/${accion.body.actionId}/completar`)
      .set({ Authorization: `Bearer ${b.body.credencial}` }).send({ resultado: "failed" }).expect(404)
  })

  it("mantiene un CU04 directo autenticado y retira los endpoints publicos heredados", async () => {
    const creado = await crear(); const projectId = creado.body.proyecto.id
    await request(aplicacion).post("/api/ia/modelado/interpretar").send({}).expect(404)
    await request(aplicacion).post(`/api/proyectos/${projectId}/modelado-ia/interpretar`).send({}).expect(401)
    const accion = await request(aplicacion).post(`/api/proyectos/${projectId}/modelado-ia/interpretar`).set({ Authorization: `Bearer ${creado.body.credencial}` })
      .send({ requestId: crypto.randomUUID(), instruccion: "Agrega total Double a Venta.", modelo, revision: 2 }).expect(200)
    expect(accion.body).toMatchObject({ kind: "action", sourceMessageId: null })
    await request(aplicacion).post(`/api/proyectos/${projectId}/modelado-ia/acciones/${accion.body.actionId}/completar`).set({ Authorization: `Bearer ${creado.body.credencial}` })
      .send({ resultado: "applied", cambios: [{ commandIndex: 0, tipo: "UML_ELEMENT_CREATED", elemento: { id: "total-directo", tipo: "attribute", nombreSnapshot: "total" } }] }).expect(200)
    const evento = (await eventos.listarPorProyecto({ projectId, limite: 20 })).items.find((item) => item.mecanismo === "ai_cu04")
    expect(evento).toMatchObject({ solicitadoPorParticipantId: creado.body.participante.id, sourceMessageId: null })
  })
})
