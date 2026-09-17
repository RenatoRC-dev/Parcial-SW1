import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { ProyectoPersistido, ResumenProyecto } from "../compartido/ProyectoPersistido.js"
import { ErrorDatosProyectoCorruptos, ErrorNombreProyectoDuplicado, ErrorPersistenciaProyecto, type RepositorioProyectos } from "../compartido/RepositorioProyectos.js"
import { esModeloUMLPersistible } from "../compartido/ValidarProyectoPersistido.js"

function esProyecto(valor: unknown): valor is ProyectoPersistido {
  if (typeof valor !== "object" || valor === null) return false
  const proyecto = valor as Record<string, unknown>
  return typeof proyecto.id === "string" && typeof proyecto.nombre === "string"
    && typeof proyecto.creadoEn === "string" && !Number.isNaN(Date.parse(proyecto.creadoEn))
    && typeof proyecto.actualizadoEn === "string" && !Number.isNaN(Date.parse(proyecto.actualizadoEn))
    && esModeloUMLPersistible(proyecto.modelo)
}

export class RepositorioProyectosArchivos implements RepositorioProyectos {
  readonly directorio: string

  constructor(directorio = process.env.SW1_PROJECTS_DIR?.trim() || resolve(process.cwd(), ".sw1-data", "proyectos")) {
    this.directorio = resolve(directorio)
  }

  async listar(): Promise<ResumenProyecto[]> {
    await mkdir(this.directorio, { recursive: true })
    const archivos = (await readdir(this.directorio)).filter((archivo) => archivo.endsWith(".json") && !archivo.endsWith(".tmp.json"))
    const proyectos = await Promise.all(archivos.map((archivo) => this.leer(join(this.directorio, archivo))))
    return proyectos.map(({ modelo: _modelo, ...resumen }) => resumen)
      .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
  }

  async crear(proyecto: ProyectoPersistido): Promise<ProyectoPersistido> {
    const existentes = await this.listar()
    if (existentes.some((existente) => existente.nombre.localeCompare(proyecto.nombre, undefined, { sensitivity: "accent" }) === 0)) {
      throw new ErrorNombreProyectoDuplicado("Ya existe un proyecto con ese nombre.")
    }
    await this.escribirAtomico(proyecto)
    return structuredClone(proyecto)
  }

  async obtenerPorId(id: string): Promise<ProyectoPersistido | null> {
    try {
      return await this.leer(this.ruta(id))
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null
      throw error
    }
  }

  async guardarModelo(id: string, modelo: ModeloUMLCanonicoIntercambio, actualizadoEn: string): Promise<ProyectoPersistido | null> {
    const actual = await this.obtenerPorId(id)
    if (!actual) return null
    const actualizado = { ...actual, actualizadoEn, modelo: structuredClone(modelo) }
    await this.escribirAtomico(actualizado)
    return actualizado
  }

  private ruta(id: string): string { return join(this.directorio, `${id}.json`) }

  private async leer(ruta: string): Promise<ProyectoPersistido> {
    try {
      const valor: unknown = JSON.parse(await readFile(ruta, "utf8"))
      if (!esProyecto(valor)) throw new ErrorDatosProyectoCorruptos("Los datos persistidos del proyecto no son válidos.")
      return valor
    } catch (error) {
      if (error instanceof ErrorDatosProyectoCorruptos || (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error
      if (error instanceof SyntaxError) throw new ErrorDatosProyectoCorruptos("Los datos persistidos del proyecto no son JSON válido.")
      throw new ErrorPersistenciaProyecto("No se pudo leer el proyecto.", { cause: error })
    }
  }

  private async escribirAtomico(proyecto: ProyectoPersistido): Promise<void> {
    await mkdir(this.directorio, { recursive: true })
    const destino = this.ruta(proyecto.id)
    const temporal = join(this.directorio, `${proyecto.id}.${process.pid}.${Date.now()}.tmp.json`)
    try {
      await writeFile(temporal, `${JSON.stringify(proyecto, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
      await rename(temporal, destino)
    } catch (error) {
      await rm(temporal, { force: true }).catch(() => undefined)
      throw new ErrorPersistenciaProyecto("No se pudo guardar el proyecto.", { cause: error })
    }
  }
}
