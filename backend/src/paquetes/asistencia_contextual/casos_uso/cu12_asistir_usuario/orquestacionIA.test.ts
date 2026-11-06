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

  it("aclara una referencia contextual ambigua sin invocar CU04", async () => {
    const creado = await crear(); interpretar.mockClear()
    const respuesta = await interactuar(creado.body.proyecto.id, creado.body.credencial, "Bórralo.").expect(200)
    expect(respuesta.body.kind).toBe("clarification"); expect(respuesta.body.mensajeIA.contenido).toContain("inequivoca")
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
