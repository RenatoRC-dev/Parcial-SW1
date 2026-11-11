import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { exportarModeloXmi } from "../casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import { importarModeloXmi } from "../casos_uso/cu06_importar_modelo_xmi/importarModeloXmi.js"
import { fixtureTiposOpcionales } from "./fixtureTiposOpcionales.js"

// Explicit owner-invoked smoke, not a unit-test dependency; existing connector is read-only.
if (process.platform !== "win32") throw new Error("This smoke requires Windows and installed EA COM.")
const dir = await mkdtemp(join(tmpdir(), "nexocase-optional-ea-"))
await writeFile(join(dir, "nexocase.xmi"), await exportarModeloXmi(fixtureTiposOpcionales), { flag: "wx" })
const script = fileURLToPath(new URL("./probarTiposOpcionalesEA.ps1", import.meta.url))
const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", script, "-Directory", dir], { timeout: 60000, maxBuffer: 2 * 1024 * 1024 })
const evidence = JSON.parse(stdout.trim()) as { libraryVersion: string; imported: { classes: Array<{ name: string; attributes: Array<{ name: string; type: string }> }> }; native: unknown }
assert.equal(evidence.imported.classes.length, 2)
assert.equal(evidence.imported.classes.find((c) => c.name === "VentaCredito")?.attributes.length, 0)
const imported = await importarModeloXmi(await readFile(join(dir, "ea-roundtrip.xmi"), "utf8"))
const cliente = imported.modelo.clases.find((c) => c.nombre === "Cliente")!
assert(cliente)
for (const nombre of ["nombre", "telefono", "apodo"]) assert.equal(cliente.atributos.find((a) => a.nombre === nombre)?.tipo, null, `${nombre} must remain untyped after EA export`)
assert.equal(cliente.atributos.find((a) => a.nombre === "correo")?.tipo, "String")
assert.equal(imported.modelo.clases.find((c) => c.nombre === "VentaCredito")?.atributos.length, 0)
assert.equal(imported.modelo.relaciones.length, 1)
const relacion = imported.modelo.relaciones[0]
assert.equal(imported.modelo.clases.find((c) => c.id === relacion.claseOrigenId)?.nombre, "Cliente")
assert.equal(imported.modelo.clases.find((c) => c.id === relacion.claseDestinoId)?.nombre, "VentaCredito")
assert.equal(relacion.multiplicidadOrigen, "1"); assert.equal(relacion.multiplicidadDestino, "0..*")
assert.equal(relacion.rolOrigen, "cliente"); assert.equal(relacion.rolDestino, "ventas")
const final = await importarModeloXmi((await exportarModeloXmi(imported.modelo)).toString("utf8"))
const atributosFinal = final.modelo.clases.find((c) => c.nombre === "Cliente")!.atributos
assert.deepEqual(atributosFinal.map((a) => [a.id, a.nombre, a.tipo]).sort(), cliente.atributos.map((a) => [a.id, a.nombre, a.tipo]).sort())
console.log(JSON.stringify({ status: "PASS", evidenceDirectory: dir, eaLibraryVersion: evidence.libraryVersion, directions: ["NexoCASE CU07 → actual EA COM inspection", "native EA typeless attribute → EA XMI2.1 → CU06", "EA-imported model → CU07 → CU06"], attributes: atributosFinal.map(({ nombre, tipo }) => ({ nombre, tipo })), emptyClass: "VentaCredito", association: { multiplicities: ["1", "0..*"], roles: ["cliente", "ventas"] }, identity: "EA StripGUID=1 intentionally replaces IDs; subsequent CU06/CU07 preserves EA-generated IDs", warnings: imported.advertencias }, null, 2))
