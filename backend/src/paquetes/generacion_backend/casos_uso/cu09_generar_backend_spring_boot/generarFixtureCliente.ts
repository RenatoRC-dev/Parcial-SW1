import { resolve } from "node:path"
import { generarProyectoSpring } from "./GeneradorSpringBoot.js"
import { fixtureCliente } from "./fixtureCliente.js"

const salida = resolve("generated-test-output", "cliente-backend")
const archivos = await generarProyectoSpring(fixtureCliente, salida)

console.log(`Fixture generado en ${salida}`)
console.log(`${archivos.length} archivos generados`)
