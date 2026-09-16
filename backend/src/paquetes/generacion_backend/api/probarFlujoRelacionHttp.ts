import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import JSZip from "jszip"
import { fixtureClientePedido } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureClientePedido.js"
import { crearAplicacionGeneracionBackend } from "./ServidorGeneracionBackend.js"

const salida = resolve("generated-test-output", "relationship-proof")
const rutaZip = join(salida, "backend-generado.zip")
const rutaExtraccion = join(salida, "extraido")
await rm(salida, { recursive: true, force: true })
await mkdir(rutaExtraccion, { recursive: true })

const servidor = crearAplicacionGeneracionBackend().listen(0, "127.0.0.1")
try {
  await new Promise<void>((resolver, rechazar) => {
    servidor.once("listening", resolver)
    servidor.once("error", rechazar)
  })
  const direccion = servidor.address()
  if (!direccion || typeof direccion === "string") throw new Error("No se obtuvo el puerto HTTP.")
  const respuesta = await fetch(`http://127.0.0.1:${direccion.port}/api/generacion/spring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixtureClientePedido),
  })
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status}: ${await respuesta.text()}`)
  const contenido = Buffer.from(await respuesta.arrayBuffer())
  await writeFile(rutaZip, contenido)

  const zip = await JSZip.loadAsync(contenido)
  for (const [nombre, entrada] of Object.entries(zip.files)) {
    if (entrada.dir) continue
    const destino = join(rutaExtraccion, ...nombre.split("/"))
    await mkdir(dirname(destino), { recursive: true })
    await writeFile(destino, await entrada.async("nodebuffer"))
  }
  console.log(`ZIP de relación guardado en ${rutaZip}`)
  console.log(`Proyecto de relación extraído en ${join(rutaExtraccion, "backend-generado")}`)
} finally {
  await new Promise<void>((resolver, rechazar) => servidor.close((error) => error ? rechazar(error) : resolver()))
}
