import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import request from "supertest"
import { expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioProyectosArchivos } from "../../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import { ejecutarComandosUML } from "./EjecutorComandosUML.js"
import { fixtureTiposOpcionales } from "../../../interoperabilidad/pruebas_runtime/fixtureTiposOpcionales.js"

it("el asistente autoriza automáticamente CU04 sin tipo solo al solicitante, conserva idempotencia y no guarda", async () => {
  const dir = await mkdtemp(join(tmpdir(), "optional-http-"))
  try {
    const proyectos = new RepositorioProyectosArchivos(dir)
    const interpretar = vi.fn(async () => ({ resultado: "aplicar" as const, mensaje: "Atributo sin tipo", comandos: [{ tipo: "agregar_atributo" as const, claseRef: "EAID_CLIENTE", refTemporal: "tmp_apodo", nombre: "apodo", tipoDato: null, visibilidad: null }] }))
    const app = crearAplicacionGeneracionBackend({ accesoProyectos: { proyectos, participantes: new RepositorioParticipantesMemoria(), protector: new ProtegerAccesoProyecto("optional-test"), mensajes: new RepositorioMensajesMemoria(), eventos: new RepositorioEventosMemoria() }, proveedorIA: { interpretarCambiosUML: interpretar }, proveedorAsistenteContextual: { responder: async () => { throw new Error("No advisory provider required for an authorized change") } } })
    const created = await request(app).post("/api/proyectos").send({ nombre: "Tipos opcionales", nombreParticipante: "Ana" }).expect(201)
    const id = created.body.proyecto.id, cred = created.body.credencial
    const other = await request(app).post("/api/proyectos/unirse").send({ codigoAcceso: created.body.codigoAcceso, nombreParticipante: "Luis" }).expect(200)
    const body = { requestId: crypto.randomUUID(), contenido: "Agrega apodo a Cliente sin definir su tipo.", modeloEjecucion: fixtureTiposOpcionales, revisionEditor: 6 }
    const enviar = () => request(app).post(`/api/proyectos/${id}/asistente-colaborativo/interactuar`).set("Authorization", `Bearer ${cred}`).send(body)
    const action = await enviar().expect(200)
    expect(action.body).toMatchObject({ kind: "action", baseEditorRevision: 6, plan: { comandos: [{ tipoDato: null }] } })
    expect((await enviar().expect(200)).body.actionId).toBe(action.body.actionId)
    expect(interpretar).toHaveBeenCalledOnce()
    const local = ejecutarComandosUML(fixtureTiposOpcionales, action.body.plan.comandos, () => "apodo-estable")
    expect(local.clases[0].atributos.at(-1)).toMatchObject({ id: "apodo-estable", nombre: "apodo", tipo: null })
    const completar = `/api/proyectos/${id}/modelado-ia/acciones/${action.body.actionId}/completar`
    await request(app).post(completar).set("Authorization", `Bearer ${other.body.credencial}`).send({ resultado: "applied", cambios: [] }).expect(403)
    await request(app).post(completar).set("Authorization", `Bearer ${cred}`).send({ resultado: "applied", cambios: [{ commandIndex: 0, tipo: "UML_ELEMENT_CREATED", elemento: { id: "apodo-estable", tipo: "attribute", nombreSnapshot: "apodo" } }] }).expect(200)
    expect((await proyectos.obtenerPorId(id))?.revisionModelo).toBe(0)
    expect((await proyectos.obtenerPorId(id))?.modelo.clases).toEqual([])
    const spring = await request(app).post("/api/generacion/spring").send(local).expect(400)
    expect(spring.headers["content-type"]).toContain("application/json")
    expect(spring.body.errores.join(" ")).toContain("Cliente.apodo: (ausente)")
  } finally { await rm(dir, { recursive: true, force: true }) }
})
