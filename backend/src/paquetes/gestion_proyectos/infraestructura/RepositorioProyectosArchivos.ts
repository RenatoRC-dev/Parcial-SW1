import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { ProyectoPersistido, ResumenProyecto } from "../compartido/ProyectoPersistido.js"
import {
  ErrorConflictoRevisionProyecto,
  ErrorDatosProyectoCorruptos,
  ErrorPersistenciaProyecto,
  ErrorProyectoNoEncontrado,
  type RepositorioProyectos,
} from "../compartido/RepositorioProyectos.js"
import { esModeloUMLPersistible } from "../compartido/ValidarProyectoPersistido.js"

function esProyecto(valor: unknown): valor is ProyectoPersistido {
  if (typeof valor !== "object" || valor === null) return false
  const proyecto = valor as Record<string, unknown>
  return typeof proyecto.id === "string" && typeof proyecto.nombre === "string"
    && typeof proyecto.creadoEn === "string" && !Number.isNaN(Date.parse(proyecto.creadoEn))
    && typeof proyecto.actualizadoEn === "string" && !Number.isNaN(Date.parse(proyecto.actualizadoEn))
    && (proyecto.revisionModelo === undefined || (Number.isInteger(proyecto.revisionModelo) && Number(proyecto.revisionModelo) >= 0))
    && esModeloUMLPersistible(proyecto.modelo)
}

function normalizarProyecto(proyecto: ProyectoPersistido): ProyectoPersistido {
  return {
    ...proyecto,
    revisionModelo: Number.isInteger(proyecto.revisionModelo) ? proyecto.revisionModelo : 0,
    modelo: {
      ...proyecto.modelo,
      clases: proyecto.modelo.clases.map((clase) => ({
        ...clase,
        tipoClase: clase.tipoClase === "asociativa" ? "asociativa" : "normal",
      })),
    },
  }
}

interface DocumentoProyectoArchivo {
  proyecto: ProyectoPersistido
  codigoAccesoDigest: string | null
}

export class RepositorioProyectosArchivos implements RepositorioProyectos {
  readonly directorio: string

  constructor(directorio = process.env.SW1_PROJECTS_DIR?.trim() || resolve(process.cwd(), ".sw1-data", "proyectos")) {
    this.directorio = resolve(directorio)
  }

  async listar(): Promise<ResumenProyecto[]> {
    await mkdir(this.directorio, { recursive: true })
    const archivos = (await readdir(this.directorio)).filter((archivo) => archivo.endsWith(".json") && !archivo.endsWith(".tmp.json"))
    const documentos = await Promise.all(archivos.map((archivo) => this.leerDocumento(join(this.directorio, archivo))))
    return documentos.map(({ proyecto: { modelo: _modelo, ...resumen } }) => resumen)
      .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
  }

  async crear(proyecto: ProyectoPersistido, codigoAccesoDigest: string | null): Promise<ProyectoPersistido> {
    const normalizado = normalizarProyecto(proyecto)
    await this.escribirAtomico(normalizado, codigoAccesoDigest)
    return structuredClone(normalizado)
  }

  async obtenerPorId(id: string): Promise<ProyectoPersistido | null> {
    try {
      return (await this.leerDocumento(this.ruta(id))).proyecto
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null
      throw error
    }
  }

  async buscarPorCodigoAccesoDigest(digest: string): Promise<ProyectoPersistido | null> {
    await mkdir(this.directorio, { recursive: true })
    const archivos = (await readdir(this.directorio)).filter((archivo) => archivo.endsWith(".json") && !archivo.endsWith(".tmp.json"))
    for (const archivo of archivos) {
      const documento = await this.leerDocumento(join(this.directorio, archivo))
      if (documento.codigoAccesoDigest === digest) return documento.proyecto
    }
    return null
  }

  async eliminar(id: string): Promise<void> {
    try {
      await rm(this.ruta(id))
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return
      throw new ErrorPersistenciaProyecto("No se pudo eliminar el proyecto compensado.", { cause: error })
    }
  }

  async guardarModeloConRevision(
    id: string,
    modelo: ModeloUMLCanonicoIntercambio,
    revisionBase: number,
    actualizadoEn: string,
  ): Promise<ProyectoPersistido> {
    const documento = await this.obtenerDocumentoPorId(id)
    if (!documento) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
    const actual = documento.proyecto
    if (actual.revisionModelo !== revisionBase) {
      throw new ErrorConflictoRevisionProyecto("El proyecto fue guardado desde otra revisión.")
    }
    const actualizado = normalizarProyecto({
      ...actual,
      actualizadoEn,
      revisionModelo: revisionBase + 1,
      modelo: structuredClone(modelo),
    })
    await this.escribirAtomico(actualizado, documento.codigoAccesoDigest)
    return actualizado
  }

  private ruta(id: string): string { return join(this.directorio, `${id}.json`) }

  private async obtenerDocumentoPorId(id: string): Promise<DocumentoProyectoArchivo | null> {
    try {
      return await this.leerDocumento(this.ruta(id))
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null
      throw error
    }
  }

  private async leerDocumento(ruta: string): Promise<DocumentoProyectoArchivo> {
    try {
      const valor: unknown = JSON.parse(await readFile(ruta, "utf8"))
      if (!esProyecto(valor)) throw new ErrorDatosProyectoCorruptos("Los datos persistidos del proyecto no son válidos.")
      const digest = (valor as unknown as Record<string, unknown>).codigoAccesoDigest
      if (!(digest === undefined || digest === null || typeof digest === "string")) {
        throw new ErrorDatosProyectoCorruptos("El verificador de acceso persistido no es válido.")
      }
      return { proyecto: normalizarProyecto(valor), codigoAccesoDigest: digest ?? null }
    } catch (error) {
      if (error instanceof ErrorDatosProyectoCorruptos || (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error
      if (error instanceof SyntaxError) throw new ErrorDatosProyectoCorruptos("Los datos persistidos del proyecto no son JSON válido.")
      throw new ErrorPersistenciaProyecto("No se pudo leer el proyecto.", { cause: error })
    }
  }

  private async escribirAtomico(proyecto: ProyectoPersistido, codigoAccesoDigest: string | null): Promise<void> {
    await mkdir(this.directorio, { recursive: true })
    const destino = this.ruta(proyecto.id)
    const temporal = join(this.directorio, `${proyecto.id}.${process.pid}.${Date.now()}.tmp.json`)
    try {
      await writeFile(temporal, `${JSON.stringify({ ...proyecto, codigoAccesoDigest }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
      await rename(temporal, destino)
    } catch (error) {
      await rm(temporal, { force: true }).catch(() => undefined)
      throw new ErrorPersistenciaProyecto("No se pudo guardar el proyecto.", { cause: error })
    }
  }
}
