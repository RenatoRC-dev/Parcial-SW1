export interface ResultadoTranscripcionVoz {
  transcripcion: string
  modelo?: string
}

export async function transcribirAudio(audio: Blob): Promise<ResultadoTranscripcionVoz> {
  const formulario = new FormData()
  const extension = audio.type.includes("ogg") ? "ogg" : "webm"
  formulario.append("audio", audio, `instruccion.${extension}`)
  const respuesta = await fetch(construirUrlBackend("/api/ia/voz/transcribir"), { method: "POST", body: formulario })
  const cuerpo: unknown = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error
      : "No se pudo transcribir el audio."
    throw new Error(mensaje)
  }
  if (typeof cuerpo !== "object" || cuerpo === null || !("transcripcion" in cuerpo) || typeof cuerpo.transcripcion !== "string") {
    throw new Error("La respuesta de transcripción es inválida.")
  }
  const modelo = "modelo" in cuerpo && typeof cuerpo.modelo === "string" ? cuerpo.modelo : undefined
  return { transcripcion: cuerpo.transcripcion.trim(), ...(modelo ? { modelo } : {}) }
}
import { construirUrlBackend } from "../../../../../configuracion/BackendRemoto"
