import type express from "express"
import { abrirProyecto, crearProyecto, ErrorNombreProyectoInvalido, listarProyectos } from "../casos_uso/cu01_crear_abrir_proyecto/GestionarProyectos.js"
import { ErrorModeloPersistibleInvalido, guardarTrabajo } from "../casos_uso/cu11_guardar_recuperar_trabajo/GuardarRecuperarProyecto.js"
import { ErrorDatosProyectoCorruptos, ErrorNombreProyectoDuplicado, ErrorPersistenciaProyecto, type RepositorioProyectos } from "../compartido/RepositorioProyectos.js"

const patronUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function registrarRutasProyectos(aplicacion: express.Express, repositorio: RepositorioProyectos): void {
  aplicacion.get("/api/proyectos", async (_solicitud, respuesta) => {
    try { respuesta.json(await listarProyectos(repositorio)) } catch (error) { responderError(error, respuesta) }
  })

  aplicacion.post("/api/proyectos", async (solicitud, respuesta) => {
    try {
      if (typeof solicitud.body?.nombre !== "string") throw new ErrorNombreProyectoInvalido("Se requiere un nombre de proyecto.")
      respuesta.status(201).json(await crearProyecto(repositorio, solicitud.body.nombre))
    } catch (error) { responderError(error, respuesta) }
  })

  aplicacion.get("/api/proyectos/:id", async (solicitud, respuesta) => {
    if (!patronUuid.test(solicitud.params.id)) { respuesta.status(400).json({ error: "El identificador de proyecto no es válido." }); return }
    try {
      const proyecto = await abrirProyecto(repositorio, solicitud.params.id)
      if (!proyecto) { respuesta.status(404).json({ error: "Proyecto no encontrado." }); return }
      respuesta.json(proyecto)
    } catch (error) { responderError(error, respuesta) }
  })

  aplicacion.put("/api/proyectos/:id/modelo", async (solicitud, respuesta) => {
    if (!patronUuid.test(solicitud.params.id)) { respuesta.status(400).json({ error: "El identificador de proyecto no es válido." }); return }
    try {
      const proyecto = await guardarTrabajo(repositorio, solicitud.params.id, solicitud.body?.modelo)
      if (!proyecto) { respuesta.status(404).json({ error: "Proyecto no encontrado." }); return }
      const { modelo: _modelo, ...resumen } = proyecto
      respuesta.json(resumen)
    } catch (error) { responderError(error, respuesta) }
  })
}

function responderError(error: unknown, respuesta: express.Response): void {
  if (error instanceof ErrorNombreProyectoInvalido || error instanceof ErrorModeloPersistibleInvalido) {
    respuesta.status(400).json({ error: error.message }); return
  }
  if (error instanceof ErrorNombreProyectoDuplicado) {
    respuesta.status(409).json({ error: error.message }); return
  }
  if (error instanceof ErrorDatosProyectoCorruptos || error instanceof ErrorPersistenciaProyecto) {
    respuesta.status(500).json({ error: "No se pudo acceder a los proyectos persistidos." }); return
  }
  console.error(error)
  respuesta.status(500).json({ error: "No se pudo completar la operación de proyecto." })
}
