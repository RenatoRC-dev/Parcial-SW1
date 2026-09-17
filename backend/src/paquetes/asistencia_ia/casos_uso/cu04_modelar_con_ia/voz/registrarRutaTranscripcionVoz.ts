import type { Express, NextFunction, Request, Response } from "express"
import multer from "multer"
import {
  ErrorProveedorTranscripcion,
  type ProveedorTranscripcionAudio,
} from "../../../compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"
import { transcribirInstruccionVoz } from "./transcribirInstruccionVoz.js"

const LIMITE_AUDIO_BYTES = 10 * 1024 * 1024
const TIPOS_AUDIO_SOPORTADOS = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4"])
const cargarAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITE_AUDIO_BYTES, files: 1 } }).single("audio")

function tipoBase(mimeType: string): string {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

export function registrarRutaTranscripcionVoz(aplicacion: Express, proveedor: ProveedorTranscripcionAudio): void {
  aplicacion.post("/api/ia/voz/transcribir", (solicitud: Request, respuesta: Response, _siguiente: NextFunction) => {
    cargarAudio(solicitud, respuesta, async (error) => {
      if (error instanceof multer.MulterError) {
        const estado = error.code === "LIMIT_FILE_SIZE" ? 413 : 400
        const mensaje = estado === 413
          ? "El audio supera el límite permitido de 10 MB."
          : "No se pudo procesar el audio enviado."
        respuesta.status(estado).json({ error: mensaje })
        return
      }
      if (error) {
        respuesta.status(400).json({ error: "No se pudo procesar el audio enviado." })
        return
      }
      const archivo = solicitud.file
      if (!archivo || archivo.buffer.length === 0) {
        respuesta.status(400).json({ error: "Se requiere un archivo de audio." })
        return
      }
      const mimeType = tipoBase(archivo.mimetype)
      if (!TIPOS_AUDIO_SOPORTADOS.has(mimeType)) {
        respuesta.status(400).json({ error: "El formato de audio no está soportado." })
        return
      }
      try {
        respuesta.status(200).json(await transcribirInstruccionVoz({
          datos: archivo.buffer,
          mimeType,
          nombreArchivo: archivo.originalname || "instruccion.webm",
        }, proveedor))
      } catch (errorProveedor) {
        if (errorProveedor instanceof ErrorProveedorTranscripcion) {
          const estado = errorProveedor.tipo === "limite" ? 429 : 503
          const mensaje = errorProveedor.tipo === "limite"
            ? "El servicio de voz alcanzó temporalmente su límite de uso."
            : "El servicio de transcripción no está disponible temporalmente."
          respuesta.status(estado).json({ error: mensaje })
          return
        }
        console.error(errorProveedor)
        respuesta.status(500).json({ error: "No se pudo transcribir el audio." })
      }
    })
  })
}
