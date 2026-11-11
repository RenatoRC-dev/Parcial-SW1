import { ejecutarComandosUML } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/EjecutorComandosUML.js"
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
import { ErrorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { ErrorProveedorIA } from "../../../asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import { exportarModeloXmi } from "../../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"

vi.mock("../../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js", () => ({ exportarModeloXmi: vi.fn(async () => Buffer.from("<XMI/>")) }))
const modelo = { id: "modelo", nombre: "Ventas", version: "4.2.0", clases: [], relaciones: [] }

describe("IA-S2 ruta autenticada del asistente único", () => {
  let directorio: string
  let app: ReturnType<typeof crearAplicacionGeneracionBackend>
  const planificar = vi.fn()
  const responder = vi.fn()
  const interpretarCambiosUML = vi.fn()
  const comprobarEstado = vi.fn(async () => "disponible" as const)
  let mensajes: RepositorioMensajesMemoria
  let codigoAcceso: string
  let projectId: string; let credential: string
  beforeEach(async () => {
    vi.clearAllMocks()
    directorio = await mkdtemp(join(tmpdir(), "nexocase-local-"))
    planificar.mockResolvedValue({ operacion: "conversar", argumentos: {}, respuesta: "Orientación sobre tu modelo actual." })
    interpretarCambiosUML.mockReset()
    interpretarCambiosUML.mockResolvedValue({ resultado: "aplicar", mensaje: "Propuesta", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente" }, { tipo: "agregar_atributo", claseRef: "tmp_cliente", refTemporal: "tmp_id", nombre: "id", tipoDato: "Long", visibilidad: "privada" }] })
    mensajes = new RepositorioMensajesMemoria()
    app = crearAplicacionGeneracionBackend({ planificadorLocal: { planificar, comprobarEstado }, proveedorAsistenteContextual: { responder }, proveedorIA: { interpretarCambiosUML },
      accesoProyectos: { proyectos: new RepositorioProyectosArchivos(directorio), participantes: new RepositorioParticipantesMemoria(),
        protector: new ProtegerAccesoProyecto("local-test"), mensajes, eventos: new RepositorioEventosMemoria() },
    })
    const creado = await request(app).post("/api/proyectos").send({ nombre: "Ventas", nombreParticipante: "Ana" }).expect(201)
    codigoAcceso = creado.body.codigoAcceso; projectId = creado.body.proyecto.id; credential = creado.body.credencial
  })
  afterEach(async () => { await rm(directorio, { recursive: true, force: true }) })
  function turno(contenido: string, requestId = crypto.randomUUID()) {
    return request(app).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`).set("Authorization", `Bearer ${credential}`)
      .send({ requestId, contenido, modeloEjecucion: modelo, revisionEditor: 3 })
  }
  function elegir(operacion: string) { planificar.mockResolvedValue({ operacion, argumentos: {}, respuesta: "No usar este texto como resultado de ejecución." }) }

  const consejo = "Cliente: id Long, nombre String. Venta: total Double. Producto: precio Double. Reembolso: motivo String. Factura: numero String."
  async function recomendar(respuesta = consejo) {
    planificar.mockResolvedValue({ operacion: "conversar", argumentos: {}, respuesta })
    return turno("Recomiéndame clases y atributos para ventas y reembolsos").expect(200)
  }
  function planConsejo() {
    interpretarCambiosUML.mockResolvedValue({ resultado: "aplicar", mensaje: "Plan validado, pendiente de aplicación", comandos:
      [["Cliente", "id", "Long"], ["Cliente", "nombre", "String"], ["Venta", "total", "Double"], ["Producto", "precio", "Double"], ["Reembolso", "motivo", "String"], ["Factura", "numero", "String"]].flatMap(([nombre, atributo, tipo], i) => [
        ...(i === 1 ? [] : [{ tipo: "crear_clase", refTemporal: "tmp_"+nombre, nombre, abstracta: false }]),
        { tipo: "agregar_atributo", claseRef: "tmp_"+nombre, refTemporal: "tmp_"+atributo, nombre: atributo, tipoDato: tipo, visibilidad: "privada" },
      ]) })
  }

  it.each(["Créalos", "Créalo", "Hazlo", "Aplica eso", "Crea lo que me recomendaste", "Lo que me sugeriste ahora créalo", "Sí, esos créalos", "Si esos crealos", "Lo que me indicaste créalo", "Lo que me indicaste crealos"])("consejo local -> %s -> CU04 validado, correlacionado e idempotente", async (texto) => {
    const original = await recomendar(); planConsejo()
    expect(original.body.mensajeIA).toMatchObject({ procedencia: [{ nombre: "ollama", estado: "completed" }], recomendacion: { fuente: "asesoria_local", revisionEditor: 3 } })
    const requestId = crypto.randomUUID()
    const accion = await turno(texto, requestId).expect(200)
    expect(accion.body).toMatchObject({ kind: "action", baseEditorRevision: 3, procedencia: [{ nombre: "groq_cu04", estado: "completed" }] })
    expect(interpretarCambiosUML.mock.calls[0][0].instruccion).toContain(consejo)
    const aplicada = ejecutarComandosUML(modelo, accion.body.plan.comandos, () => crypto.randomUUID())
    expect(aplicada.clases.map(c => [c.nombre, c.atributos.map(a => [a.nombre, a.tipo])])).toEqual([
      ["Cliente", [["id", "Long"], ["nombre", "String"]]], ["Venta", [["total", "Double"]]], ["Producto", [["precio", "Double"]]], ["Reembolso", [["motivo", "String"]]], ["Factura", [["numero", "String"]]],
    ])
    expect(aplicada.relaciones).toEqual([])
    const durable = await mensajes.obtenerAccionIAPorId(projectId, accion.body.actionId)
    expect(durable?.proposalMessageId).toBe(original.body.mensajeIA.id)
    expect((await turno(texto, requestId).expect(200)).body.actionId).toBe(accion.body.actionId)
    expect(interpretarCambiosUML).toHaveBeenCalledOnce(); expect(planificar).toHaveBeenCalledOnce()
    expect((await request(app).get(`/api/proyectos/${projectId}`).set("Authorization", `Bearer ${credential}`)).body.revisionModelo).toBe(0)
  })

  it("pregunta real con errata conserva el consejo Clase: Nombre (...) y lo ejecuta por CU04", async () => {
    const respuesta = "Clase: Cliente (id: Long, nombre: String). Clase: Venta (total: Double)."
    planificar.mockResolvedValue({ operacion: "conversar", argumentos: {}, respuesta })
    const original = await turno("Tengo que realizar un modelo para una venta, que clases me recominedas crear? Usa Clase: Cliente (id: Long, nombre: String). Clase: Venta (total: Double).").expect(200)
    expect(original.body.mensajeIA.recomendacion).toMatchObject({ fuente: "asesoria_local", revisionEditor: 3 })
    expect(original.body.mensajeIA.contenido).toBe(respuesta)
    expect(original.body.mensajeIA.procedencia).toEqual([{ nombre: "ollama", estado: "completed" }])
    interpretarCambiosUML.mockResolvedValue({ resultado: "aplicar", mensaje: "Plan", comandos: [
      { tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente" },
      { tipo: "agregar_atributo", refTemporal: "tmp_id", claseRef: "tmp_cliente", nombre: "id", tipoDato: "Long", visibilidad: "privada" },
      { tipo: "agregar_atributo", refTemporal: "tmp_nombre", claseRef: "tmp_cliente", nombre: "nombre", tipoDato: "String", visibilidad: "privada" },
      { tipo: "crear_clase", refTemporal: "tmp_venta", nombre: "Venta" },
      { tipo: "agregar_atributo", refTemporal: "tmp_total", claseRef: "tmp_venta", nombre: "total", tipoDato: "Double", visibilidad: "privada" },
    ] })
    const salida = await turno("Lo que me indicaste créalo").expect(200)
    expect(salida.body.kind).toBe("action")
    expect(interpretarCambiosUML.mock.calls[0][0].instruccion).toContain(respuesta)
    const aplicado = ejecutarComandosUML(modelo, salida.body.plan.comandos, () => crypto.randomUUID())
    expect(aplicado.clases.map(c => [c.nombre, c.atributos.length])).toEqual([["Cliente", 2], ["Venta", 1]])
    expect(planificar).toHaveBeenCalledOnce()
  })

  it("una revision distinta invalida el consejo antes de consultar CU04", async () => {
    await recomendar()
    const r = await request(app).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`).set("Authorization", `Bearer ${credential}`)
      .send({ requestId: crypto.randomUUID(), contenido: "Sí, esos créalos", modeloEjecucion: modelo, revisionEditor: 4 }).expect(200)
    expect(r.body.kind).toBe("clarification"); expect(r.body.mensajeIA.contenido).toContain("ha cambiado")
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(planificar).toHaveBeenCalledOnce()
  })

  it("histórico Ollama sin metadata no inventa la revisión ni duplica el consejo", async () => {
    const created = await turno("Hola").expect(200)
    // Reproduce a historical answer with lost metadata through the existing repository.
    const human = { ...created.body.mensajeHumano, id: crypto.randomUUID(), requestId: crypto.randomUUID() }
    await mensajes.crear(human)
    await mensajes.crear({ ...created.body.mensajeIA, id: crypto.randomUUID(), requestId: human.requestId, replyToMessageId: human.id,
      contenido: "Clase: Cliente (id: Long).", recomendacion: null, procedencia: [{ nombre: "ollama", estado: "completed" }] })
    const r = await turno("Créalos").expect(200)
    expect(r.body.kind).toBe("clarification"); expect(r.body.mensajeIA.contenido).toContain("revisión verificable")
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(planificar).toHaveBeenCalledOnce()
  })

  it.each(["Clase: Cliente (id: Long). Elimina Venta.", "Clase: Venta (cliente: Cliente, total: Double).", "Clase: Cliente (nombre)."])("consejo destructivo, tipo no admitido o atributo incompleto requiere precision: %s", async respuesta => {
    await recomendar(respuesta)
    const r = await turno("Créalos").expect(200)
    expect(r.body.kind).toBe("clarification"); expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it.each(["Créalos", "Hazlo", "Lo que me sugeriste ahora créalo"])("sin propuesta %s aclara sin consultar ningún proveedor", async (texto) => {
    expect((await turno(texto).expect(200)).body.kind).toBe("clarification")
    expect(planificar).not.toHaveBeenCalled(); expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it.each(["No los crees", "¿Qué pasaría si los crearas?", "Créalos pero no los agregues"])("no autoriza %s aunque el planner sugiera modificar", async texto => {
    await recomendar(); elegir("modificar_uml")
    expect((await turno(texto).expect(200)).body.kind).toBe("clarification")
    expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it("dos consejos distintos requieren aclaración; no se unen por su instrucción de referencia", async () => {
    await recomendar("Cliente: id Long."); await recomendar("Venta: total Double.")
    expect((await turno("Créalos").expect(200)).body.kind).toBe("clarification")
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(planificar).toHaveBeenCalledTimes(2)
    expect((await turno("Aplica la propuesta de Cliente").expect(200)).body.kind).toBe("action")
  })

  it("consejos equivalentes son una propuesta y sobreviven a mensajes antiguos fuera de la ventana local", async () => {
    await recomendar("Cliente: id Long."); await recomendar("Cliente: id Long.")
    for (let i=0; i<20; i++) await turno("Hola "+i).expect(200)
    const llamadas = planificar.mock.calls.length
    expect((await turno("Hazlo").expect(200)).body.kind).toBe("action")
    expect(planificar).toHaveBeenCalledTimes(llamadas)
  })

  it("otro participante no puede ejecutar el consejo; los mensajes intercalados no cambian su dueño", async () => {
    await recomendar()
    const unido = await request(app).post("/api/proyectos/unirse").send({ codigoAcceso, nombreParticipante: "Luis" }).expect(200)
    const resultado = await request(app).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`).set("Authorization", `Bearer ${unido.body.credencial}`).send({ requestId: crypto.randomUUID(), contenido: "Créalos", modeloEjecucion: modelo, revisionEditor: 3 }).expect(200)
    expect(resultado.body.kind).toBe("clarification"); expect(interpretarCambiosUML).not.toHaveBeenCalled()
    planConsejo(); expect((await turno("Hazlo").expect(200)).body.kind).toBe("action")
  })

  it("fallo CU04 preserva el consejo para reintento y no activa fallback", async () => {
    await recomendar(); interpretarCambiosUML.mockRejectedValueOnce(new ErrorProveedorIA("no_disponible", "offline"))
    const id = crypto.randomUUID(); await turno("Créalos", id).expect(503)
    planConsejo(); expect((await turno("Créalos", id).expect(200)).body.kind).toBe("action")
    expect(planificar).toHaveBeenCalledOnce(); expect(responder).not.toHaveBeenCalled()
  })

  it("una aplicación fallida conserva la propuesta para una nueva autorización", async () => {
    await recomendar(); planConsejo()
    const primera = await turno("Créalos").expect(200)
    const cierre = await request(app).post(`/api/proyectos/${projectId}/modelado-ia/acciones/${primera.body.actionId}/completar`).set("Authorization", `Bearer ${credential}`).send({ resultado: "failed" }).expect(200)
    expect(cierre.body.mensajeIA.procedencia).toEqual([{ nombre: "groq_cu04", estado: "completed" }])
    const segunda = await turno("Hazlo").expect(200)
    expect(segunda.body.kind).toBe("action")
    expect(segunda.body.actionId).not.toBe(primera.body.actionId)
    expect(planificar).toHaveBeenCalledOnce()
  })

  it("una referencia local obsoleta se aclara antes de CU04", async () => {
    planificar.mockResolvedValue({ operacion: "conversar", argumentos: {}, respuesta: "Prestamo: estado String." })
    await request(app).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`).set("Authorization", `Bearer ${credential}`)
      .send({ requestId: crypto.randomUUID(), contenido: "Recomiéndame un atributo de Prestamo", revisionEditor: 3,
        modeloEjecucion: { ...modelo, clases: [{ id: "prestamo", nombre: "Prestamo", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }] } }).expect(200)
    const salida = await turno("Hazlo").expect(200)
    expect(salida.body.kind).toBe("clarification")
    expect(salida.body.mensajeIA.contenido).toContain("ya no existe")
    expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it.each([
    [[{ tipo: "crear_clase", refTemporal: "tmp_ajeno", nombre: "Intruso", abstracta: false }]],
    [[{ tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente", abstracta: false }, { tipo: "agregar_atributo", claseRef: "tmp_cliente", refTemporal: "tmp_intruso", nombre: "secreto", tipoDato: "String", visibilidad: "privada" }]],
  ])("rechaza comandos ajenos al consejo sin reservar acción", async comandos => {
    await recomendar(); interpretarCambiosUML.mockResolvedValue({ resultado: "aplicar", mensaje: "Plan", comandos })
    expect((await turno("Créalos").expect(200)).body.kind).toBe("clarification")
  })

  it("mantiene CU12 e idempotencia sin recurrir al Groq conversacional", async () => {
    const id = crypto.randomUUID()
    const primera = await turno("Hola, acompáñame a revisar el dominio", id).expect(200)
    const segunda = await turno("Hola, acompáñame a revisar el dominio", id).expect(200)
    expect(primera.body.kind).toBe("advisory")
    expect(segunda.body.mensajeIA.id).toBe(primera.body.mensajeIA.id)
    expect(planificar).toHaveBeenCalledTimes(1)
    expect(responder).not.toHaveBeenCalled(); expect(interpretarCambiosUML).not.toHaveBeenCalled()
    expect(planificar.mock.calls[0][0].contexto.participanteActual.nombreVisible).toBe("Ana")
  })

  it("CU04 es el único intérprete de mutaciones y devuelve un plan, no un éxito aplicado", async () => {
    elegir("modificar_uml")
    const resultado = await turno("Crea la clase Cliente").expect(200)
    expect(resultado.body).toMatchObject({ kind: "action", baseEditorRevision: 3, normalizedInstruction: "Crea la clase Cliente" })
    expect(interpretarCambiosUML).toHaveBeenCalledTimes(1)
    expect((await request(app).get(`/api/proyectos/${projectId}`).set("Authorization", `Bearer ${credential}`)).body.revisionModelo).toBe(0)
  })

  it.each(["¿Qué pasaría si creara Cliente?", "No crees Cliente", "¿Qué es composición?"])("el modelo no puede autorizar cambios para %s", async (texto) => {
    elegir("modificar_uml")
    expect((await turno(texto).expect(200)).body.kind).toBe("clarification")
    expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it("valida un UML vacío con CU08, sin IA especialista ni guardar", async () => {
    elegir("validar_uml")
    const resultado = await turno("Valida el modelo").expect(200)
    expect(resultado.body).toMatchObject({ kind: "tool", operacion: "validar_uml", baseEditorRevision: 3 })
    expect(resultado.body.mensajeIA.contenido).toContain("UML válido")
    expect(resultado.body.mensajeIA.contenido).toContain("Spring: no apto")
    expect(resultado.body.mensajeIA.procedencia).toEqual([{ nombre: "cu08", estado: "completed" }])
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(responder).not.toHaveBeenCalled()
  })

  it("exporta con el servicio CU07 y solo entrega artefacto después de completarlo", async () => {
    elegir("exportar_xmi")
    const resultado = await turno("Exporta XMI").expect(200)
    expect(exportarModeloXmi).toHaveBeenCalledWith(modelo)
    expect(resultado.body.mensajeIA.procedencia).toEqual([{ nombre: "cu07", estado: "completed" }])
    expect(resultado.body).toMatchObject({ kind: "workflow", flujo: { estado: "ready", archivo: { nombre: "modelo.xmi", mime: "application/xml" } } })
    const archivo = await request(app).get(`/api/proyectos/${projectId}/asistente-colaborativo/turnos/${resultado.body.flujo.requestId}/archivo`).set("Authorization", `Bearer ${credential}`).expect(200)
    expect(archivo.text).toBe("<XMI/>")
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(responder).not.toHaveBeenCalled()
  })

  it("no afirma exportación si falla CU07", async () => {
    elegir("exportar_xmi"); vi.mocked(exportarModeloXmi).mockRejectedValueOnce(new Error("internal"))
    const resultado = await turno("Exporta XMI").expect(503)
    expect(resultado.body.artifact).toBeUndefined()
  })

  it.each(["¿Cómo exporto XMI?", "No exportes XMI", "Exporta XMI pero no lo hagas"])("no ejecuta una clasificación errónea: %s", async (texto) => {
    elegir("exportar_xmi")
    expect((await turno(texto).expect(200)).body.kind).toBe("clarification")
    expect(exportarModeloXmi).not.toHaveBeenCalled()
  })

  it.each(["analizar_imagen", "importar_xmi", "generar_spring", "automatizar_ea", "aclarar"])("distingue %s y reconoce límites de este slice sin éxito falso", async (operacion) => {
    elegir(operacion)
    expect((await turno("Procesa mi solicitud").expect(200)).body.kind).toBe("clarification")
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(exportarModeloXmi).not.toHaveBeenCalled()
  })

  it.each([{ operacion: "shell", argumentos: {}, respuesta: "Ejecutado" }, { operacion: "modificar_uml", argumentos: { projectId: "otro" }, respuesta: "Listo" }])("revalida proveedores inyectados y rechaza parámetros alucinados", async (plan) => {
    planificar.mockResolvedValue(plan)
    await turno("Crea Cliente").expect(502)
    expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it.each([["no_disponible", 503], ["timeout", 504], ["respuesta_invalida", 502]] as const)("fallo local %s no activa fallback", async (tipo, status) => {
    planificar.mockRejectedValueOnce(new ErrorAsistenteContextual(tipo, "test"))
    await turno("Crea Cliente").expect(status)
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(responder).not.toHaveBeenCalled()
    await request(app).get("/api/health").expect(200, { estado: "ok" })
  })

  it("Groq CU04 no disponible no afirma éxito ni cambia de proveedor", async () => {
    elegir("modificar_uml"); interpretarCambiosUML.mockRejectedValueOnce(new ErrorProveedorIA("no_disponible", "offline"))
    await turno("Crea Cliente").expect(503)
    expect(responder).not.toHaveBeenCalled()
  })

  it("autoriza antes de inferir y protege el diagnóstico local", async () => {
    await request(app).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`).send({ requestId: crypto.randomUUID(), contenido: "Crea Cliente" }).expect(401)
    await request(app).get(`/api/proyectos/${projectId}/asistente-colaborativo/proveedor-local`).expect(401)
    expect(planificar).not.toHaveBeenCalled(); expect(comprobarEstado).not.toHaveBeenCalled()
    await request(app).get(`/api/proyectos/${projectId}/asistente-colaborativo/proveedor-local`).set("Authorization", `Bearer ${credential}`).expect(200, { modo: "hybrid_local", estado: "disponible" })
  })
})
