import Groq, { toFile } from "groq-sdk"
import {
  ErrorProveedorTranscripcion,
  type AudioParaTranscribir,
  type ProveedorTranscripcionAudio,
  type ResultadoTranscripcion,
} from "../ProveedorTranscripcionAudio.js"

const MODELO_PREDETERMINADO = "whisper-large-v3-turbo"
const IDIOMA_PREDETERMINADO = "es"
const TIMEOUT_MS = 25_000
const CONTEXTO_UML = "Comandos UML en español. Términos frecuentes: clase, atributo, asociación, multiplicidad, String, Integer, Long, LocalDate, Cliente, Pedido."

export class ProveedorTranscripcionGroq implements ProveedorTranscripcionAudio {
  readonly modelo: string
  readonly idioma: string
  private readonly cliente: Groq | null

  constructor(
    apiKey = process.env.GROQ_API_KEY,
    modelo = process.env.GROQ_TRANSCRIPTION_MODEL ?? MODELO_PREDETERMINADO,
    idioma = process.env.GROQ_TRANSCRIPTION_LANGUAGE ?? IDIOMA_PREDETERMINADO,
  ) {
    this.modelo = modelo
    this.idioma = idioma
    this.cliente = apiKey ? new Groq({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 }) : null
  }

  async transcribir(audio: AudioParaTranscribir): Promise<ResultadoTranscripcion> {
    if (!this.cliente) {
      throw new ErrorProveedorTranscripcion("no_disponible", "GROQ_API_KEY no está configurada en el backend.")
    }
    try {
      const archivo = await toFile(audio.datos, audio.nombreArchivo, { type: audio.mimeType })
      const resultado = await this.cliente.audio.transcriptions.create({
        file: archivo,
        model: this.modelo,
        language: this.idioma,
        prompt: CONTEXTO_UML,
        response_format: "json",
        temperature: 0,
      })
      if (typeof resultado.text !== "string") {
        throw new ErrorProveedorTranscripcion("respuesta_invalida", "Groq no devolvió una transcripción válida.")
      }
      return { transcripcion: resultado.text.trim(), modelo: this.modelo }
    } catch (error) {
      if (error instanceof ErrorProveedorTranscripcion) throw error
      const estado = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0
      if (estado === 429) {
        throw new ErrorProveedorTranscripcion("limite", "El servicio de voz alcanzó temporalmente su límite de uso.")
      }
      throw new ErrorProveedorTranscripcion("no_disponible", "El servicio de transcripción no está disponible temporalmente.")
    }
  }
}
