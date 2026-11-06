import { createServer } from "node:http"
import { adjuntarRelayColaboracion } from "./paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/ServidorRelayColaboracion.js"
import { crearAplicacionGeneracionBackend } from "./paquetes/generacion_backend/api/ServidorGeneracionBackend.js"
import type { ProveedorModeloLenguaje } from "./paquetes/asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import type { ProveedorTranscripcionAudio } from "./paquetes/asistencia_ia/compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"
import type { ProveedorVisionUML } from "./paquetes/asistencia_ia/compartido/proveedores/vision/ProveedorVisionUML.js"
import type { DependenciasRutasProyectos } from "./paquetes/gestion_proyectos/api/registrarRutasProyectos.js"
import type { ProveedorAsistenteContextual } from "./paquetes/asistencia_contextual/compartido/ProveedorAsistenteContextual.js"
import { ServidorCanalAplicacionProyecto } from "./paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/ServidorCanalAplicacionProyecto.js"

export function crearServidorCase(dependencias: {
  accesoProyectos: DependenciasRutasProyectos
  proveedorIA?: ProveedorModeloLenguaje
  proveedorTranscripcion?: ProveedorTranscripcionAudio
  proveedorVision?: ProveedorVisionUML
  proveedorAsistenteContextual?: ProveedorAsistenteContextual
}) {
  const canalAplicacion = new ServidorCanalAplicacionProyecto(dependencias.accesoProyectos)
  const servidor = createServer(crearAplicacionGeneracionBackend({ ...dependencias, publicadorMensajes: canalAplicacion }))
  const relayColaboracion = adjuntarRelayColaboracion(servidor, dependencias.accesoProyectos)
  canalAplicacion.adjuntar(servidor)
  return { servidor, relayColaboracion, canalAplicacion }
}
