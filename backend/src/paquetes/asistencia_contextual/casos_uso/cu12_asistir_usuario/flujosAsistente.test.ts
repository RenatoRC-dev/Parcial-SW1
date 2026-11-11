import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import JSZip from "jszip"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import { ErrorProveedorVision } from "../../../asistencia_ia/compartido/proveedores/vision/ProveedorVisionUML.js"
import { ErrorInteroperabilidadXmi } from "../../../interoperabilidad/compartido/crunch_uml/AdaptadorCrunchUML.js"
import { exportarModeloXmi } from "../../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import { importarModeloXmi } from "../../../interoperabilidad/casos_uso/cu06_importar_modelo_xmi/importarModeloXmi.js"
import { fixtureCliente } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/fixtureCliente.js"

vi.mock("../../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js", () => ({ exportarModeloXmi: vi.fn() }))
vi.mock("../../../interoperabilidad/casos_uso/cu06_importar_modelo_xmi/importarModeloXmi.js", () => ({ importarModeloXmi: vi.fn() }))
const modelo = { ...fixtureCliente, clases: fixtureCliente.clases.map((c) => ({ ...c, posicion: { x: 0, y: 0 } })) }
const candidato = { clases: [{ refTemporal: "tmp_pedido", nombre: "Pedido", atributos: [] }], relaciones: [], advertencias: ["Revisar la imagen antes de agregar."] }
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])

