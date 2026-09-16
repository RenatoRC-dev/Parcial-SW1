import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { generarFixtureEnDirectorio } from "./generarFixtureCliente.js"

const temporales: string[] = []
afterEach(async () => Promise.all(temporales.splice(0).map((ruta) => rm(ruta, { recursive: true, force: true }))))

describe("fixture reproducible", () => {
  it("elimina residuos de ejecuciones anteriores", async () => {
    const salida = await mkdtemp(join(tmpdir(), "sw1-fixture-"))
    temporales.push(salida)
    await mkdir(join(salida, "src"), { recursive: true })
    const residuo = join(salida, "src", "EntidadObsoleta.java")
    await writeFile(residuo, "obsoleto")
    await generarFixtureEnDirectorio(salida)
    await expect(access(residuo)).rejects.toThrow()
  })
})
