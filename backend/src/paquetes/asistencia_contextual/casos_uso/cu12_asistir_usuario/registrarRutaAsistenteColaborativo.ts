import type { Express } from "express"
import type { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import type { SolicitudConAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { crearRequerirAccesoProyecto } from "../../../gestion_proyectos/api/requerirAccesoProyecto.js"
import type { RepositorioParticipantes } from "../../../gestion_proyectos/compartido/RepositorioParticipantes.js"
import type { RepositorioProyectos } from "../../../gestion_proyectos/compartido/RepositorioProyectos.js"
import { ErrorDatosProyectoCorruptos, ErrorPersistenciaProyecto, ErrorProyectoNoEncontrado } from "../../../gestion_proyectos/compartido/RepositorioProyectos.js"
import { ErrorConflictoRequestMensaje, ErrorMensajeInvalido, GestionarMensajesProyecto } from "../../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import type { PublicadorMensajesProyecto } from "../../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"
import type { RepositorioMensajes } from "../../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { ErrorDatosMensajeCorruptos, ErrorPersistenciaMensaje } from "../../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import type { RepositorioEventos } from "../../../trazabilidad/compartido/RepositorioEventos.js"
import { ErrorDatosEventoCorruptos, ErrorPersistenciaEvento } from "../../../trazabilidad/compartido/RepositorioEventos.js"
import { leerPreguntaAsistenteColaborativo } from "../../compartido/ContratoPreguntaColaborativa.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import { AsistirColaborativamente } from "./AsistirColaborativamente.js"
import { ConstruirContextoAsistenteColaborativo } from "./ConstruirContextoAsistenteColaborativo.js"

export function registrarRutaAsistenteColaborativo(aplicacion: Express, dependencias: {
  proyectos: RepositorioProyectos
  participantes: RepositorioParticipantes
  protector: ProtegerAccesoProyecto
  mensajes: RepositorioMensajes
  eventos: RepositorioEventos
  proveedor: ProveedorAsistenteContextual
  publicador: PublicadorMensajesProyecto
}): void {
  const requerir = crearRequerirAccesoProyecto(dependencias.proyectos, dependencias.participantes, dependencias.protector)
  const servicio = new AsistirColaborativamente(
    new GestionarMensajesProyecto(dependencias.mensajes, dependencias.proyectos),
    new ConstruirContextoAsistenteColaborativo(dependencias.proyectos, dependencias.mensajes, dependencias.eventos),
    dependencias.proveedor,
    dependencias.publicador,
  )
  aplicacion.post("/api/proyectos/:id/asistente-colaborativo/preguntar", requerir, async (solicitud, respuesta) => {
    const pregunta = leerPreguntaAsistenteColaborativo(solicitud.body)
    if (!pregunta) {
      respuesta.status(400).json({ error: "La pregunta colaborativa no cumple el contrato permitido.", codigo: "SOLICITUD_INVALIDA" })
      return
    }
    try {
      respuesta.status(200).json(await servicio.ejecutar((solicitud as SolicitudConAccesoProyecto).accesoProyecto, pregunta))
    } catch (error) {
      if (error instanceof ErrorConflictoRequestMensaje) { respuesta.status(409).json({ error: error.message, codigo: "REQUEST_ID_CONFLICTIVO" }); return }
      if (error instanceof ErrorMensajeInvalido) { respuesta.status(400).json({ error: error.message, codigo: "SOLICITUD_INVALIDA" }); return }
      if (error instanceof ErrorAsistenteContextual) {
        const estado = error.tipo === "limite" ? 429 : error.tipo === "respuesta_invalida" ? 502 : 503
        respuesta.status(estado).json({
          error: error.tipo === "limite" ? "El asistente alcanzó temporalmente su límite de uso."
            : error.tipo === "respuesta_invalida" ? "La respuesta del asistente no cumplió el contrato esperado."
              : "El asistente colaborativo no está disponible temporalmente. La pregunta permanece guardada y puede reintentarse.",
          codigo: error.tipo === "limite" ? "LIMITE_IA" : error.tipo === "respuesta_invalida" ? "RESPUESTA_IA_INVALIDA" : "IA_NO_DISPONIBLE",
        }); return
      }
      if (error instanceof ErrorPersistenciaMensaje || error instanceof ErrorDatosMensajeCorruptos
        || error instanceof ErrorPersistenciaEvento || error instanceof ErrorDatosEventoCorruptos
        || error instanceof ErrorPersistenciaProyecto || error instanceof ErrorDatosProyectoCorruptos) {
        respuesta.status(503).json({ error: "La memoria colaborativa no está disponible.", codigo: "PERSISTENCIA_NO_DISPONIBLE" }); return
      }
      if (error instanceof ErrorProyectoNoEncontrado) { respuesta.status(404).json({ error: error.message, codigo: "PROYECTO_NO_ENCONTRADO" }); return }
      respuesta.status(500).json({ error: "No se pudo completar la consulta colaborativa.", codigo: "ERROR_INTERNO" })
    }
  })
}
