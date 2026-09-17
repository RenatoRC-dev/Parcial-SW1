import { createServer } from "node:http"
import { adjuntarRelayColaboracion } from "./paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/ServidorRelayColaboracion.js"
import { crearAplicacionGeneracionBackend } from "./paquetes/generacion_backend/api/ServidorGeneracionBackend.js"
import type { ProveedorModeloLenguaje } from "./paquetes/asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import type { ProveedorTranscripcionAudio } from "./paquetes/asistencia_ia/compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"
import type { ProveedorVisionUML } from "./paquetes/asistencia_ia/compartido/proveedores/vision/ProveedorVisionUML.js"

export function crearServidorCase(dependencias: {
  proveedorIA?: ProveedorModeloLenguaje
  proveedorTranscripcion?: ProveedorTranscripcionAudio
  proveedorVision?: ProveedorVisionUML
} = {}) {
  const servidor = createServer(crearAplicacionGeneracionBackend(dependencias))
  const relayColaboracion = adjuntarRelayColaboracion(servidor)
  return { servidor, relayColaboracion }
}
