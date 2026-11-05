import { MongoServerError, type Collection, type Db } from "mongodb"
import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import {
  ErrorConflictoRevisionProyecto,
  ErrorCodigoAccesoDuplicado,
  ErrorDatosProyectoCorruptos,
  ErrorPersistenciaProyecto,
  ErrorProyectoNoEncontrado,
  type RepositorioProyectos,
} from "../compartido/RepositorioProyectos.js"
import type { ProyectoPersistido, ResumenProyecto } from "../compartido/ProyectoPersistido.js"
import { esModeloUMLPersistible } from "../compartido/ValidarProyectoPersistido.js"
import { COLECCION_PROYECTOS } from "../../../infraestructura/mongodb/crearIndicesMongo.js"

interface DocumentoProyectoMongo {
  _id: string
  nombre: string
  codigoAccesoDigest: string | null
  modelo: ModeloUMLCanonicoIntercambio
  revisionModelo: number
  creadoEn: Date
  actualizadoEn: Date
}

function fechaValida(valor: unknown): valor is Date {
  return valor instanceof Date && !Number.isNaN(valor.getTime())
}

function mapearDocumento(documento: DocumentoProyectoMongo): ProyectoPersistido {
  if (typeof documento._id !== "string" || documento._id.trim() === ""
    || typeof documento.nombre !== "string" || documento.nombre.trim() === ""
    || !(documento.codigoAccesoDigest === null || typeof documento.codigoAccesoDigest === "string")
    || !Number.isInteger(documento.revisionModelo) || documento.revisionModelo < 0
    || !fechaValida(documento.creadoEn) || !fechaValida(documento.actualizadoEn)
    || !esModeloUMLPersistible(documento.modelo)) {
    throw new ErrorDatosProyectoCorruptos("El documento MongoDB del proyecto no es válido.")
  }
  return {
    id: documento._id,
    nombre: documento.nombre,
    creadoEn: documento.creadoEn.toISOString(),
    actualizadoEn: documento.actualizadoEn.toISOString(),
    revisionModelo: documento.revisionModelo,
    modelo: structuredClone(documento.modelo),
  }
}

function mapearParaInsertar(proyecto: ProyectoPersistido, codigoAccesoDigest: string | null): DocumentoProyectoMongo {
  if (typeof proyecto.id !== "string" || proyecto.id.trim() === ""
    || typeof proyecto.nombre !== "string" || proyecto.nombre.trim() === ""
    || !Number.isInteger(proyecto.revisionModelo) || proyecto.revisionModelo < 0
    || !esModeloUMLPersistible(proyecto.modelo)) {
    throw new ErrorDatosProyectoCorruptos("El proyecto no cumple el contrato persistible.")
  }
  const creadoEn = new Date(proyecto.creadoEn)
  const actualizadoEn = new Date(proyecto.actualizadoEn)
  if (!fechaValida(creadoEn) || !fechaValida(actualizadoEn)) {
    throw new ErrorDatosProyectoCorruptos("Las fechas del proyecto no son válidas.")
  }
  return {
    _id: proyecto.id,
    nombre: proyecto.nombre,
    codigoAccesoDigest,
    modelo: structuredClone(proyecto.modelo),
    revisionModelo: proyecto.revisionModelo,
    creadoEn,
    actualizadoEn,
  }
}

export class RepositorioProyectosMongo implements RepositorioProyectos {
  private readonly proyectos: Collection<DocumentoProyectoMongo>

  constructor(baseDatos: Db) {
    this.proyectos = baseDatos.collection<DocumentoProyectoMongo>(COLECCION_PROYECTOS)
  }

  async listar(): Promise<ResumenProyecto[]> {
    return this.controlar(async () => {
      const documentos = await this.proyectos.find().sort({ actualizadoEn: -1 }).toArray()
      return documentos.map((documento) => {
        const { modelo: _modelo, ...resumen } = mapearDocumento(documento)
        return resumen
      })
    })
  }

  async crear(proyecto: ProyectoPersistido, codigoAccesoDigest: string | null): Promise<ProyectoPersistido> {
    try {
      const documento = mapearParaInsertar(proyecto, codigoAccesoDigest)
      await this.proyectos.insertOne(documento)
      return mapearDocumento(documento)
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000 && error.keyPattern?.codigoAccesoDigest) {
        throw new ErrorCodigoAccesoDuplicado("El código generado ya existe.")
      }
      return this.rechazar(error)
    }
  }

  async obtenerPorId(id: string): Promise<ProyectoPersistido | null> {
    return this.controlar(async () => {
      const documento = await this.proyectos.findOne({ _id: id })
      return documento ? mapearDocumento(documento) : null
    })
  }

  async buscarPorCodigoAccesoDigest(digest: string): Promise<ProyectoPersistido | null> {
    return this.controlar(async () => {
      const documento = await this.proyectos.findOne({ codigoAccesoDigest: digest })
      return documento ? mapearDocumento(documento) : null
    })
  }

  async eliminar(id: string): Promise<void> {
    await this.controlar(async () => { await this.proyectos.deleteOne({ _id: id }) })
  }

  async guardarModeloConRevision(
    id: string,
    modelo: ModeloUMLCanonicoIntercambio,
    revisionBase: number,
    actualizadoEn: string,
  ): Promise<ProyectoPersistido> {
    return this.controlar(async () => {
      const fechaActualizacion = new Date(actualizadoEn)
      if (!esModeloUMLPersistible(modelo) || !fechaValida(fechaActualizacion)) {
        throw new ErrorDatosProyectoCorruptos("El snapshot a guardar no es válido.")
      }
      const actualizado = await this.proyectos.findOneAndUpdate(
        { _id: id, revisionModelo: revisionBase },
        {
          $set: { modelo: structuredClone(modelo), actualizadoEn: fechaActualizacion },
          $inc: { revisionModelo: 1 },
        },
        { returnDocument: "after" },
      )
      if (actualizado) return mapearDocumento(actualizado)

      const existe = await this.proyectos.findOne({ _id: id }, { projection: { _id: 1 } })
      if (!existe) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
      throw new ErrorConflictoRevisionProyecto("El proyecto fue guardado desde otra revisión.")
    })
  }

  private async controlar<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion()
    } catch (error) {
      if (error instanceof ErrorDatosProyectoCorruptos
        || error instanceof ErrorProyectoNoEncontrado
        || error instanceof ErrorConflictoRevisionProyecto) throw error
      throw new ErrorPersistenciaProyecto("No se pudo acceder a la persistencia MongoDB de proyectos.", { cause: error })
    }
  }

  private rechazar(error: unknown): never {
    if (error instanceof ErrorDatosProyectoCorruptos
      || error instanceof ErrorProyectoNoEncontrado
      || error instanceof ErrorConflictoRevisionProyecto
      || error instanceof ErrorCodigoAccesoDuplicado) throw error
    throw new ErrorPersistenciaProyecto("No se pudo acceder a la persistencia MongoDB de proyectos.", { cause: error })
  }
}
