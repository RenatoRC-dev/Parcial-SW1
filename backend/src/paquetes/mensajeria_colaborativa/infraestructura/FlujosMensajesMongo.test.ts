import { describe, expect, it, vi } from "vitest"
import type { Db } from "mongodb"
import { RepositorioMensajesMongo } from "./RepositorioMensajesMongo.js"
import type { FlujoAsistentePersistido } from "../../asistencia_contextual/compartido/FlujoAsistente.js"

const flujo: FlujoAsistentePersistido = { projectId: "p", participantId: "u", requestId: "r", sourceMessageId: "h", completionRequestId: "c", huella: "a".repeat(64), revision: 3,
  operacion: "exportar_xmi", estado: "ready", resumen: "Archivo generado", advertencias: [], modeloBase: { id: "m", nombre: "M", version: "1", clases: [], relaciones: [] }, archivo: { nombre: "modelo.xmi", mime: "application/xml", base64: "WE1J" } }
function crear(f = flujo) {
  const documento = { _id: "h", projectId: "p", participantId: "u", requestId: "r", tipoRemitente: "human", nombreVisibleSnapshot: "Ana", contenido: "Exporta XMI", replyToMessageId: null, elementosRelacionadosIds: [], revisionModeloObservada: 0, creadoEn: new Date(), flujoAsistente: f }
  const coleccion = { findOne: vi.fn(async () => documento), updateOne: vi.fn(async (..._args: unknown[]) => ({ modifiedCount: 1 })) }
  return { repo: new RepositorioMensajesMongo({ collection: () => coleccion } as unknown as Db), coleccion }
}
describe("persistencia privada de flujos Mongo", () => {
  it("los metadatos, modelos y binarios privados nunca aparecen en el mensaje público", async () => {
    const { repo } = crear()
    expect(await repo.obtenerFlujo("p", "r")).toEqual(flujo)
    const publico = await repo.obtenerPorId("p", "h")
    expect(publico).not.toHaveProperty("flujoAsistente")
    expect(JSON.stringify(publico)).not.toContain("base64")
  })
  it("reserva y compara estado/huella bajo identidad y mensaje de origen", async () => {
    const { repo, coleccion } = crear()
    expect(await repo.reservarFlujo(flujo)).toBe(true)
    expect(coleccion.updateOne.mock.calls[0][0]).toMatchObject({ _id: "h", projectId: "p", requestId: "r", participantId: "u", flujoAsistente: { $exists: false }, accionIA: { $exists: false } })
    expect(await repo.actualizarFlujo({ ...flujo, estado: "applied" }, "issued")).toBe(true)
    expect(coleccion.updateOne.mock.calls[1][0]).toMatchObject({ "flujoAsistente.estado": "issued", "flujoAsistente.huella": flujo.huella, participantId: "u" })
  })
  it("rechaza el flujo persistido cruzado con otro proyecto/participante", async () => {
    await expect(crear({ ...flujo, participantId: "otro" }).repo.obtenerFlujo("p", "r")).rejects.toThrow("No se pudo recuperar")
  })
})
