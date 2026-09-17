import { execFile } from "node:child_process"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import type {
  ModeloUMLCanonicoIntercambio,
  ResultadoImportacionXmi,
} from "./ContratoInteroperabilidadXmi.js"

const ejecutarArchivo = promisify(execFile)
const DIRECTORIO_ACTUAL = dirname(fileURLToPath(import.meta.url))
const PUENTE = join(DIRECTORIO_ACTUAL, "bridge_crunch_uml.py")

export class ErrorInteroperabilidadXmi extends Error {
  constructor(
    message: string,
    readonly tipo: "entrada" | "configuracion" | "interno" = "entrada",
  ) {
    super(message)
  }
}

async function existe(ruta: string): Promise<boolean> {
  try {
    await access(ruta)
    return true
  } catch {
    return false
  }
}

async function resolverCrunchUml(): Promise<string> {
  const configurado = process.env.SW1_CRUNCH_UML_PATH
  const candidato = configurado
    ? resolve(configurado)
    : resolve(DIRECTORIO_ACTUAL, "../../../../../../../crunch_uml")
  if (!(await existe(join(candidato, "crunch_uml", "__init__.py")))) {
    throw new ErrorInteroperabilidadXmi(
      "No se encontró crunch_uml. Configure SW1_CRUNCH_UML_PATH.",
      "configuracion",
    )
  }
  return candidato
}

async function resolverPython(): Promise<string> {
  if (process.env.SW1_PYTHON_PATH) return process.env.SW1_PYTHON_PATH
  const local = resolve(DIRECTORIO_ACTUAL, "../../../../../.venv-crunch/Scripts/python.exe")
  return (await existe(local)) ? local : "python"
}

async function ejecutarPuente(
  operacion: "importar" | "exportar",
  entrada: string,
  salida: string,
): Promise<void> {
  const crunch = await resolverCrunchUml()
  const python = await resolverPython()
  try {
    await ejecutarArchivo(python, [PUENTE, operacion, crunch, entrada, salida], {
      env: {
        ...process.env,
        translators_default_region: process.env.translators_default_region ?? "EN",
      },
      timeout: 30_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
  } catch (error) {
    const detalle = error as { stderr?: string; killed?: boolean }
    if (detalle.killed) {
      throw new ErrorInteroperabilidadXmi("La operación XMI excedió el tiempo permitido.", "interno")
    }
    const mensaje = detalle.stderr?.trim()
    if (mensaje?.startsWith("ENTRADA:")) {
      throw new ErrorInteroperabilidadXmi(mensaje.slice("ENTRADA:".length).trim())
    }
    if (mensaje?.startsWith("CONFIGURACION:")) {
      throw new ErrorInteroperabilidadXmi(mensaje.slice("CONFIGURACION:".length).trim(), "configuracion")
    }
    if (mensaje) console.error(`Puente XMI: ${mensaje}`)
    throw new ErrorInteroperabilidadXmi("El puente XMI no pudo completar la operación.", "interno")
  }
}

export async function importarXmi(textoXmi: string): Promise<ResultadoImportacionXmi> {
  if (textoXmi.trim() === "") throw new ErrorInteroperabilidadXmi("El contenido XMI está vacío.")
  const temporal = await mkdtemp(join(tmpdir(), "sw1-xmi-import-"))
  const entrada = join(temporal, "entrada.xmi")
  const salida = join(temporal, "resultado.json")
  try {
    await writeFile(entrada, textoXmi, "utf8")
    await ejecutarPuente("importar", entrada, salida)
    return JSON.parse(await readFile(salida, "utf8")) as ResultadoImportacionXmi
  } finally {
    await rm(temporal, { recursive: true, force: true })
  }
}

function multiplicidadesUnoAMuchos(origen: string | null, destino: string | null): boolean {
  return (origen === "1" && destino === "0..*") || (origen === "0..*" && destino === "1")
}

export function validarAptitudExportacionXmi(modelo: ModeloUMLCanonicoIntercambio): string[] {
  const errores: string[] = []
  if (!modelo.id?.trim() || !modelo.nombre?.trim() || !Array.isArray(modelo.clases) || !Array.isArray(modelo.relaciones)) {
    return ["El cuerpo no contiene un ModeloUMLCanonico válido."]
  }
  if (modelo.clases.some((clase) => clase.abstracta)) {
    errores.push("Las clases abstractas no pertenecen al perfil XMI de esta iteración.")
  }
  if (modelo.clases.some((clase) => clase.atributos.some((atributo) => atributo.visibilidad !== undefined))) {
    errores.push("La visibilidad de atributos no pertenece al perfil XMI comprobado de esta iteración.")
  }
  const idsClases = modelo.clases.map((clase) => clase.id)
  if (new Set(idsClases).size !== idsClases.length || idsClases.some((id) => !id.trim())) {
    errores.push("Los ids de clase deben ser únicos y no vacíos.")
  }
  if (modelo.clases.some((clase) => !clase.nombre.trim() || !Number.isFinite(clase.posicion?.x) || !Number.isFinite(clase.posicion?.y))) {
    errores.push("Cada clase debe tener nombre y posición x/y válidos.")
  }
  const idsAtributos = modelo.clases.flatMap((clase) => clase.atributos.map((atributo) => atributo.id))
  if (new Set(idsAtributos).size !== idsAtributos.length || idsAtributos.some((id) => !id.trim())) {
    errores.push("Los ids de atributo deben ser únicos y no vacíos.")
  }
  const idsRelaciones = modelo.relaciones.map((relacion) => relacion.id)
  if (new Set(idsRelaciones).size !== idsRelaciones.length || idsRelaciones.some((id) => !id.trim())) {
    errores.push("Los ids de relación deben ser únicos y no vacíos.")
  }
  const conjuntoClases = new Set(idsClases)
  for (const relacion of modelo.relaciones) {
    if (!conjuntoClases.has(relacion.claseOrigenId) || !conjuntoClases.has(relacion.claseDestinoId)) {
      errores.push(`La relación ${relacion.id} no conecta dos clases existentes.`)
    }
    if (relacion.tipo !== "asociacion") {
      errores.push(`La relación ${relacion.id} usa el tipo no soportado ${relacion.tipo}.`)
    } else if (!multiplicidadesUnoAMuchos(relacion.multiplicidadOrigen, relacion.multiplicidadDestino)) {
      errores.push(`La relación ${relacion.id} no usa multiplicidad 1 ↔ 0..*.`)
    }
  }
  return errores
}

export async function exportarXmi(modelo: ModeloUMLCanonicoIntercambio): Promise<Buffer> {
  const errores = validarAptitudExportacionXmi(modelo)
  if (errores.length > 0) throw new ErrorInteroperabilidadXmi(errores.join(" "))
  const temporal = await mkdtemp(join(tmpdir(), "sw1-xmi-export-"))
  const entrada = join(temporal, "modelo.json")
  const salida = join(temporal, "modelo.xmi")
  try {
    await writeFile(entrada, JSON.stringify(modelo), "utf8")
    await ejecutarPuente("exportar", entrada, salida)
    return await readFile(salida)
  } finally {
    await rm(temporal, { recursive: true, force: true })
  }
}
