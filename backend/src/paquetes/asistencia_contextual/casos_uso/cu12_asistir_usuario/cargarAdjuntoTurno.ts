import multer from "multer"
import type { RequestHandler } from "express"
import { firmaValida } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/registrarRutaAnalisisImagen.js"
import { ErrorFlujoAsistente, type AdjuntoTurno } from "./EjecutarFlujosAsistente.js"

const cargar = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 1024 * 1024, parts: 3 } }).single("archivo")
export const cargarAdjuntoTurno: RequestHandler = (req, res, next) => {
  if (!req.is("multipart/form-data")) { next(); return }
  cargar(req, res, (error) => {
    if (error) { res.status(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Se admite un turno con un único archivo (imagen hasta 10 MB; XMI hasta 5 MB)." }); return }
    if (!req.file) { res.status(400).json({ error: "Se requiere el archivo adjunto del turno." }); return }
    next()
  })
}
export function leerAdjuntoTurno(file: Express.Multer.File): AdjuntoTurno {
  const nombre = file.originalname.replace(/\\/g, "/").split("/").at(-1)!.slice(0, 180)
  const mime = file.mimetype.toLowerCase().split(";")[0]
  if (!file.buffer.length) throw new ErrorFlujoAsistente(400, "El archivo está vacío.")
  if (mime === "image/png" || mime === "image/jpeg") {
    if (!firmaValida(file.buffer, mime) || !(mime === "image/png" ? /\.png$/i : /\.jpe?g$/i).test(nombre)) throw new ErrorFlujoAsistente(400, "La firma, extensión o formato de la imagen no es válido.")
    return { tipo: "imagen", nombre, mime, datos: file.buffer }
  }
  if (!/\.(xmi|xml)$/i.test(nombre) || !["application/xml", "text/xml", "application/octet-stream", "application/xmi+xml", ""].includes(mime)) throw new ErrorFlujoAsistente(400, "Solo se admiten imágenes PNG/JPEG y archivos XMI/XML.")
  if (file.buffer.length > 5 * 1024 * 1024) throw new ErrorFlujoAsistente(413, "El archivo XMI supera 5 MB.")
  let texto: string
  try { texto = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer) } catch { throw new ErrorFlujoAsistente(400, "El XMI debe utilizar UTF-8 válido.") }
  if (!/^\s*</.test(texto) || /<!DOCTYPE|<!ENTITY/i.test(texto)) throw new ErrorFlujoAsistente(400, "El contenido XML/XMI no es válido o contiene entidades no admitidas.")
  return { tipo: "xmi", nombre, mime: "application/xml", datos: file.buffer }
}
