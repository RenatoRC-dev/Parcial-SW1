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
  let projectId: string; let credential: string
  beforeEach(async () => {
    vi.clearAllMocks()
    directorio = await mkdtemp(join(tmpdir(), "nexocase-local-"))
    planificar.mockResolvedValue({ operacion: "conversar", argumentos: {}, respuesta: "Orientación sobre tu modelo actual." })
    interpretarCambiosUML.mockResolvedValue({ resultado: "aplicar", mensaje: "Propuesta", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente" }] })
    app = crearAplicacionGeneracionBackend({ planificadorLocal: { planificar, comprobarEstado }, proveedorAsistenteContextual: { responder }, proveedorIA: { interpretarCambiosUML },
      accesoProyectos: { proyectos: new RepositorioProyectosArchivos(directorio), participantes: new RepositorioParticipantesMemoria(),
        protector: new ProtegerAccesoProyecto("local-test"), mensajes: new RepositorioMensajesMemoria(), eventos: new RepositorioEventosMemoria() },
    })
    const creado = await request(app).post("/api/proyectos").send({ nombre: "Ventas", nombreParticipante: "Ana" }).expect(201)
    projectId = creado.body.proyecto.id; credential = creado.body.credencial
  })
  afterEach(async () => { await rm(directorio, { recursive: true, force: true }) })
  function turno(contenido: string, requestId = crypto.randomUUID()) {
    return request(app).post(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`).set("Authorization", `Bearer ${credential}`)
      .send({ requestId, contenido, modeloEjecucion: modelo, revisionEditor: 3 })
  }
  function elegir(operacion: string) { planificar.mockResolvedValue({ operacion, argumentos: {}, respuesta: "No usar este texto como resultado de ejecución." }) }

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
    expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(responder).not.toHaveBeenCalled()
  })

  it("exporta con el servicio CU07 y solo entrega artefacto después de completarlo", async () => {
    elegir("exportar_xmi")
    const resultado = await turno("Exporta XMI").expect(200)
    expect(exportarModeloXmi).toHaveBeenCalledWith(modelo)
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
