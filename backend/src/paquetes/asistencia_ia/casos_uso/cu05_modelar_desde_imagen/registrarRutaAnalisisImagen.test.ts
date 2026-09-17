import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ErrorProveedorVision, type ImagenParaAnalizar, type ProveedorVisionUML } from "../../compartido/proveedores/vision/ProveedorVisionUML.js"

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fixture")])
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
const respuestaValida = {
  resultado: "candidato" as const,
  mensaje: "Candidato detectado.",
  modelo: "determinista",
  candidato: { clases: [{ refTemporal: "tmp_factura", nombre: "Factura", atributos: [] }], relaciones: [], advertencias: [] },
}

function aplicacionCon(analizarImagen: ProveedorVisionUML["analizarImagen"]) {
  return crearAplicacionGeneracionBackend({ proveedorVision: { analizarImagen } })
}

function adjuntar(peticion: request.Test, contenido = png, contentType = "image/png") {
  return peticion.attach("imagen", contenido, { filename: "diagrama.png", contentType })
}

describe("API de análisis de imagen CU05", () => {
  it.each([["PNG", png, "image/png"], ["JPEG", jpeg, "image/jpeg"]])("acepta %s válido y devuelve candidato", async (_nombre, contenido, mime) => {
    const analizarImagen = vi.fn(async () => respuestaValida)
    const respuesta = await adjuntar(request(aplicacionCon(analizarImagen)).post("/api/ia/imagen/analizar"), contenido, mime).expect(200)
    expect(respuesta.body.resultado).toBe("candidato")
    expect(analizarImagen).toHaveBeenCalledOnce()
  })

  it("rechaza ausencia de imagen", async () => {
    await request(aplicacionCon(vi.fn())).post("/api/ia/imagen/analizar").expect(400)
  })

  it("rechaza MIME no soportado", async () => {
    const analizar = vi.fn()
    await adjuntar(request(aplicacionCon(analizar)).post("/api/ia/imagen/analizar"), Buffer.from("pdf"), "application/pdf").expect(400)
    expect(analizar).not.toHaveBeenCalled()
  })

  it("rechaza contenido vacío", async () => {
    await adjuntar(request(aplicacionCon(vi.fn())).post("/api/ia/imagen/analizar"), Buffer.alloc(0)).expect(400)
  })

  it("rechaza firma que no coincide con el MIME", async () => {
    const analizar = vi.fn()
    await adjuntar(request(aplicacionCon(analizar)).post("/api/ia/imagen/analizar"), Buffer.from("no-png")).expect(400)
    expect(analizar).not.toHaveBeenCalled()
  })

  it("rechaza más de 10 MB con 413", async () => {
    const analizar = vi.fn()
    await adjuntar(request(aplicacionCon(analizar)).post("/api/ia/imagen/analizar"), Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)])).expect(413)
    expect(analizar).not.toHaveBeenCalled()
  })

  it("entrega bytes, MIME y nombre al proveedor", async () => {
    const recibidas: ImagenParaAnalizar[] = []
    await adjuntar(request(aplicacionCon(async (imagen) => { recibidas.push(imagen); return respuestaValida })).post("/api/ia/imagen/analizar")).expect(200)
    expect(recibidas[0]).toMatchObject({ mimeType: "image/png", nombreArchivo: "diagrama.png" })
    expect(recibidas[0]?.datos.equals(png)).toBe(true)
  })

  it.each([
    ["clases vacías", { ...respuestaValida, candidato: { clases: [], relaciones: [], advertencias: [] } }],
    ["clases duplicadas", { ...respuestaValida, candidato: { clases: [{ refTemporal: "a", nombre: "Factura", atributos: [] }, { refTemporal: "b", nombre: "factura", atributos: [] }], relaciones: [], advertencias: [] } }],
    ["atributos duplicados", { ...respuestaValida, candidato: { clases: [{ refTemporal: "a", nombre: "Factura", atributos: [{ refTemporal: "x", nombre: "total", tipoDato: "Double" }, { refTemporal: "y", nombre: "TOTAL", tipoDato: "Double" }] }], relaciones: [], advertencias: [] } }],
    ["relación inválida", { ...respuestaValida, candidato: { clases: [{ refTemporal: "a", nombre: "Factura", atributos: [] }], relaciones: [{ refTemporal: "r", tipo: "generalizacion", origenRef: "a", destinoRef: "a", multiplicidadOrigen: "1", multiplicidadDestino: "1", rolOrigen: null, rolDestino: null }], advertencias: [] } }],
  ])("rechaza respuesta malformada: %s", async (_nombre, resultado) => {
    await adjuntar(request(aplicacionCon(async () => resultado as never)).post("/api/ia/imagen/analizar")).expect(503)
  })

  it.each([["limite", 429], ["no_disponible", 503]] as const)("mapea %s sin exponer detalles", async (tipo, estado) => {
    const respuesta = await adjuntar(request(aplicacionCon(async () => { throw new ErrorProveedorVision(tipo, "GROQ_API_KEY=secreto") })).post("/api/ia/imagen/analizar")).expect(estado)
    expect(JSON.stringify(respuesta.body)).not.toContain("secreto")
  })

  it("distingue un modelo de visión no disponible para la cuenta", async () => {
    const respuesta = await adjuntar(request(aplicacionCon(async () => {
      throw new ErrorProveedorVision("modelo_no_disponible", "detalle interno")
    })).post("/api/ia/imagen/analizar")).expect(503)
    expect(respuesta.body).toEqual({
      error: "El modelo de visión configurado no existe o no está disponible para esta cuenta.",
    })
  })
})
