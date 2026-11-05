import type express from "express"
import type { ProtegerAccesoProyecto } from "../acceso/ProtegerAccesoProyecto.js"
import {
  crearProyectoConAcceso, ErrorCodigoProyectoInvalido, ErrorCreacionAccesoProyecto,
  ErrorNombreParticipanteInvalido, unirseAProyecto,
} from "../casos_uso/cu01_crear_abrir_proyecto/GestionarAccesoProyecto.js"
import { abrirProyecto, ErrorNombreProyectoInvalido } from "../casos_uso/cu01_crear_abrir_proyecto/GestionarProyectos.js"
import { ErrorModeloPersistibleInvalido, guardarTrabajo } from "../casos_uso/cu11_guardar_recuperar_trabajo/GuardarRecuperarProyecto.js"
import { ErrorDatosParticipanteCorruptos, ErrorPersistenciaParticipante, type RepositorioParticipantes } from "../compartido/RepositorioParticipantes.js"
import {
  ErrorConflictoRevisionProyecto, ErrorDatosProyectoCorruptos, ErrorPersistenciaProyecto,
  ErrorProyectoNoEncontrado, type RepositorioProyectos,
} from "../compartido/RepositorioProyectos.js"
import { crearLimitadorUnionPredeterminado, type LimitadorIntentos } from "./LimitadorIntentos.js"
import { crearRequerirAccesoProyecto } from "./requerirAccesoProyecto.js"
import type { RepositorioEventos } from "../../trazabilidad/compartido/RepositorioEventos.js"
import type { RepositorioMensajes } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { RegistrarActividadProyecto } from "../../trazabilidad/casos_uso/RegistrarActividadProyecto.js"
import { registrarRutasMemoriaProyecto } from "../../trazabilidad/api/registrarRutasMemoriaProyecto.js"
import type { SolicitudConAccesoProyecto } from "./ContextoAccesoProyecto.js"

const patronUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface DependenciasRutasProyectos {
  proyectos: RepositorioProyectos
  participantes: RepositorioParticipantes
  protector: ProtegerAccesoProyecto
  limitadorUnion?: LimitadorIntentos
  eventos?: RepositorioEventos
  mensajes?: RepositorioMensajes
}

