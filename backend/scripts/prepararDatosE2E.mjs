import { mkdir, rm } from "node:fs/promises"
import { resolve } from "node:path"

const destino = resolve(process.cwd(), "generated-test-output", "e2e-projects")
if (!destino.endsWith(resolve("generated-test-output", "e2e-projects"))) {
  throw new Error("Ruta E2E de proyectos inesperada.")
}
await rm(destino, { recursive: true, force: true })
await mkdir(destino, { recursive: true })
