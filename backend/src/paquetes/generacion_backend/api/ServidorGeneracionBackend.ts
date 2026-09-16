import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import express from "express"
import { generarProyectoSpring } from "../casos_uso/cu09_generar_backend_spring_boot/GeneradorSpringBoot.js"
import { ErrorModeloNoGenerable } from "../casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import { empaquetarBackendGenerado } from "../casos_uso/cu10_obtener_backend_generado/EmpaquetadorBackendGenerado.js"
import { esModeloUMLCanonicoEntrada } from "./ValidarEntradaModeloCanonico.js"

export function crearAplicacionGeneracionBackend() {
  const aplicacion = express()
  aplicacion.use(express.json({ limit: "1mb" }))

  aplicacion.get("/api/health", (_solicitud, respuesta) => {
    respuesta.json({ estado: "ok" })
  })

  aplicacion.post("/api/generacion/spring", async (solicitud, respuesta) => {
    if (!esModeloUMLCanonicoEntrada(solicitud.body)) {
      respuesta.status(400).json({ error: "El cuerpo no contiene un ModeloUMLCanonico válido." })
      return
    }
    const temporal = await mkdtemp(join(tmpdir(), "sw1-generacion-"))
    const proyecto = join(temporal, "proyecto")
    try {
      await generarProyectoSpring(solicitud.body, proyecto)
      const zip = await empaquetarBackendGenerado(proyecto)
      respuesta.status(200).type("application/zip").attachment("backend-generado.zip").send(zip)
    } catch (error) {
      if (error instanceof ErrorModeloNoGenerable) {
        respuesta.status(400).json({ error: "Modelo no apto para generación.", errores: error.errores })
      } else {
        console.error(error)
        respuesta.status(500).json({ error: "No se pudo generar el backend." })
      }
    } finally {
      await rm(temporal, { recursive: true, force: true })
    }
  })

  return aplicacion
}
