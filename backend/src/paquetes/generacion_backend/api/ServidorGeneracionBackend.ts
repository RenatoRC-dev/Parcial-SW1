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
import { registrarRutasProyectos, type DependenciasRutasProyectos } from "../../gestion_proyectos/api/registrarRutasProyectos.js"
import type { ProveedorAsistenteContextual } from "../../asistencia_contextual/compartido/ProveedorAsistenteContextual.js"
import { ProveedorAsistenteContextualGroq } from "../../asistencia_contextual/compartido/proveedores/groq/ProveedorAsistenteContextualGroq.js"
import { registrarRutaAsistenteColaborativo } from "../../asistencia_contextual/casos_uso/cu12_asistir_usuario/registrarRutaAsistenteColaborativo.js"
import { obtenerOrigenesFrontendPermitidos } from "../../../configuracion/origenesFrontendPermitidos.js"
import { PUBLICADOR_MENSAJES_NULO, type PublicadorMensajesProyecto } from "../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"
import type { PlanificadorLocal } from "../../asistencia_contextual/compartido/PlanificadorLocal.js"
import { leerConfiguracionOllama, PlanificadorOllama } from "../../asistencia_contextual/compartido/proveedores/ollama/PlanificadorOllama.js"

export function crearAplicacionGeneracionBackend(dependencias: {
  proveedorIA?: ProveedorModeloLenguaje
  proveedorTranscripcion?: ProveedorTranscripcionAudio
  proveedorVision?: ProveedorVisionUML
  proveedorAsistenteContextual?: ProveedorAsistenteContextual
  accesoProyectos?: DependenciasRutasProyectos
  publicadorMensajes?: PublicadorMensajesProyecto
  planificadorLocal?: PlanificadorLocal
} = {}) {
  const aplicacion = express()
  const configuracionOllama = dependencias.planificadorLocal ? null : leerConfiguracionOllama()
  const planificadorLocal = dependencias.planificadorLocal ?? (configuracionOllama ? new PlanificadorOllama(configuracionOllama) : undefined)
  const origenesPermitidos = obtenerOrigenesFrontendPermitidos()
  aplicacion.use((solicitud, respuesta, siguiente) => {
    const origen = solicitud.headers.origin
    if (origen && origenesPermitidos.has(origen)) {
      respuesta.setHeader("Access-Control-Allow-Origin", origen)
      respuesta.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
      respuesta.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
      respuesta.setHeader("Vary", "Origin")
    }
    if (solicitud.method === "OPTIONS") {
      respuesta.sendStatus(origen && origenesPermitidos.has(origen) ? 204 : 403)
      return
    }
    siguiente()
  })
  aplicacion.use(express.json({ limit: "1mb" }))
  registrarRutaTranscripcionVoz(aplicacion, dependencias.proveedorTranscripcion ?? new ProveedorTranscripcionGroq())
  registrarRutaAnalisisImagen(aplicacion, dependencias.proveedorVision ?? new ProveedorVisionGroq())
  if (dependencias.accesoProyectos) {
    registrarRutasProyectos(aplicacion, dependencias.accesoProyectos)
    if (dependencias.accesoProyectos.eventos && dependencias.accesoProyectos.mensajes) {
      const proveedorCU04 = dependencias.proveedorIA ?? new ProveedorGroq()
      registrarRutaInterpretacionIA(aplicacion, {
        proveedor: proveedorCU04,
        proyectos: dependencias.accesoProyectos.proyectos, participantes: dependencias.accesoProyectos.participantes,
        protector: dependencias.accesoProyectos.protector, eventos: dependencias.accesoProyectos.eventos,
        mensajes: dependencias.accesoProyectos.mensajes, publicador: dependencias.publicadorMensajes ?? PUBLICADOR_MENSAJES_NULO,
      })
      registrarRutaAsistenteColaborativo(aplicacion, {
      proyectos: dependencias.accesoProyectos.proyectos,
      participantes: dependencias.accesoProyectos.participantes,
      protector: dependencias.accesoProyectos.protector,
      eventos: dependencias.accesoProyectos.eventos,
      mensajes: dependencias.accesoProyectos.mensajes,
      proveedor: dependencias.proveedorAsistenteContextual ?? new ProveedorAsistenteContextualGroq(),
      proveedorCU04,
      planificadorLocal,
      proveedorVision: dependencias.proveedorVision ?? new ProveedorVisionGroq(),
      publicador: dependencias.publicadorMensajes ?? PUBLICADOR_MENSAJES_NULO,
      })
    }
  }

  aplicacion.get("/api/health", (_solicitud, respuesta) => {
    respuesta.json({ estado: "ok" })
  })
  aplicacion.get("/health", (_solicitud, respuesta) => {
    respuesta.json({ status: "ok" })
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
