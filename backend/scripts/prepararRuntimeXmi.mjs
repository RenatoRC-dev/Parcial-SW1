import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { devNull, tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

// Solo el requisito existente del proyecto, en el venv local ya excluido de Git.
// No apt, paquetes globales, Docker build ni sobrescritura de evidencia.
const ejecutar = promisify(execFile)
const backend = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const argumentos = process.argv.slice(2)
const posicionVenv = argumentos.indexOf("--venv")
if (posicionVenv >= 0 && !argumentos[posicionVenv + 1]) throw new Error("--venv requiere una ruta.")
const venv = posicionVenv >= 0 ? resolve(argumentos[posicionVenv + 1]) : join(backend, ".venv-crunch")
const python = join(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
const base = process.platform === "win32" ? "python" : "python3"
const reparar = process.argv.includes("--repair")
const imports = "import sys,json,importlib.metadata as m; from crunch_uml import const,db; import crunch_uml.schema; from crunch_uml.parsers.eaxmiparser import EAXMIParser; from crunch_uml.renderers.xmirenderer import XMIRenderer; import lxml.etree,sqlalchemy,pandas,jinja2; assert m.version('crunch-uml')=='0.6.0'; print(json.dumps({'python':sys.executable,'crunch':m.version('crunch-uml'),'imports':'ok'}))"
const entorno = { ...process.env, translators_default_region: "EN", PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1" }
const existe = async (ruta) => access(ruta).then(() => true, () => false)
async function registrar() {
  if (!argumentos.includes("--configure")) return
  const carpeta = join(backend, ".python-xmi")
  await mkdir(carpeta, { recursive: true })
  const archivo = join(carpeta, "runtime.json")
  if (await existe(archivo)) {
    if (JSON.parse(await readFile(archivo, "utf8")).python === python) return
    throw new Error("runtime.json ya configura otro Python; no se sobrescribió.")
  }
  // Creación exclusiva: nunca sobrescribe configuración previa del usuario.
  await writeFile(archivo, JSON.stringify({ python }, null, 2), { flag: "wx" })
}
if (!await existe(backend)) throw new Error("No existe el directorio backend.")
if (await existe(python)) {
  let resultado
  try {
    resultado = await ejecutar(python, ["-c", imports], { env: entorno, timeout: 60_000 })
  } catch {
    if (!reparar) throw new Error("El venv existente no está listo. No se sobrescribió: revísalo; --repair reintenta solo requirements-xmi.txt dentro del mismo venv.")
  }
  if (resultado) {
    console.log(resultado.stdout.trim())
    await registrar()
    process.exit(0)
  }
} else {
  if (await existe(venv)) throw new Error(".venv-crunch ya existe sin un Python compatible. No se sobrescribió.")
  await ejecutar(base, ["-m", "venv", "--without-pip", venv], { timeout: 60_000 })
}
await ejecutar(python, ["-c", "import sys; assert sys.prefix != sys.base_prefix, 'Se requiere un venv aislado'"], { timeout: 30_000 })

// Debian puede traer venv sin ensurepip. Bootstrap desde rueda pip fijada,
// validada con SHA256 publicado por PyPI; ejecución confinada al venv.
const temporal = await mkdtemp(join(tmpdir(), "nexocase-pip-"))
try {
  const metadata = await fetch("https://pypi.org/pypi/pip/25.3/json", { signal: AbortSignal.timeout(30_000) })
  if (!metadata.ok) throw new Error(`PyPI pip no disponible (HTTP ${metadata.status}).`)
  const info = await metadata.json()
  const rueda = info.urls.find((f) => f.packagetype === "bdist_wheel" && f.filename === "pip-25.3-py3-none-any.whl")
  if (!rueda || new URL(rueda.url).hostname !== "files.pythonhosted.org") throw new Error("No se encontró la rueda oficial pip esperada.")
  const respuesta = await fetch(rueda.url, { signal: AbortSignal.timeout(60_000) })
  if (!respuesta.ok) throw new Error(`Descarga pip no disponible (HTTP ${respuesta.status}).`)
  const datos = Buffer.from(await respuesta.arrayBuffer())
  if (createHash("sha256").update(datos).digest("hex") !== rueda.digests.sha256) throw new Error("La rueda pip no coincide con su SHA256.")
  const archivo = join(temporal, rueda.filename)
  await writeFile(archivo, datos, { flag: "wx" })
  const resultado = await ejecutar(python, ["-m", "pip", "install", "--quiet", "--no-compile", "--no-input", "--disable-pip-version-check", "--no-cache-dir", "--only-binary=:all:", "pip==25.3", "-r", join(backend, "requirements-xmi.txt")], {
    env: { ...entorno, PYTHONPATH: archivo, PIP_REQUIRE_VIRTUALENV: "true", PIP_CONFIG_FILE: devNull, PIP_INDEX_URL: "https://pypi.org/simple", PIP_EXTRA_INDEX_URL: "" },
    timeout: 600_000, maxBuffer: 2 * 1024 * 1024,
  })
  console.log(resultado.stdout)
  const verificado = await ejecutar(python, ["-c", imports], { env: entorno, timeout: 60_000 })
  console.log(verificado.stdout.trim())
  await registrar()
} finally {
  // Únicamente el temporal exclusivo mkdtemp de este proceso, nunca evidencia previa.
  await rm(temporal, { recursive: true, force: true })
}
