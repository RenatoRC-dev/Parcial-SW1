import { crearServidorCase } from "../../../ServidorCase.js"
import { ProveedorDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorDeterministaE2E.js"
import { ProveedorTranscripcionDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorTranscripcionDeterministaE2E.js"
import { ProveedorVisionDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorVisionDeterministaE2E.js"
import { resolve } from "node:path"
import { cargarConfiguracionEntorno } from "../../../configuracion/cargarConfiguracionEntorno.js"

cargarConfiguracionEntorno()

if (process.argv.includes("--datos-proyectos-e2e")) {
  process.env.SW1_PROJECTS_DIR = resolve(process.cwd(), "generated-test-output", "e2e-projects")
}

const puerto = Number(process.env.PORT || 3001)
const host = process.env.HOST?.trim() || "127.0.0.1"
const proveedorIA = process.argv.includes("--proveedor-ia-determinista") ? new ProveedorDeterministaE2E() : undefined
const proveedorTranscripcion = process.argv.includes("--proveedor-ia-determinista")
  ? new ProveedorTranscripcionDeterministaE2E()
  : undefined
const proveedorVision = process.argv.includes("--proveedor-ia-determinista")
  ? new ProveedorVisionDeterministaE2E()
  : undefined
const { servidor } = crearServidorCase({ proveedorIA, proveedorTranscripcion, proveedorVision })
servidor.listen(puerto, host, () => {
  console.log(`Servidor CASE disponible en http://${host}:${puerto}`)
})