export function registrarRutasProyectos(aplicacion: express.Express, dependencias: DependenciasRutasProyectos): void {
  const { proyectos, participantes, protector } = dependencias
  const limitador = dependencias.limitadorUnion ?? crearLimitadorUnionPredeterminado()
  const requerirAcceso = crearRequerirAccesoProyecto(proyectos, participantes, protector)
  const actividad = dependencias.eventos ? new RegistrarActividadProyecto(dependencias.eventos, proyectos) : null
  const registrarSecundario = async (operacion: () => Promise<unknown>) => {
    try { await operacion() } catch { console.error("No se pudo registrar una actividad secundaria del proyecto.") }
  }

  aplicacion.post("/api/proyectos", async (solicitud, respuesta) => {
    try {
      if (typeof solicitud.body?.nombre !== "string") throw new ErrorNombreProyectoInvalido("Se requiere un nombre de proyecto.")
      const acceso = await crearProyectoConAcceso(
        proyectos, participantes, protector, solicitud.body.nombre, solicitud.body?.nombreParticipante,
      )
      if (actividad) await registrarSecundario(() => actividad.registrarSistema({
        contexto: { projectId: acceso.proyecto.id, participantId: acceso.participante.id, displayName: acceso.participante.nombreVisible },
        tipo: "PROJECT_CREATED", revision: acceso.proyecto.revisionModelo,
      }))
      respuesta.status(201).json(acceso)
    } catch (error) { responderError(error, respuesta) }
  })

  aplicacion.post("/api/proyectos/unirse", async (solicitud, respuesta) => {
    const clave = solicitud.ip || solicitud.socket.remoteAddress || "ip-desconocida"
    if (limitador.estaBloqueado(clave)) {
      respuesta.status(429).json({ error: "Se alcanzó el límite de intentos. Intenta más tarde.", codigo: "LIMITE_INTENTOS" })
      return
    }
    try {
      const acceso = await unirseAProyecto(
        proyectos, participantes, protector, solicitud.body?.codigoAcceso, solicitud.body?.nombreParticipante,
      )
      if (actividad) await registrarSecundario(() => actividad.registrarSistema({
        contexto: { projectId: acceso.proyecto.id, participantId: acceso.participante.id, displayName: acceso.participante.nombreVisible },
        tipo: "PARTICIPANT_JOINED", revision: acceso.proyecto.revisionModelo,
      }))
      limitador.limpiar(clave)
      respuesta.status(200).json(acceso)
    } catch (error) {
      if (error instanceof ErrorCodigoProyectoInvalido && limitador.registrarFallo(clave)) {
        respuesta.status(429).json({ error: "Se alcanzó el límite de intentos. Intenta más tarde.", codigo: "LIMITE_INTENTOS" })
        return
      }
      responderError(error, respuesta)
    }
  })

  aplicacion.get("/api/proyectos/:id", requerirAcceso, async (solicitud, respuesta) => {
    const id = Array.isArray(solicitud.params.id) ? "" : solicitud.params.id
    if (!patronUuid.test(id)) { respuesta.status(400).json({ error: "El identificador de proyecto no es válido." }); return }
    try {
      const proyecto = await abrirProyecto(proyectos, id)
      if (!proyecto) { respuesta.status(404).json({ error: "Proyecto no encontrado.", codigo: "PROYECTO_NO_ENCONTRADO" }); return }
      respuesta.json(proyecto)
    } catch (error) { responderError(error, respuesta) }
  })

  aplicacion.put("/api/proyectos/:id/modelo", requerirAcceso, async (solicitud, respuesta) => {
    const id = Array.isArray(solicitud.params.id) ? "" : solicitud.params.id
    if (!patronUuid.test(id)) { respuesta.status(400).json({ error: "El identificador de proyecto no es válido." }); return }
    try {
      const proyecto = await guardarTrabajo(
        proyectos, id, solicitud.body?.modelo, solicitud.body?.revisionBase,
      )
      if (actividad) await registrarSecundario(() => actividad.registrarSistema({
        contexto: (solicitud as SolicitudConAccesoProyecto).accesoProyecto,
        tipo: "MODEL_SAVED", revision: proyecto.revisionModelo,
      }))
      const { modelo: _modelo, ...resumen } = proyecto
      respuesta.json(resumen)
    } catch (error) { responderError(error, respuesta) }
  })

  if (dependencias.eventos && dependencias.mensajes) registrarRutasMemoriaProyecto(aplicacion, {
    proyectos, participantes, protector, eventos: dependencias.eventos, mensajes: dependencias.mensajes,
  })
}

function responderError(error: unknown, respuesta: express.Response): void {
  if (error instanceof ErrorNombreProyectoInvalido || error instanceof ErrorNombreParticipanteInvalido
    || error instanceof ErrorModeloPersistibleInvalido) {
    respuesta.status(400).json({ error: error.message, codigo: "SOLICITUD_INVALIDA" }); return
  }
  if (error instanceof ErrorCodigoProyectoInvalido) {
    respuesta.status(404).json({ error: "El código de proyecto no es válido.", codigo: "CODIGO_PROYECTO_INVALIDO" }); return
  }
  if (error instanceof ErrorProyectoNoEncontrado) {
    respuesta.status(404).json({ error: "Proyecto no encontrado.", codigo: "PROYECTO_NO_ENCONTRADO" }); return
  }
  if (error instanceof ErrorConflictoRevisionProyecto) {
    respuesta.status(409).json({ error: error.message, codigo: "REVISION_CONFLICTIVA" }); return
  }
  if (error instanceof ErrorDatosProyectoCorruptos || error instanceof ErrorPersistenciaProyecto
    || error instanceof ErrorDatosParticipanteCorruptos || error instanceof ErrorPersistenciaParticipante
    || error instanceof ErrorCreacionAccesoProyecto) {
    respuesta.status(503).json({ error: "La persistencia no está disponible.", codigo: "PERSISTENCIA_NO_DISPONIBLE" }); return
  }
  console.error("Error no controlado en gestión de proyectos.")
  respuesta.status(500).json({ error: "No se pudo completar la operación de proyecto.", codigo: "ERROR_INTERNO" })
}
