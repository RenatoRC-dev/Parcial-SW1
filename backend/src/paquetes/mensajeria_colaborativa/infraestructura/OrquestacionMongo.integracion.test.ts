import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { MongoClient } from "mongodb"
import { crearIndicesMongo } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import { RepositorioMensajesMongo } from "./RepositorioMensajesMongo.js"
import type { AccionIAModeladoPersistida } from "../compartido/RepositorioMensajes.js"

const uri = process.env.MONGODB_TEST_URI?.trim()
const describir = uri ? describe : describe.skip

describir("idempotencia de orquestacion sobre Mongo real", () => {
  let cliente: MongoClient
  const nombreBase = `nexocase_orquestacion_${randomUUID().replaceAll("-", "")}`
  let repositorio: RepositorioMensajesMongo
  beforeAll(async () => { cliente = new MongoClient(uri!, { serverSelectionTimeoutMS: 5_000 }); await cliente.connect(); const db = cliente.db(nombreBase); await crearIndicesMongo(db); repositorio = new RepositorioMensajesMongo(db) })
  afterAll(async () => { await cliente.db(nombreBase).dropDatabase(); await cliente.close() })

  it("reserva una accion por mensaje y solo permite una transicion aplicada", async () => {
    const projectId = randomUUID(); const participantId = randomUUID(); const sourceMessageId = randomUUID(); const actionId = randomUUID()
    await repositorio.crear({ id: sourceMessageId, projectId, tipoRemitente: "human", participantId, nombreVisibleSnapshot: "Renato",
      contenido: "Agrega total", requestId: randomUUID(), replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: new Date().toISOString() })
    const accion: AccionIAModeladoPersistida = {
      actionId, projectId, requestId: randomUUID(), sourceMessageId, requestingParticipantId: participantId, origen: "collaborative",
      normalizedInstruction: "Agrega atributo total Double a Venta", baseEditorRevision: 3,
      modeloBase: { id: "m", nombre: "M", version: "1", clases: [], relaciones: [] },
      plan: { resultado: "aplicar", mensaje: "Listo", comandos: [], revision: 3 }, estado: "planned", creadoEn: new Date().toISOString(), completadoEn: null,
    }
    const [a, b] = await Promise.all([repositorio.reservarAccionIA(accion), repositorio.reservarAccionIA({ ...accion, actionId: randomUUID() })])
    expect(a.actionId).toBe(b.actionId)
    const cierres = await Promise.all([
      repositorio.completarAccionIA(projectId, actionId, participantId, "applied", new Date().toISOString()),
      repositorio.completarAccionIA(projectId, actionId, participantId, "applied", new Date().toISOString()),
    ])
    expect(cierres.filter((cierre) => cierre.transicion)).toHaveLength(1)
    expect((await repositorio.obtenerAccionIAPorId(projectId, actionId))?.estado).toBe("applied")
    expect(await repositorio.obtenerAccionIAPorId(randomUUID(), actionId)).toBeNull()
  })
})