describe("turnos atómicos y servicios del asistente", () => {
  let directorio: string; let projectId: string; let credential: string; let otro: string
  let app: ReturnType<typeof crearAplicacionGeneracionBackend>
  let repo: RepositorioMensajesMemoria
  let deps: Parameters<typeof crearAplicacionGeneracionBackend>[0]
  const analizarImagen = vi.fn(); const responder = vi.fn(); const interpretarCambiosUML = vi.fn(); const planificar = vi.fn()
  const importar = vi.mocked(importarModeloXmi); const exportar = vi.mocked(exportarModeloXmi)
  beforeEach(async () => {
    vi.resetAllMocks()
    directorio = await mkdtemp(join(tmpdir(), "chat-flujos-")); repo = new RepositorioMensajesMemoria()
    analizarImagen.mockResolvedValue({ resultado: "candidato", candidato, mensaje: "Imagen analizada", modelo: "vision-simulada" })
    importar.mockResolvedValue({ modelo: { ...modelo, clases: modelo.clases.map((c) => ({ ...c, nombre: "Importado" })) }, advertencias: [{ codigo: "OMITIDO", mensaje: "Operación no soportada omitida." }] })
    exportar.mockResolvedValue(Buffer.from("<XMI>archivo del servicio</XMI>"))
    planificar.mockImplementation(async (s: { pregunta: string }) => ({ operacion: s.pregunta.includes("Adjunto: imagen") ? "analizar_imagen" : s.pregunta.includes("Adjunto: xmi") ? "importar_xmi" : /spring|backend/i.test(s.pregunta) ? "generar_spring" : "exportar_xmi", argumentos: {}, respuesta: "Plan" }))
    deps = { planificadorLocal: { planificar }, proveedorVision: { analizarImagen }, proveedorAsistenteContextual: { responder }, proveedorIA: { interpretarCambiosUML }, accesoProyectos: {
      proyectos: new RepositorioProyectosArchivos(directorio), participantes: new RepositorioParticipantesMemoria(), protector: new ProtegerAccesoProyecto("chat-workflow-test"), mensajes: repo, eventos: new RepositorioEventosMemoria() } }
    app = crearAplicacionGeneracionBackend(deps)
    const creado = await request(app).post("/api/proyectos").send({ nombre: "Proyecto", nombreParticipante: "Ana" }).expect(201)
    projectId = creado.body.proyecto.id; credential = creado.body.credencial
    const unido = await request(app).post("/api/proyectos/unirse").send({ codigoAcceso: creado.body.codigoAcceso, nombreParticipante: "Luis" }).expect(200)
    otro = unido.body.credencial
  })
  afterEach(async () => { await rm(directorio, { recursive: true, force: true }) })
  const ruta = () => `/api/proyectos/${projectId}/asistente-colaborativo`
  const entrada = (contenido: string, requestId = crypto.randomUUID()) => ({ requestId, contenido, modeloEjecucion: modelo, revisionEditor: 7 })
  const adjuntar = (turno = entrada("Analiza y agrega este diagrama"), datos = png, nombre = "diagrama.png", mime = "image/png") => request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).field("turno", JSON.stringify(turno)).attach("archivo", datos, { filename: nombre, contentType: mime })
  const confirmar = (id: string, decision = "confirmar", cred = credential, revisionEditor = 7) => request(app).post(`${ruta()}/turnos/${id}/confirmar`).set("Authorization", `Bearer ${cred}`).send({ decision, revisionEditor, modeloEjecucion: modelo })

  it("imagen+instrucción son un turno, CU05 recibe el texto y nunca llega al CU12 consultivo", async () => {
    const turno = entrada("Analiza y agrega este diagrama")
    const resultado = await adjuntar(turno).expect(200)
    expect(resultado.body).toMatchObject({ kind: "workflow", flujo: { estado: "review", operacion: "analizar_imagen", revision: 7 } })
    expect(resultado.body.mensajeHumano.contenido).toContain(turno.contenido)
    expect(resultado.body.mensajeHumano.contenido).toContain("diagrama.png")
    expect(analizarImagen.mock.calls[0][0]).toMatchObject({ instruccion: turno.contenido, mimeType: "image/png" })
    expect(planificar.mock.calls[0][0].pregunta).toContain("Adjunto: imagen")
    expect(resultado.body.mensajeIA.procedencia).toEqual([{ nombre: "ollama", estado: "completed" }, { nombre: "groq_cu05", estado: "completed" }])
    expect(JSON.stringify(planificar.mock.calls[0][0])).not.toContain("base64")
    expect(responder).not.toHaveBeenCalled(); expect(interpretarCambiosUML).not.toHaveBeenCalled()
    const autorizado = await confirmar(turno.requestId).expect(200)
    expect(autorizado.body.modeloResultado.clases.map((c: { nombre: string }) => c.nombre)).toEqual(["Cliente", "Pedido"])
    expect((await request(app).get(`/api/proyectos/${projectId}`).set("Authorization", `Bearer ${credential}`)).body.revisionModelo).toBe(0)
  })

  it("rechazar la confirmación impide emitir y completar una mutación", async () => {
    const t = entrada("Analiza imagen"); await adjuntar(t).expect(200)
    expect((await confirmar(t.requestId, "rechazar").expect(200)).body.flujo.estado).toBe("cancelled")
    expect((await confirmar(t.requestId).expect(200)).body.modeloResultado).toBeUndefined()
    await request(app).post(`${ruta()}/turnos/${t.requestId}/completar`).set("Authorization", `Bearer ${credential}`).send({ resultado: "applied", modeloEjecucion: modelo }).expect(409)
  })

  it("la revisión o contenido obsoletos no autorizan la propuesta", async () => {
    const t = entrada("Analiza imagen"); await adjuntar(t).expect(200)
    await confirmar(t.requestId, "confirmar", credential, 8).expect(409)
    await request(app).post(`${ruta()}/turnos/${t.requestId}/confirmar`).set("Authorization", `Bearer ${credential}`).send({ decision: "confirmar", revisionEditor: 7, modeloEjecucion: { ...modelo, clases: [] } }).expect(409)
    expect((await repo.obtenerFlujo(projectId, t.requestId))?.estado).toBe("review")
  })

  it("no permite confirmar ni descargar el turno de otro participante", async () => {
    const t = entrada("Analiza imagen"); await adjuntar(t).expect(200)
    await confirmar(t.requestId, "confirmar", otro).expect(403)
    await request(app).get(`${ruta()}/turnos/${t.requestId}/archivo`).set("Authorization", `Bearer ${otro}`).expect(403)
    const lista = await request(app).get(`${ruta()}/turnos`).set("Authorization", `Bearer ${otro}`).expect(200)
    expect(lista.body).toEqual([])
  })

  it("repite/recupera el candidato después de recrear el servicio sin duplicar CU05", async () => {
    const t = entrada("Analiza imagen"); const primera = await adjuntar(t).expect(200)
    app = crearAplicacionGeneracionBackend(deps)
    const repetida = await adjuntar(t).expect(200)
    expect(repetida.body.flujo).toEqual(primera.body.flujo)
    expect(analizarImagen).toHaveBeenCalledTimes(1)
    expect((await request(app).get(`${ruta()}/turnos`).set("Authorization", `Bearer ${credential}`).expect(200)).body[0].estado).toBe("review")
    const mensajes = await repo.listarPorProyecto({ projectId, limite: 30 })
    expect(mensajes.items.filter((m) => m.tipoRemitente === "human")).toHaveLength(1)
    expect(JSON.stringify(mensajes)).not.toContain("modeloBase")
  })

  it("un mismo requestId con otro adjunto o revisión genera conflicto", async () => {
    const t = entrada("Analiza imagen"); await adjuntar(t).expect(200)
    await adjuntar(t, Buffer.concat([png, Buffer.from([2])])).expect(409)
    await adjuntar({ ...t, revisionEditor: 9 }).expect(409)
    expect(analizarImagen).toHaveBeenCalledTimes(1)
  })

  it("reservas concurrentes solo ejecutan Vision una vez", async () => {
    let liberar!: () => void
    analizarImagen.mockImplementationOnce(() => new Promise((resolve) => { liberar = () => resolve({ resultado: "candidato", candidato, mensaje: "OK", modelo: "simulado" }) }))
    const t = entrada("Analiza imagen")
    const primero = adjuntar(t).then((r) => r)
    await vi.waitFor(() => expect(analizarImagen).toHaveBeenCalledOnce())
    await adjuntar(t).expect(409)
    liberar(); expect((await primero).status).toBe(200)
    expect(analizarImagen).toHaveBeenCalledOnce()
  })

  it("confirmar/ack repetidos no duplican una fusión y no aceptan otro modelo como evidencia", async () => {
    const t = entrada("Analiza imagen"); await adjuntar(t).expect(200)
    const a = await confirmar(t.requestId).expect(200); const b = await confirmar(t.requestId).expect(200)
    expect(b.body.modeloResultado).toEqual(a.body.modeloResultado)
    const completar = (m: unknown) => request(app).post(`${ruta()}/turnos/${t.requestId}/completar`).set("Authorization", `Bearer ${credential}`).send({ resultado: "applied", modeloEjecucion: m })
    await completar(modelo).expect(400)
    await completar(a.body.modeloResultado).expect(200); await completar(a.body.modeloResultado).expect(200)
    expect((await confirmar(t.requestId).expect(200)).body.modeloResultado).toBeUndefined()
    expect((await repo.listarPorProyecto({ projectId, limite: 30 })).items.filter((m) => m.replyToMessageId && /aplicada por su solicitante/.test(m.contenido))).toHaveLength(1)
  })

  it("una colisión CU05 no reemplaza clases ni permite una aplicación silenciosa", async () => {
    analizarImagen.mockResolvedValueOnce({ resultado: "candidato", candidato: { ...candidato, clases: [{ refTemporal: "tmp", nombre: "Cliente", atributos: [] }] }, mensaje: "Candidato", modelo: "simulado" })
    const t = entrada("Agrega la imagen"); await adjuntar(t).expect(200)
    await confirmar(t.requestId).expect(422)
    expect((await repo.obtenerFlujo(projectId, t.requestId))?.modeloResultado).toBeUndefined()
  })
  it("la revisión de imagen advierte atributos omitidos usando la misma política CU05", async () => {
    analizarImagen.mockResolvedValueOnce({ resultado: "candidato", candidato: { ...candidato, clases: [{ refTemporal: "tmp", nombre: "Pedido", atributos: [{ refTemporal: "tmp_a", nombre: "detalle", tipoDato: null }] }] }, mensaje: "Candidato", modelo: "simulado" })
    const t = entrada("Agrega la imagen"); const r = await adjuntar(t).expect(200)
    expect(r.body.flujo.advertencias.join(" ")).toContain("Pedido.detalle: tipo no visible; este atributo no se importará")
    const salida = await confirmar(t.requestId).expect(200)
    expect(salida.body.modeloResultado.clases[1].atributos).toEqual([])
  })

  it("XMI usa CU06, conserva advertencias y solo reemplaza tras confirmación", async () => {
    const t = entrada("Importa este archivo XMI")
    const r = await adjuntar(t, Buffer.from("<XMI/>"), "modelo.xmi", "application/xml").expect(200)
    expect(importar).toHaveBeenCalledWith("<XMI/>")
    expect(r.body.flujo.resumen).toContain("REEMPLAZARÁ")
    expect(r.body.flujo.advertencias).toContain("Operación no soportada omitida.")
    expect(r.body.modeloResultado).toBeUndefined()
    expect((await confirmar(t.requestId).expect(200)).body.modeloResultado.clases.map((c: { nombre: string }) => c.nombre)).toEqual(["Importado"])
  })

  it.each([
    [Buffer.from("no xml"), "x.xmi", "application/xml", 400],
    [Buffer.from("<!DOCTYPE x [<!ENTITY a SYSTEM 'file:///x'>]><x/>"), "x.xml", "application/xml", 400],
    [Buffer.from("<x/>"), "x.xml", "image/png", 400],
    [Buffer.alloc(5 * 1024 * 1024 + 1, 60), "x.xmi", "application/xml", 413],
    [Buffer.from("fake"), "x.png", "image/png", 400],
  ].map(([datos, nombre, mime, estado]) => ({ datos: datos as Buffer, nombre: nombre as string, mime: mime as string, estado: estado as number })))("rechaza archivo inválido $nombre ($estado)", async ({ datos, nombre, mime, estado }) => {
    await adjuntar(entrada("Importa archivo"), datos, nombre, mime).expect(estado)
    expect(importar).not.toHaveBeenCalled(); expect(analizarImagen).not.toHaveBeenCalled(); expect(planificar).not.toHaveBeenCalled()
  })

  it("rechaza XML malformado del parser sin importar nada", async () => {
    importar.mockRejectedValueOnce(new ErrorInteroperabilidadXmi("XML inválido", "entrada"))
    await adjuntar(entrada("Importa XMI"), Buffer.from("<broken>"), "x.xmi", "application/xml").expect(400)
  })

  it("fallo Vision queda registrado, sin éxito y sin costo repetido al reintentar el mismo turno", async () => {
    analizarImagen.mockRejectedValueOnce(new ErrorProveedorVision("no_disponible", "simulado"))
    const t = entrada("Analiza imagen"); await adjuntar(t).expect(503)
    expect((await adjuntar(t).expect(200)).body.flujo.estado).toBe("failed")
    expect(analizarImagen).toHaveBeenCalledOnce()
    expect((await repo.obtenerFlujo(projectId, t.requestId))?.modeloResultado).toBeUndefined()
  })

  it("exportación durable descargable y reintento sin volver a ejecutar CU07", async () => {
    const t = entrada("Export my model to XMI")
    const primera = await request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).send(t).expect(200)
    app = crearAplicacionGeneracionBackend(deps)
    const descarga = await request(app).get(`${ruta()}/turnos/${t.requestId}/archivo`).set("Authorization", `Bearer ${credential}`).expect(200)
    expect(descarga.text).toBe("<XMI>archivo del servicio</XMI>")
    expect(descarga.headers["content-disposition"]).toContain("modelo.xmi")
    const repetida = await request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).send(t).expect(200)
    expect(repetida.body.flujo).toEqual(primera.body.flujo)
    expect(exportar).toHaveBeenCalledOnce()
  })

  it("Spring produce un ZIP real con CU08/09/10, sin llamar Groq ni cambiar el UML", async () => {
    const t = entrada("Genera el backend Spring Boot")
    const r = await request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).send(t).expect(200)
    expect(r.body.flujo).toMatchObject({ estado: "ready", archivo: { nombre: "backend-generado.zip" } })
    const zip = await request(app).get(`${ruta()}/turnos/${t.requestId}/archivo`).set("Authorization", `Bearer ${credential}`).buffer(true).parse((res, callback) => {
      const partes: Buffer[] = []; res.on("data", (p: Buffer) => partes.push(p)); res.on("end", () => callback(null, Buffer.concat(partes)))
    }).expect(200)
    const contenido = await JSZip.loadAsync(zip.body as Buffer)
    expect(contenido.file("backend-generado/pom.xml")).not.toBeNull()
    expect(Object.keys(contenido.files).some((f) => f.endsWith("Cliente.java"))).toBe(true)
    expect(responder).not.toHaveBeenCalled(); expect(interpretarCambiosUML).not.toHaveBeenCalled(); expect(analizarImagen).not.toHaveBeenCalled()
  })

  it("Spring no apto explica bloqueos y no publica ZIP", async () => {
    const t = { ...entrada("Genera Spring"), modeloEjecucion: { ...modelo, clases: [] } }
    await request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).send(t).expect(422)
    expect((await repo.obtenerFlujo(projectId, t.requestId))?.resumen).toContain("No se puede generar Spring")
    await request(app).get(`${ruta()}/turnos/${t.requestId}/archivo`).set("Authorization", `Bearer ${credential}`).expect(404)
  })

  it("sin credencial no procesa archivos ni invoca proveedores", async () => {
    await request(app).post(`${ruta()}/interactuar`).field("turno", JSON.stringify(entrada("Analiza imagen"))).attach("archivo", png, "x.png").expect(401)
    expect(analizarImagen).not.toHaveBeenCalled(); expect(planificar).not.toHaveBeenCalled()
  })
  it("el artefacto no puede cruzarse a otro proyecto y se recupera por página de historia", async () => {
    const t = entrada("Exporta XMI")
    await request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).send(t).expect(200)
    const otroProyecto = await request(app).post("/api/proyectos").send({ nombre: "Otro", nombreParticipante: "Ana" }).expect(201)
    await request(app).get(`/api/proyectos/${otroProyecto.body.proyecto.id}/asistente-colaborativo/turnos/${t.requestId}/archivo`).set("Authorization", `Bearer ${otroProyecto.body.credencial}`).expect(404)
    const recuperados = await request(app).get(`${ruta()}/turnos`).query({ requestIds: t.requestId }).set("Authorization", `Bearer ${credential}`).expect(200)
    expect(recuperados.body[0].requestId).toBe(t.requestId)
    expect(JSON.stringify(recuperados.body)).not.toContain("base64")
  })
  it.each(["1:1", "NM", "generalizacion"])("Spring no elude el perfil existente: %s", async (caso) => {
    const t = { ...entrada("Genera Spring"), modeloEjecucion: { ...modelo,
      clases: [...modelo.clases, { ...modelo.clases[0], id: "pedido", nombre: "Pedido", atributos: [] }],
      relaciones: [{ id: "r", tipo: caso === "generalizacion" ? "generalizacion" : "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido", multiplicidadOrigen: caso === "NM" ? "0..*" : "1", multiplicidadDestino: caso === "NM" ? "0..*" : "1" }] } }
    await request(app).post(`${ruta()}/interactuar`).set("Authorization", `Bearer ${credential}`).send(t).expect(422)
    expect((await repo.obtenerFlujo(projectId, t.requestId))?.archivo).toBeUndefined()
  })
})
