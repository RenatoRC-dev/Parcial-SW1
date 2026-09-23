import type { RespuestaAnalisisImagen } from "./CandidatoModeloUMLImagen"
import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"

function esRespuesta(valor: unknown): valor is RespuestaAnalisisImagen {
  if (typeof valor !== "object" || valor === null) return false
  const registro = valor as Record<string, unknown>
  if (typeof registro.mensaje !== "string" || typeof registro.modelo !== "string") return false
  if (registro.resultado === "sin_modelo") return registro.candidato === null
  if (registro.resultado !== "candidato" || typeof registro.candidato !== "object" || registro.candidato === null) return false
  const candidato = registro.candidato as Record<string, unknown>
  return Array.isArray(candidato.clases) && Array.isArray(candidato.relaciones) && Array.isArray(candidato.advertencias)
}

export async function analizarImagenUML(imagen: File): Promise<RespuestaAnalisisImagen> {
  const datos = new FormData()
  datos.append("imagen", imagen)
  const respuesta = await fetch(construirUrlBackend("/api/ia/imagen/analizar"), { method: "POST", body: datos })
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error
      : "No se pudo analizar la imagen."
    throw new Error(mensaje)
  }
  if (!esRespuesta(cuerpo)) throw new Error("El servidor devolvió un candidato de imagen inválido.")
  return cuerpo
}
