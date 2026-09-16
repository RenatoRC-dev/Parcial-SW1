import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import JSZip from "jszip"
import { afterEach, describe, expect, it } from "vitest"
import { empaquetarBackendGenerado } from "./EmpaquetadorBackendGenerado.js"

const temporales: string[] = []
afterEach(async () => Promise.all(temporales.splice(0).map((ruta) => rm(ruta, { recursive: true, force: true }))))

describe("EmpaquetadorBackendGenerado", () => {
  it("crea un ZIP con una sola raíz y excluye artefactos no entregables", async () => {
    const raiz = await mkdtemp(join(tmpdir(), "sw1-zip-"))
    temporales.push(raiz)
    await mkdir(join(raiz, "src"), { recursive: true })
    await mkdir(join(raiz, "target"), { recursive: true })
    await mkdir(join(raiz, "node_modules"), { recursive: true })
    await writeFile(join(raiz, "pom.xml"), "<project />")
    await writeFile(join(raiz, "src", "Aplicacion.java"), "class Aplicacion {}")
    await writeFile(join(raiz, "target", "residuo.class"), "residuo")
    await writeFile(join(raiz, "node_modules", "residuo.js"), "residuo")

    const zip = await JSZip.loadAsync(await empaquetarBackendGenerado(raiz))
    const nombres = Object.keys(zip.files)
    expect(nombres).toContain("backend-generado/pom.xml")
    expect(nombres).toContain("backend-generado/src/Aplicacion.java")
    expect(nombres.some((nombre) => nombre.includes("target"))).toBe(false)
    expect(nombres.some((nombre) => nombre.includes("node_modules"))).toBe(false)
    expect(nombres.every((nombre) => nombre.startsWith("backend-generado/"))).toBe(true)
  })
})
