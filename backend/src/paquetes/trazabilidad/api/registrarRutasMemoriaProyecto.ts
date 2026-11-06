import type express from "express"
import type { ProtegerAccesoProyecto } from "../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import type { SolicitudConAccesoProyecto } from "../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { crearRequerirAccesoProyecto } from "../../gestion_proyectos/api/requerirAccesoProyecto.js"
import type { RepositorioParticipantes } from "../../gestion_proyectos/compartido/RepositorioParticipantes.js"
import type { RepositorioProyectos } from "../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { RepositorioMensajes } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { ErrorDatosMensajeCorruptos, ErrorPersistenciaMensaje } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { TIPOS_EVENTO_PROYECTO, type CursorEventos, type TipoEventoProyecto } from "../compartido/EventoProyecto.js"
import type { RepositorioEventos } from "../compartido/RepositorioEventos.js"
import { ErrorDatosEventoCorruptos, ErrorPersistenciaEvento } from "../compartido/RepositorioEventos.js"
import { ErrorActividadInvalida, RegistrarActividadProyecto } from "../casos_uso/RegistrarActividadProyecto.js"

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function limite(valor: unknown): number {
  if (valor === undefined) return 30
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 1 || numero > 100) throw new ErrorActividadInvalida("El límite debe estar entre 1 y 100.")
  return numero
}
function codificarCursor(cursor: { creadoEn: string; id: string } | null): string | null {
  return cursor ? Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") : null
}
function decodificarCursor(valor: unknown): CursorEventos | undefined {
  if (valor === undefined) return undefined
  if (typeof valor !== "string" || valor.length > 500) throw new ErrorActividadInvalida("El cursor no es válido.")
  try {
    const cursor = JSON.parse(Buffer.from(valor, "base64url").toString("utf8")) as Record<string, unknown>
    if (typeof cursor.creadoEn !== "string" || Number.isNaN(new Date(cursor.creadoEn).getTime()) || typeof cursor.id !== "string" || !cursor.id) throw new Error()
    return { creadoEn: cursor.creadoEn, id: cursor.id }
  } catch { throw new ErrorActividadInvalida("El cursor no es válido.") }
}
function textoConsulta(valor: unknown, maximo = 160): string | undefined {
  if (valor === undefined) return undefined
  if (typeof valor !== "string" || !valor || valor.length > maximo) throw new ErrorActividadInvalida("El filtro no es válido.")
  return valor
}

export function registrarRutasMemoriaProyecto(aplicacion: express.Express, dependencias: {
  proyectos: RepositorioProyectos; participantes: RepositorioParticipantes; protector: ProtegerAccesoProyecto
  eventos: RepositorioEventos; mensajes: RepositorioMensajes
}): void {
  const requerir = crearRequerirAccesoProyecto(dependencias.proyectos, dependencias.participantes, dependencias.protector)
  const actividad = new RegistrarActividadProyecto(dependencias.eventos, dependencias.proyectos)

  aplicacion.post("/api/proyectos/:id/actividad/modelado", requerir, async (solicitud, respuesta) => {
    const id = Array.isArray(solicitud.params.id) ? "" : solicitud.params.id
    if (!PATRON_UUID.test(id)) { respuesta.status(400).json({ error: "Proyecto inválido.", codigo: "SOLICITUD_INVALIDA" }); return }
    try {
      const body = solicitud.body ?? {}
      const evento = await actividad.registrarManual((solicitud as SolicitudConAccesoProyecto).accesoProyecto, {
        clientChangeId: body.clientChangeId, tipo: body.tipo,
        elemento: body.elemento ? { id: body.elemento.id, tipo: body.elemento.tipo, nombreSnapshot: body.elemento.nombreSnapshot } : body.elemento,
        detalle: body.detalle,
      })
      respuesta.status(201).json(evento)
    } catch (error) { responder(error, respuesta) }
  })

  aplicacion.post("/api/proyectos/:id/actividad/integracion", requerir, async (solicitud, respuesta) => {
    const id = Array.isArray(solicitud.params.id) ? "" : solicitud.params.id
    if (!PATRON_UUID.test(id)) { respuesta.status(400).json({ error: "Proyecto invalido.", codigo: "SOLICITUD_INVALIDA" }); return }
    try {
      const body = solicitud.body ?? {}
      const evento = await actividad.registrarIntegracion((solicitud as SolicitudConAccesoProyecto).accesoProyecto, {
        clientChangeId: body.clientChangeId, mecanismo: body.mecanismo, tipo: body.tipo,
        elemento: body.elemento ? { id: body.elemento.id, tipo: body.elemento.tipo, nombreSnapshot: body.elemento.nombreSnapshot } : null,
      })
      respuesta.status(201).json(evento)
    } catch (error) { responder(error, respuesta) }
  })

  aplicacion.get("/api/proyectos/:id/actividad", requerir, async (solicitud, respuesta) => {
    try {
      const tipo = textoConsulta(solicitud.query.tipo) as TipoEventoProyecto | undefined
      if (tipo && !TIPOS_EVENTO_PROYECTO.includes(tipo)) throw new ErrorActividadInvalida("El tipo de actividad no es válido.")
      const pagina = await dependencias.eventos.listarPorProyecto({
        projectId: (solicitud as SolicitudConAccesoProyecto).accesoProyecto.projectId,
        limite: limite(solicitud.query.limite), cursor: decodificarCursor(solicitud.query.cursor),
        elementoId: textoConsulta(solicitud.query.elementoId), participantId: textoConsulta(solicitud.query.participantId), tipo,
      })
      respuesta.json({ items: pagina.items, siguienteCursor: codificarCursor(pagina.siguienteCursor) })
    } catch (error) { responder(error, respuesta) }
  })

  aplicacion.get("/api/proyectos/:id/mensajes", requerir, async (solicitud, respuesta) => {
    try {
      const pagina = await dependencias.mensajes.listarPorProyecto({
        projectId: (solicitud as SolicitudConAccesoProyecto).accesoProyecto.projectId,
        limite: limite(solicitud.query.limite), cursor: decodificarCursor(solicitud.query.cursor),
      })
      respuesta.json({ items: pagina.items, siguienteCursor: codificarCursor(pagina.siguienteCursor) })
    } catch (error) { responder(error, respuesta) }
  })
}

function responder(error: unknown, respuesta: express.Response): void {
  if (error instanceof ErrorActividadInvalida) { respuesta.status(400).json({ error: error.message, codigo: "SOLICITUD_INVALIDA" }); return }
  if (error instanceof ErrorPersistenciaEvento || error instanceof ErrorDatosEventoCorruptos
    || error instanceof ErrorPersistenciaMensaje || error instanceof ErrorDatosMensajeCorruptos) {
    respuesta.status(503).json({ error: "La memoria del proyecto no está disponible.", codigo: "PERSISTENCIA_NO_DISPONIBLE" }); return
  }
  respuesta.status(500).json({ error: "No se pudo completar la operación.", codigo: "ERROR_INTERNO" })
}
