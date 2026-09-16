import { readdir, readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import JSZip from "jszip"

const directoriosExcluidos = new Set(["target", "node_modules", "dist", ".git", "temp"])

async function agregarDirectorio(zip: JSZip, raiz: string, actual: string): Promise<void> {
  for (const entrada of await readdir(actual, { withFileTypes: true })) {
    if (entrada.isDirectory() && directoriosExcluidos.has(entrada.name)) continue
    const ruta = join(actual, entrada.name)
    if (entrada.isDirectory()) {
      await agregarDirectorio(zip, raiz, ruta)
    } else if (entrada.isFile()) {
      const rutaRelativa = relative(raiz, ruta).split(sep).join("/")
      zip.file(`backend-generado/${rutaRelativa}`, await readFile(ruta))
    }
  }
}

export async function empaquetarBackendGenerado(directorioProyecto: string): Promise<Buffer> {
  const zip = new JSZip()
  await agregarDirectorio(zip, directorioProyecto, directorioProyecto)
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
