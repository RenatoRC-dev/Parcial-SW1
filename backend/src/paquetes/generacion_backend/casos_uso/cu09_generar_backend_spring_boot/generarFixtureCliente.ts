import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { generarProyectoSpring } from "./GeneradorSpringBoot.js"
import { fixtureCliente } from "./fixtureCliente.js"

export async function generarFixtureEnDirectorio(salida: string): Promise<string[]> {
  await rm(salida, { recursive: true, force: true })
  return generarProyectoSpring(fixtureCliente, salida)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const salida = resolve("generated-test-output", "cliente-backend")
  const archivos = await generarFixtureEnDirectorio(salida)
  console.log(`Fixture generado en ${salida}`)
  console.log(`${archivos.length} archivos generados`)
}
