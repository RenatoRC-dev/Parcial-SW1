import { loadEnvFile } from "node:process"
import { resolve } from "node:path"

const VARIABLES_OPCIONALES = [
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GROQ_TRANSCRIPTION_MODEL",
  "GROQ_TRANSCRIPTION_LANGUAGE",
  "GROQ_VISION_MODEL",
  "FRONTEND_ORIGIN",
  "HOST",
  "SW1_PROJECTS_DIR",
  "SW1_CRUNCH_UML_PATH",
  "SW1_PYTHON_PATH",
  "translators_default_region",
] as const

export function cargarConfiguracionEntorno(ruta = resolve(process.cwd(), ".env")): void {
  try {
    loadEnvFile(ruta)
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error
  }

  for (const nombre of VARIABLES_OPCIONALES) {
    if (process.env[nombre]?.trim() === "") delete process.env[nombre]
  }

  const puerto = process.env.PORT?.trim()
  if (!puerto) {
    delete process.env.PORT
    return
  }
  if (!/^\d+$/.test(puerto) || Number(puerto) < 1 || Number(puerto) > 65_535) {
    throw new Error("Configuración inválida: PORT debe ser un entero entre 1 y 65535.")
  }
  process.env.PORT = puerto
}
