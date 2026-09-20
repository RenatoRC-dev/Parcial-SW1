import type { Express, NextFunction, Request, Response } from "express"
import multer from "multer"
import { ErrorProveedorVision, type ImagenParaAnalizar, type ProveedorVisionUML } from "../../compartido/proveedores/vision/ProveedorVisionUML.js"
import { analizarImagenUML } from "./analizarImagenUML.js"

export const LIMITE_IMAGEN_BYTES = 10 * 1024 * 1024
const TIPOS_IMAGEN = new Set(["image/png", "image/jpeg"])
const cargarImagen = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITE_IMAGEN_BYTES, files: 1 } }).single("imagen")

function tipoBase(mimeType: string): string {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

function firmaValida(datos: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return datos.length >= 8 && datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  return mimeType === "image/jpeg" && datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff
}

export function registrarRutaAnalisisImagen(aplicacion: Express, proveedor: ProveedorVisionUML): void {
  aplicacion.post("/api/ia/imagen/analizar", (solicitud: Request, respuesta: Response, _siguiente: NextFunction) => {
    cargarImagen(solicitud, respuesta, async (error) => {
      if (error instanceof multer.MulterError) {
        respuesta.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
          error: error.code === "LIMIT_FILE_SIZE"
            ? "La imagen supera el límite permitido de 10 MB."
            : "Se admite una sola imagen por análisis.",
        })
        return
      }
      if (error) {
        respuesta.status(400).json({ error: "No se pudo procesar la imagen enviada." })
        return
      }
      const archivo = solicitud.file
      if (!archivo || archivo.buffer.length === 0) {
        respuesta.status(400).json({ error: "Se requiere un archivo de imagen." })
        return
      }
      const mimeType = tipoBase(archivo.mimetype)
      if (!TIPOS_IMAGEN.has(mimeType) || !firmaValida(archivo.buffer, mimeType)) {
        respuesta.status(400).json({ error: "El formato de imagen no está soportado o su contenido no es válido." })
        return
      }
      try {
        respuesta.status(200).json(await analizarImagenUML({
          datos: archivo.buffer,
          mimeType: mimeType as ImagenParaAnalizar["mimeType"],
          nombreArchivo: archivo.originalname || "diagrama",
        }, proveedor))
      } catch (errorProveedor) {
        if (errorProveedor instanceof ErrorProveedorVision) {
          const estado = errorProveedor.tipo === "limite" ? 429 : errorProveedor.tipo === "respuesta_incompleta" ? 422 : 503
          if (errorProveedor.diagnostico) {
            console.warn("[CU05 Vision] Respuesta rechazada", { tipo: errorProveedor.tipo, ...errorProveedor.diagnostico })
          }
          respuesta.status(estado).json({
            error: errorProveedor.tipo === "modelo_no_disponible"
              ? "El modelo de visión configurado no existe o no está disponible para esta cuenta."
              : errorProveedor.tipo === "respuesta_incompleta"
              ? "El análisis produjo más información de la que puede procesarse en una sola imagen. Prueba con una sección más pequeña."
              : estado === 429
              ? "El servicio de análisis de imagen alcanzó temporalmente su límite de uso."
              : "El servicio de análisis de imagen no está disponible temporalmente.",
          })
          return
        }
        console.error(errorProveedor)
        respuesta.status(500).json({ error: "No se pudo analizar la imagen." })
      }
    })
  })
}
