import { createServer } from "node:http"
import { adjuntarRelayColaboracion } from "./paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/ServidorRelayColaboracion.js"
import { crearAplicacionGeneracionBackend } from "./paquetes/generacion_backend/api/ServidorGeneracionBackend.js"
import type { ProveedorModeloLenguaje } from "./paquetes/asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"

export function crearServidorCase(dependencias: { proveedorIA?: ProveedorModeloLenguaje } = {}) {
  const servidor = createServer(crearAplicacionGeneracionBackend(dependencias))
  const relayColaboracion = adjuntarRelayColaboracion(servidor)
  return { servidor, relayColaboracion }
}
