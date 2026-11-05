import type express from "express"
import type { ProtegerAccesoProyecto } from "../acceso/ProtegerAccesoProyecto.js"
import {
  autenticarAccesoProyecto,
  ErrorAccesoProyectoDenegado,
  ErrorCredencialProyectoInvalida,
  ErrorProyectoAccesoNoEncontrado,
} from "../acceso/autenticarAccesoProyecto.js"
import type { RepositorioParticipantes } from "../compartido/RepositorioParticipantes.js"
import { ErrorDatosParticipanteCorruptos, ErrorPersistenciaParticipante } from "../compartido/RepositorioParticipantes.js"
import type { RepositorioProyectos } from "../compartido/RepositorioProyectos.js"
import { ErrorDatosProyectoCorruptos, ErrorPersistenciaProyecto } from "../compartido/RepositorioProyectos.js"
import type { SolicitudConAccesoProyecto } from "./ContextoAccesoProyecto.js"

export function extraerCredencialBearer(encabezado: string | undefined): string | null {
  if (!encabezado) return null
  const coincidencia = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(encabezado)
  return coincidencia?.[1] ?? null
}

export function crearRequerirAccesoProyecto(
  proyectos: RepositorioProyectos,
  participantes: RepositorioParticipantes,
  protector: ProtegerAccesoProyecto,
): express.RequestHandler {
  return async (solicitud, respuesta, siguiente) => {
    const encabezado = solicitud.headers.authorization
    if (!encabezado) {
      respuesta.status(401).json({ error: "Se requiere una credencial de proyecto.", codigo: "CREDENCIAL_REQUERIDA" })
      return
    }
    const credencial = extraerCredencialBearer(encabezado)
    if (!credencial || !protector.esCredencialConFormatoValido(credencial)) {
      respuesta.status(401).json({ error: "La credencial de proyecto no es válida.", codigo: "CREDENCIAL_INVALIDA" })
      return
    }
    try {
      const projectId = Array.isArray(solicitud.params.id) ? "" : solicitud.params.id
      ;(solicitud as SolicitudConAccesoProyecto).accesoProyecto = await autenticarAccesoProyecto(
        proyectos, participantes, protector, projectId, credencial,
      )
      siguiente()
    } catch (error) {
      if (error instanceof ErrorCredencialProyectoInvalida) {
        respuesta.status(401).json({ error: error.message, codigo: "CREDENCIAL_INVALIDA" }); return
      }
      if (error instanceof ErrorAccesoProyectoDenegado) {
        respuesta.status(403).json({ error: error.message, codigo: "ACCESO_PROYECTO_DENEGADO" }); return
      }
      if (error instanceof ErrorProyectoAccesoNoEncontrado) {
        respuesta.status(404).json({ error: error.message, codigo: "PROYECTO_NO_ENCONTRADO" }); return
      }
      if (error instanceof ErrorPersistenciaProyecto || error instanceof ErrorPersistenciaParticipante
        || error instanceof ErrorDatosProyectoCorruptos || error instanceof ErrorDatosParticipanteCorruptos) {
        respuesta.status(503).json({ error: "La persistencia no está disponible.", codigo: "PERSISTENCIA_NO_DISPONIBLE" })
        return
      }
      respuesta.status(500).json({ error: "No se pudo validar el acceso al proyecto.", codigo: "ERROR_INTERNO" })
    }
  }
}
