import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import express from "express"
import { generarProyectoSpring } from "../casos_uso/cu09_generar_backend_spring_boot/GeneradorSpringBoot.js"
import { ErrorModeloNoGenerable } from "../casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import { empaquetarBackendGenerado } from "../casos_uso/cu10_obtener_backend_generado/EmpaquetadorBackendGenerado.js"
import { esModeloUMLCanonicoEntrada } from "./ValidarEntradaModeloCanonico.js"
import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import { ErrorInteroperabilidadXmi } from "../../interoperabilidad/compartido/crunch_uml/AdaptadorCrunchUML.js"
import { importarModeloXmi } from "../../interoperabilidad/casos_uso/cu06_importar_modelo_xmi/importarModeloXmi.js"
import { exportarModeloXmi } from "../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import type { ProveedorModeloLenguaje } from "../../asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import { ProveedorGroq } from "../../asistencia_ia/compartido/proveedores/groq/ProveedorGroq.js"
import { registrarRutaInterpretacionIA } from "../../asistencia_ia/casos_uso/cu04_modelar_con_ia/registrarRutaInterpretacionIA.js"
import type { ProveedorTranscripcionAudio } from "../../asistencia_ia/compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"
import { ProveedorTranscripcionGroq } from "../../asistencia_ia/compartido/proveedores/transcripcion/groq/ProveedorTranscripcionGroq.js"
import { registrarRutaTranscripcionVoz } from "../../asistencia_ia/casos_uso/cu04_modelar_con_ia/voz/registrarRutaTranscripcionVoz.js"
import type { ProveedorVisionUML } from "../../asistencia_ia/compartido/proveedores/vision/ProveedorVisionUML.js"
import { ProveedorVisionGroq } from "../../asistencia_ia/compartido/proveedores/vision/groq/ProveedorVisionGroq.js"
import { registrarRutaAnalisisImagen } from "../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/registrarRutaAnalisisImagen.js"

export function crearAplicacionGeneracionBackend(dependencias: {
  proveedorIA?: ProveedorModeloLenguaje
  proveedorTranscripcion?: ProveedorTranscripcionAudio
  proveedorVision?: ProveedorVisionUML
} = {}) {
  const aplicacion = express()
  aplicacion.use(express.json({ limit: "1mb" }))
  registrarRutaInterpretacionIA(aplicacion, dependencias.proveedorIA ?? new ProveedorGroq())
  registrarRutaTranscripcionVoz(aplicacion, dependencias.proveedorTranscripcion ?? new ProveedorTranscripcionGroq())
  registrarRutaAnalisisImagen(aplicacion, dependencias.proveedorVision ?? new ProveedorVisionGroq())

  aplicacion.get("/api/health", (_solicitud, respuesta) => {
    respuesta.json({ estado: "ok" })
  })

  aplicacion.post(
    "/api/interoperabilidad/xmi/importar",
    express.text({ type: ["application/xml", "text/xml"], limit: "5mb" }),
    async (solicitud, respuesta) => {
      if (typeof solicitud.body !== "string") {
        respuesta.status(400).json({ error: "Se requiere contenido XMI/XML." })
        return
      }
      try {
        respuesta.status(200).json(await importarModeloXmi(solicitud.body))
      } catch (error) {
        responderErrorXmi(error, respuesta)
      }
    },
  )

  aplicacion.post("/api/interoperabilidad/xmi/exportar", async (solicitud, respuesta) => {
    if (!esModeloUMLCanonicoEntrada(solicitud.body)) {
      respuesta.status(400).json({ error: "El cuerpo no contiene un ModeloUMLCanonico válido." })
      return
    }
    try {
      const xmi = await exportarModeloXmi(solicitud.body as ModeloUMLCanonicoIntercambio)
      respuesta.status(200).attachment("modelo.xmi").type("application/xml").send(xmi)
    } catch (error) {
      responderErrorXmi(error, respuesta)
    }
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

  aplicacion.use((error: unknown, _solicitud: express.Request, respuesta: express.Response, siguiente: express.NextFunction) => {
    if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
      respuesta.status(413).json({ error: "El contenido de la solicitud supera el límite permitido." })
      return
    }
    siguiente(error)
  })

  return aplicacion
}

function responderErrorXmi(error: unknown, respuesta: express.Response): void {
  if (error instanceof ErrorInteroperabilidadXmi) {
    const estado = error.tipo === "configuracion" ? 503 : error.tipo === "entrada" ? 400 : 500
    respuesta.status(estado).json({ error: error.message })
    return
  }
  console.error(error)
  respuesta.status(500).json({ error: "No se pudo completar la operación XMI." })
}
