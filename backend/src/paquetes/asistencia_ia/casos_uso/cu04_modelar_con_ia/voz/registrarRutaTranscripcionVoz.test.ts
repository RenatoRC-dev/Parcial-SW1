import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../../generacion_backend/api/ServidorGeneracionBackend.js"
import {
  ErrorProveedorTranscripcion,
  type AudioParaTranscribir,
  type ProveedorTranscripcionAudio,
} from "../../../compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"

function aplicacionCon(transcribir: ProveedorTranscripcionAudio["transcribir"]) {
  return crearAplicacionGeneracionBackend({ proveedorTranscripcion: { transcribir } })
}

function audioValido(peticion: request.Test) {
  return peticion.attach("audio", Buffer.from("audio-webm-prueba"), { filename: "instruccion.webm", contentType: "audio/webm" })
}

describe("API de transcripción de voz CU04", () => {
  it("devuelve una transcripción válida y recortada", async () => {
    const transcribir = vi.fn(async () => ({ transcripcion: "  Crea una clase Factura  ", modelo: "fake" }))
    const respuesta = await audioValido(request(aplicacionCon(transcribir)).post("/api/ia/voz/transcribir")).expect(200)
    expect(respuesta.body).toEqual({ transcripcion: "Crea una clase Factura", modelo: "fake" })
  })

  it("devuelve de forma controlada una transcripción sin habla", async () => {
    const respuesta = await audioValido(request(aplicacionCon(async () => ({ transcripcion: "   ", modelo: "fake" }))).post("/api/ia/voz/transcribir")).expect(200)
    expect(respuesta.body.transcripcion).toBe("")
  })

  it("rechaza la ausencia de audio", async () => {
    await request(aplicacionCon(vi.fn())).post("/api/ia/voz/transcribir").expect(400)
  })

  it("rechaza MIME no soportado sin llamar al proveedor", async () => {
    const transcribir = vi.fn()
    await request(aplicacionCon(transcribir)).post("/api/ia/voz/transcribir")
      .attach("audio", Buffer.from("texto"), { filename: "archivo.txt", contentType: "text/plain" })
      .expect(400)
    expect(transcribir).not.toHaveBeenCalled()
  })

  it("rechaza audio mayor a 10 MB con 413", async () => {
    const transcribir = vi.fn()
    await request(aplicacionCon(transcribir)).post("/api/ia/voz/transcribir")
      .attach("audio", Buffer.alloc(10 * 1024 * 1024 + 1, 1), { filename: "grande.webm", contentType: "audio/webm" })
      .expect(413)
    expect(transcribir).not.toHaveBeenCalled()
  })

  it("mapea límite del proveedor con 429 sin filtrar detalles", async () => {
    const respuesta = await audioValido(request(aplicacionCon(async () => {
      throw new ErrorProveedorTranscripcion("limite", "secreto proveedor")
    })).post("/api/ia/voz/transcribir")).expect(429)
    expect(respuesta.body).toEqual({ error: "El servicio de voz alcanzó temporalmente su límite de uso." })
    expect(JSON.stringify(respuesta.body)).not.toContain("secreto proveedor")
  })

  it("mapea indisponibilidad del proveedor con 503", async () => {
    const respuesta = await audioValido(request(aplicacionCon(async () => {
      throw new ErrorProveedorTranscripcion("no_disponible", "detalle interno")
    })).post("/api/ia/voz/transcribir")).expect(503)
    expect(respuesta.body).toEqual({ error: "El servicio de transcripción no está disponible temporalmente." })
  })

  it("entrega bytes, MIME y nombre al proveedor", async () => {
    const recibidos: AudioParaTranscribir[] = []
    await audioValido(request(aplicacionCon(async (audio) => {
      recibidos.push(audio)
      return { transcripcion: "Factura", modelo: "fake" }
    })).post("/api/ia/voz/transcribir")).expect(200)
    expect(recibidos).toHaveLength(1)
    expect(recibidos[0]).toMatchObject({ mimeType: "audio/webm", nombreArchivo: "instruccion.webm" })
    expect(recibidos[0]?.datos.equals(Buffer.from("audio-webm-prueba"))).toBe(true)
  })

  it("no expone secretos incluidos en errores inesperados del proveedor", async () => {
    const respuesta = await audioValido(request(aplicacionCon(async () => {
      throw new ErrorProveedorTranscripcion("respuesta_invalida", "GROQ_API_KEY=valor-privado")
    })).post("/api/ia/voz/transcribir")).expect(503)
    expect(JSON.stringify(respuesta.body)).not.toContain("valor-privado")
  })
})
