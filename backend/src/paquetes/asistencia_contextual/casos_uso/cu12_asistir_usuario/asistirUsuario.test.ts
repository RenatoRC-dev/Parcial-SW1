import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import type { SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { asistirUsuario } from "./asistirUsuario.js"

const solicitud: SolicitudAsistenteContextual = {
  pregunta: "¿Por qué no puedo generar?",
  contexto: {
    proyecto: { id: "proyecto-1", nombre: "Accesos" },
    area: "modelado_uml",
    elementoSeleccionado: null,
    elementosRelevantes: [{ id: "rel-nm", tipo: "relacion", nombre: "Usuario — Rol" }],
    resumenModelo: { clases: 2, relaciones: 1 },
    estadoUml: { estado: "valido", problemas: [] },
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
  it("entrega al proveedor el bloqueo real en un contexto compacto", async () => {
    const responder = vi.fn(async () => ({
      respuesta: "El modelo UML es válido, pero el N:M directo debe convertirse en clase asociativa.",
      accionSugerida: "IR_A_GENERACION" as const,
      elementoRelacionadoId: null,
      nivel: "advertencia" as const,
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
    const proveedor = { responder: vi.fn(async () => ({ respuesta: "Hecho", accionSugerida: "BORRAR_MODELO", elementoRelacionadoId: null, nivel: "informacion" })) } as unknown as ProveedorAsistenteContextual
    await expect(asistirUsuario(solicitud, proveedor)).rejects.toMatchObject({ tipo: "respuesta_invalida" })
  })

  it("degrada una indisponibilidad sin afectar el resto de la aplicación", async () => {
    const proveedor: ProveedorAsistenteContextual = { responder: async () => { throw new ErrorAsistenteContextual("no_disponible", "sin servicio") } }
    const aplicacion = crearAplicacionGeneracionBackend({ proveedorAsistenteContextual: proveedor })
    const respuesta = await request(aplicacion).post("/api/ia/contextual/preguntar").send(solicitud).expect(503)
    expect(respuesta.body.error).toContain("orientación del sistema continúa disponible")
    await request(aplicacion).get("/api/health").expect(200)
  })
})
