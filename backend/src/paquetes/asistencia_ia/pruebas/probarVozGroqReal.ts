import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { ProveedorTranscripcionGroq } from "../compartido/proveedores/transcripcion/groq/ProveedorTranscripcionGroq.js"

const ruta = process.env.SW1_VOICE_FIXTURE
if (!process.env.GROQ_API_KEY || !ruta) {
  console.error("Prerequisitos ausentes: configure GROQ_API_KEY y SW1_VOICE_FIXTURE para ejecutar la aceptación real de voz.")
  process.exit(2)
}

const tipos: Record<string, string> = {
  ".flac": "audio/flac", ".mp3": "audio/mpeg", ".mp4": "audio/mp4", ".mpeg": "audio/mpeg",
  ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm",
}
const extension = extname(ruta).toLowerCase()
const mimeType = tipos[extension]
if (!mimeType) {
  console.error("SW1_VOICE_FIXTURE debe usar un formato de audio soportado por Groq.")
  process.exit(2)
}

const proveedor = new ProveedorTranscripcionGroq()
const resultado = await proveedor.transcribir({ datos: await readFile(ruta), mimeType, nombreArchivo: `comando${extension}` })
const normalizada = resultado.transcripcion.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
const condicionSemantica = normalizada.includes("clase") && normalizada.includes("factura")
console.log(JSON.stringify({
  realGroqVoiceUsed: true,
  model: resultado.modelo,
  transcriptionReceived: resultado.transcripcion.length > 0,
  semanticCondition: condicionSemantica,
}, null, 2))
if (!condicionSemantica) process.exitCode = 1
