import { createServer } from "node:http"
import { adjuntarRelayColaboracion } from "./paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/ServidorRelayColaboracion.js"
import { crearAplicacionGeneracionBackend } from "./paquetes/generacion_backend/api/ServidorGeneracionBackend.js"

export function crearServidorCase() {
  const servidor = createServer(crearAplicacionGeneracionBackend())
  const relayColaboracion = adjuntarRelayColaboracion(servidor)
  return { servidor, relayColaboracion }
}
