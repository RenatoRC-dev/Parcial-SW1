import { MongoServerError, type Collection, type Db } from "mongodb"
import type { ParticipantePersistido } from "../compartido/ParticipantePersistido.js"
import {
  ErrorCredencialParticipanteDuplicada,
  ErrorDatosParticipanteCorruptos,
  ErrorPersistenciaParticipante,
  type RepositorioParticipantes,
} from "../compartido/RepositorioParticipantes.js"
import { COLECCION_PARTICIPANTES } from "../../../infraestructura/mongodb/crearIndicesMongo.js"

interface DocumentoParticipanteMongo {
  _id: string
  projectId: string
  nombreVisible: string
  nombreNormalizado: string
  credencialDigest: string
  creadoEn: Date
  ultimoAccesoEn: Date
}

function fechaValida(valor: unknown): valor is Date {
  return valor instanceof Date && !Number.isNaN(valor.getTime())
}

function mapearDocumento(documento: DocumentoParticipanteMongo): ParticipantePersistido {
  if (typeof documento._id !== "string" || !documento._id
    || typeof documento.projectId !== "string" || !documento.projectId
    || typeof documento.nombreVisible !== "string" || !documento.nombreVisible
    || typeof documento.nombreNormalizado !== "string" || !documento.nombreNormalizado
    || typeof documento.credencialDigest !== "string" || !/^[a-f0-9]{64}$/.test(documento.credencialDigest)
    || !fechaValida(documento.creadoEn) || !fechaValida(documento.ultimoAccesoEn)) {
    throw new ErrorDatosParticipanteCorruptos("El documento MongoDB del participante no es válido.")
  }
  return {
    id: documento._id,
    proyectoId: documento.projectId,
    nombreVisible: documento.nombreVisible,
    nombreNormalizado: documento.nombreNormalizado,
    credencialDigest: documento.credencialDigest,
    creadoEn: documento.creadoEn.toISOString(),
    ultimoAccesoEn: documento.ultimoAccesoEn.toISOString(),
  }
}

function mapearParaInsertar(participante: ParticipantePersistido): DocumentoParticipanteMongo {
  const creadoEn = new Date(participante.creadoEn)
  const ultimoAccesoEn = new Date(participante.ultimoAccesoEn)
  const documento: DocumentoParticipanteMongo = {
    _id: participante.id,
    projectId: participante.proyectoId,
    nombreVisible: participante.nombreVisible,
    nombreNormalizado: participante.nombreNormalizado,
    credencialDigest: participante.credencialDigest,
    creadoEn,
    ultimoAccesoEn,
  }
  mapearDocumento(documento)
  return documento
}

export class RepositorioParticipantesMongo implements RepositorioParticipantes {
  private readonly participantes: Collection<DocumentoParticipanteMongo>

  constructor(baseDatos: Db) {
    this.participantes = baseDatos.collection<DocumentoParticipanteMongo>(COLECCION_PARTICIPANTES)
  }

  async crear(participante: ParticipantePersistido): Promise<ParticipantePersistido> {
    try {
      const documento = mapearParaInsertar(participante)
      await this.participantes.insertOne(documento)
      return mapearDocumento(documento)
    } catch (error) {
      if (error instanceof ErrorDatosParticipanteCorruptos) throw error
      if (error instanceof MongoServerError && error.code === 11000 && error.keyPattern?.credencialDigest) {
        throw new ErrorCredencialParticipanteDuplicada("La credencial generada ya existe.")
      }
      throw new ErrorPersistenciaParticipante("No se pudo guardar el participante.", { cause: error })
    }
  }

  async obtenerPorCredencialDigest(digest: string): Promise<ParticipantePersistido | null> {
    return this.buscar({ credencialDigest: digest })
  }

  async obtenerPorId(id: string): Promise<ParticipantePersistido | null> {
    return this.buscar({ _id: id })
  }

  private async buscar(filtro: Partial<Pick<DocumentoParticipanteMongo, "_id" | "credencialDigest">>): Promise<ParticipantePersistido | null> {
    try {
      const documento = await this.participantes.findOne(filtro)
      return documento ? mapearDocumento(documento) : null
    } catch (error) {
      if (error instanceof ErrorDatosParticipanteCorruptos) throw error
      throw new ErrorPersistenciaParticipante("No se pudo consultar el participante.", { cause: error })
    }
  }
}
