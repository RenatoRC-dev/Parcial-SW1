import { crearServidorCase } from "../../../ServidorCase.js"
import { ProveedorDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorDeterministaE2E.js"
import { ProveedorTranscripcionDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorTranscripcionDeterministaE2E.js"
import { ProveedorVisionDeterministaE2E } from "../../asistencia_ia/pruebas/ProveedorVisionDeterministaE2E.js"
import { resolve } from "node:path"
import { cargarConfiguracionEntorno } from "../../../configuracion/cargarConfiguracionEntorno.js"
import { ConexionMongo, obtenerConfiguracionMongo } from "../../../infraestructura/mongodb/ConexionMongo.js"
import { crearIndicesMongo } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import { RepositorioProyectosMongo } from "../../gestion_proyectos/infraestructura/RepositorioProyectosMongo.js"
import { RepositorioProyectosArchivos } from "../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import type { RepositorioProyectos } from "../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { RepositorioParticipantes } from "../../gestion_proyectos/compartido/RepositorioParticipantes.js"
import { RepositorioParticipantesMongo } from "../../gestion_proyectos/infraestructura/RepositorioParticipantesMongo.js"
import { ProtegerAccesoProyecto, obtenerPepperAccesoProyecto } from "../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioParticipantesMemoria } from "../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import type { RepositorioEventos } from "../../trazabilidad/compartido/RepositorioEventos.js"
import type { RepositorioMensajes } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { RepositorioEventosMongo } from "../../trazabilidad/infraestructura/RepositorioEventosMongo.js"
import { RepositorioMensajesMongo } from "../../mensajeria_colaborativa/infraestructura/RepositorioMensajesMongo.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import { ProveedorAsistenteContextualDeterministaE2E } from "../../asistencia_contextual/pruebas/ProveedorAsistenteContextualDeterministaE2E.js"

async function iniciar(): Promise<void> {
  cargarConfiguracionEntorno()

  const usarDatosE2E = process.argv.includes("--datos-proyectos-e2e")
  if (usarDatosE2E) {
    process.env.SW1_PROJECTS_DIR = resolve(process.cwd(), "generated-test-output", "e2e-projects")
  }

  const puerto = Number(process.env.PORT || 3001)
  const host = process.env.HOST?.trim() || "127.0.0.1"
  const proveedorDeterminista = process.argv.includes("--proveedor-ia-determinista")
  const proveedorIA = proveedorDeterminista ? new ProveedorDeterministaE2E() : undefined
  const proveedorTranscripcion = proveedorDeterminista ? new ProveedorTranscripcionDeterministaE2E() : undefined
  const proveedorVision = proveedorDeterminista ? new ProveedorVisionDeterministaE2E() : undefined
  const proveedorAsistenteContextual = proveedorDeterminista ? new ProveedorAsistenteContextualDeterministaE2E() : undefined

  let conexionMongo: ConexionMongo | null = null
  let repositorioProyectos: RepositorioProyectos
  let repositorioParticipantes: RepositorioParticipantes
  let protectorAcceso: ProtegerAccesoProyecto
  let repositorioEventos: RepositorioEventos
  let repositorioMensajes: RepositorioMensajes
  try {
    if (usarDatosE2E) {
      // Infraestructura explícita de pruebas: conserva archivos sin omitir la autorización F4-B.
      repositorioProyectos = new RepositorioProyectosArchivos()
      repositorioParticipantes = new RepositorioParticipantesMemoria()
      protectorAcceso = new ProtegerAccesoProyecto("pepper-exclusivo-del-modo-e2e")
      repositorioEventos = new RepositorioEventosMemoria()
      repositorioMensajes = new RepositorioMensajesMemoria()
    } else {
      protectorAcceso = new ProtegerAccesoProyecto(obtenerPepperAccesoProyecto())
      conexionMongo = new ConexionMongo(obtenerConfiguracionMongo(), { serverSelectionTimeoutMS: 5_000 })
      const baseDatos = await conexionMongo.conectar()
      await crearIndicesMongo(baseDatos)
      repositorioProyectos = new RepositorioProyectosMongo(baseDatos)
      repositorioParticipantes = new RepositorioParticipantesMongo(baseDatos)
      repositorioEventos = new RepositorioEventosMongo(baseDatos)
      repositorioMensajes = new RepositorioMensajesMongo(baseDatos)
    }
  } catch (error) {
    await conexionMongo?.cerrar().catch(() => undefined)
    throw error
  }

  const { servidor, relayColaboracion, canalAplicacion } = crearServidorCase({
    proveedorIA,
    proveedorTranscripcion,
    proveedorVision,
    proveedorAsistenteContextual,
    accesoProyectos: {
      proyectos: repositorioProyectos,
      participantes: repositorioParticipantes,
      protector: protectorAcceso,
      eventos: repositorioEventos,
      mensajes: repositorioMensajes,
    },
  })

  let cerrando = false
  const cerrar = async (senal: NodeJS.Signals) => {
    if (cerrando) return
    cerrando = true
    console.info(`Cerrando servidor por ${senal}.`)
    await relayColaboracion.cerrar().catch(() => undefined)
    await canalAplicacion.cerrar().catch(() => undefined)
    if (servidor.listening) {
      await new Promise<void>((resolver) => servidor.close(() => resolver()))
    }
    await conexionMongo?.cerrar().catch(() => undefined)
  }

  for (const senal of ["SIGINT", "SIGTERM"] as const) {
    process.once(senal, () => { void cerrar(senal).finally(() => { process.exitCode = 0 }) })
  }

  servidor.on("error", (error) => {
    console.error("No se pudo iniciar el servidor CASE.", error)
    void cerrar("SIGTERM").finally(() => { process.exitCode = 1 })
  })

  servidor.listen(puerto, host, () => {
    console.log(`Servidor CASE disponible en http://${host}:${puerto}`)
  })
}

try {
  await iniciar()
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo inicializar la persistencia MongoDB.")
  process.exitCode = 1
}
