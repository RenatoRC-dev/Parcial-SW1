import { crearServidorCase } from "../../../ServidorCase.js"
import { ProveedorDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorDeterministaE2E.js"

const puerto = Number(process.env.PORT ?? 3001)
const proveedorIA = process.argv.includes("--proveedor-ia-determinista") ? new ProveedorDeterministaE2E() : undefined
const { servidor } = crearServidorCase({ proveedorIA })
servidor.listen(puerto, "127.0.0.1", () => {
  console.log(`Servidor CASE disponible en http://127.0.0.1:${puerto}`)
})
