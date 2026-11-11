import { registrarPasoIA } from "../../../mensajeria_colaborativa/compartido/ProcedenciaIA.js"
import { readFile } from "node:fs/promises"
import type { Express, RequestHandler, Response } from "express"
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
import { ConstruirContextoAsistenteColaborativo } from "./ConstruirContextoAsistenteColaborativo.js"
import { ErrorProveedorIA, type ProveedorModeloLenguaje } from "../../../asistencia_ia/compartido/proveedores/ProveedorModeloLenguaje.js"
import { OrquestarInteraccionIA, clasificarIntencionInteraccion } from "./OrquestarInteraccionIA.js"
import type { PlanificadorLocal } from "../../compartido/PlanificadorLocal.js"
import { EjecutarFlujosAsistente, ErrorFlujoAsistente, detectarComandoFlujo } from "./EjecutarFlujosAsistente.js"
import { RegistroHerramientas, type NombreHerramienta } from "../../herramientas/RegistroHerramientas.js"
import { ConectorEA } from "../../herramientas/ConectorEA.js"
import type { ResultadoOrquestacion } from "./OrquestarInteraccionIA.js"
import { cargarAdjuntoTurno, leerAdjuntoTurno } from "./cargarAdjuntoTurno.js"
import { ErrorProveedorVision, type ProveedorVisionUML } from "../../../asistencia_ia/compartido/proveedores/vision/ProveedorVisionUML.js"
import { ErrorInteroperabilidadXmi } from "../../../interoperabilidad/compartido/crunch_uml/AdaptadorCrunchUML.js"
import { ErrorIntegracionCandidato } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/aplicarCandidatoImagen.js"
import { validarSolicitudInterpretacion } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ValidarSolicitudInterpretacion.js"
import { vistaFlujo } from "../../compartido/FlujoAsistente.js"

export function registrarRutaAsistenteColaborativo(aplicacion: Express, dependencias: {
  proyectos: RepositorioProyectos
  participantes: RepositorioParticipantes
  protector: ProtegerAccesoProyecto
  mensajes: RepositorioMensajes
  eventos: RepositorioEventos
  proveedor: ProveedorAsistenteContextual
  proveedorCU04: ProveedorModeloLenguaje
  publicador: PublicadorMensajesProyecto
  planificadorLocal?: PlanificadorLocal
  proveedorVision: ProveedorVisionUML
}): void {
  const requerir = crearRequerirAccesoProyecto(dependencias.proyectos, dependencias.participantes, dependencias.protector)
  const gestionar = new GestionarMensajesProyecto(dependencias.mensajes, dependencias.proyectos)
  const construir = new ConstruirContextoAsistenteColaborativo(dependencias.proyectos, dependencias.mensajes, dependencias.eventos)
  const flujos = new EjecutarFlujosAsistente(dependencias.mensajes, gestionar, dependencias.publicador, dependencias.proveedorVision)
  const servicio = new OrquestarInteraccionIA(gestionar, dependencias.mensajes, construir, dependencias.proveedor, dependencias.proveedorCU04, dependencias.publicador, dependencias.planificadorLocal, flujos)
  const conector = new ConectorEA(dependencias.mensajes, (a, f) => flujos.finalizar(a, f), (f, datos) => flujos.prepararImportacionXmi(f, datos))
  flujos.conectorEA = conector
  const registro = new RegistroHerramientas(flujos, (a, p) => {
    if (detectarComandoFlujo(p.contenido) || !["EXPLICIT_MODIFICATION", "CONTEXTUAL_MODIFICATION"].includes(clasificarIntencionInteraccion(p.contenido))) throw new ErrorFlujoAsistente(403, "CU04 requiere una instrucción humana explícita de modificación UML.")
    return servicio.ejecutar(a, p)
  })
  servicio.ejecutarHerramienta = async (acceso, pregunta) => {
    const operacion = detectarComandoFlujo(pregunta.contenido)
    const nombres: Partial<Record<string, NombreHerramienta>> = { exportar_xmi: "xmi_export", generar_spring: "spring_generate", automatizar_ea: "ea_import_model", importar_desde_ea: "ea_export_model" }
    if (operacion && nombres[operacion]) {
      const r = await registro.ejecutar(nombres[operacion]!, { acceso, pregunta, expires: Date.now() + 120_000 })
      return r.outcome as ResultadoOrquestacion
    }
    const texto = pregunta.contenido.toLowerCase().trim()
    if (!/^(valida\w*|validate|comprueba|verifica)\b/.test(texto) || /\b(no|not|si|if|pero|but)\b/.test(texto)) return null
    const r = await registrarPasoIA("cu08", () => registro.ejecutar("uml_validate", { acceso, pregunta, expires: Date.now() + 120_000 }))
    const humano = await gestionar.registrarMensajeHumanoIdempotente(acceso, pregunta.contenido, pregunta.requestId)
    if (humano.creado) dependencias.publicador.publicar(humano.mensaje)
    const ia = await gestionar.registrarMensajeIAIdempotente(acceso.projectId, (r.outcome as { resumen: string }).resumen.slice(0, 6500), pregunta.requestId, humano.mensaje.id)
    if (ia.creado) dependencias.publicador.publicar(ia.mensaje)
    return { kind: "tool", mensajeHumano: humano.mensaje, mensajeIA: ia.mensaje, operacion: "validar_uml", baseEditorRevision: pregunta.revisionEditor! }
  }
  const ruta = "/api/proyectos/:id/asistente-colaborativo"
  const controlar = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await handler(req, res, next) } catch (error) {
      if (!responderErrorFlujo(error, res)) res.status(503).json({ error: "No se pudo completar el flujo del asistente. No se informa una aplicación exitosa." })
    }
  }
  aplicacion.post("/api/proyectos/:id/herramientas/contextos", requerir, controlar(async (req, res) => {
    const pregunta = leerPreguntaAsistenteColaborativo(req.body)
    if (!pregunta) throw new ErrorFlujoAsistente(400, "Contexto UML inválido.")
    res.status(201).json({ contextId: registro.crearContexto((req as SolicitudConAccesoProyecto).accesoProyecto, pregunta), expiresInSeconds: 300 })
  }))
  aplicacion.post("/api/proyectos/:id/herramientas/invocar", requerir, controlar(async (req, res) => {
    if (!req.body || Object.keys(req.body).sort().join(",") !== "argumentos,nombre" || typeof req.body.nombre !== "string") throw new ErrorFlujoAsistente(400, "Invocación inválida.")
    res.json(await registro.invocar((req as SolicitudConAccesoProyecto).accesoProyecto, req.body.nombre, req.body.argumentos))
  }))
  const rutaEA = "/api/proyectos/:id/conector-ea"
  const tokenEA = (req: Parameters<RequestHandler>[0]) => String(req.headers["x-nexocase-connector"] ?? "")
  aplicacion.get(`${rutaEA}/estado`, requerir, controlar(async (req, res) => { res.set("Cache-Control", "no-store").json(await conector.estado((req as SolicitudConAccesoProyecto).accesoProyecto)) }))
  aplicacion.get(`${rutaEA}/paquete`, requerir, controlar(async (_req, res) => {
    let zip: Buffer
    try { zip = await readFile(new URL("../../../../../recursos/ea/NexoCASE-Connector.zip", import.meta.url)) }
    catch { throw new ErrorFlujoAsistente(503, "El paquete Windows no está disponible. El administrador debe ejecutar npm run package:ea en backend.") }
    res.attachment("NexoCASE-Connector.zip").type("application/zip").send(zip)
  }))
  aplicacion.post(`${rutaEA}/emparejamiento`, requerir, controlar(async (req, res) => { res.set("Cache-Control", "no-store").status(201).json(conector.crearCodigo((req as SolicitudConAccesoProyecto).accesoProyecto)) }))
  aplicacion.post("/api/conector-ea/canjear", controlar(async (req, res) => { res.set("Cache-Control", "no-store").status(201).json(conector.canjear(req.body)) }))
  const accesoDispositivo = async (req: Parameters<RequestHandler>[0]) => {
    const acceso = conector.accesoToken(tokenEA(req))
    const participante = await dependencias.participantes.obtenerPorId(acceso.participantId)
    if (!participante || participante.proyectoId !== acceso.projectId || !await dependencias.proyectos.obtenerPorId(acceso.projectId)) throw new ErrorFlujoAsistente(403, "El participante/proyecto del conector ya no está disponible.")
    return acceso
  }
  aplicacion.post("/api/conector-ea/siguiente", controlar(async (req, res) => { res.json({ job: await conector.siguiente(await accesoDispositivo(req), tokenEA(req)) }) }))
  aplicacion.post("/api/conector-ea/recibo", controlar(async (req, res) => { res.json(await conector.recibir(await accesoDispositivo(req), tokenEA(req), req.body)) }))
  aplicacion.post("/api/conector-ea/revocar", controlar(async (req, res) => { conector.revocar(await accesoDispositivo(req), tokenEA(req)); res.sendStatus(204) }))
  aplicacion.post(`${rutaEA}/autorizar`, requerir, controlar(async (req, res) => { res.status(201).json(conector.parear((req as SolicitudConAccesoProyecto).accesoProyecto, req.body)) }))
  aplicacion.post(`${rutaEA}/revocar`, requerir, controlar(async (req, res) => {
    const acceso = (req as SolicitudConAccesoProyecto).accesoProyecto
    if (tokenEA(req)) conector.revocar(acceso, tokenEA(req)); else conector.revocarParticipante(acceso)
    res.sendStatus(204)
  }))
  aplicacion.post(`${rutaEA}/siguiente`, requerir, controlar(async (req, res) => { res.json({ job: await conector.siguiente((req as SolicitudConAccesoProyecto).accesoProyecto, tokenEA(req)) }) }))
  aplicacion.post(`${rutaEA}/recibo`, requerir, controlar(async (req, res) => { res.json(await conector.recibir((req as SolicitudConAccesoProyecto).accesoProyecto, tokenEA(req), req.body)) }))
  aplicacion.get(`${ruta}/turnos`, requerir, controlar(async (req, res) => {
    const acceso = (req as SolicitudConAccesoProyecto).accesoProyecto
    if (typeof req.query.requestIds === "string") {
      const ids = req.query.requestIds ? req.query.requestIds.split(",") : []
      if (ids.length > 30 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw new ErrorFlujoAsistente(400, "Los identificadores de turnos no son válidos.")
      const encontrados = await Promise.all(ids.map((id) => dependencias.mensajes.obtenerFlujo(acceso.projectId, id)))
      await Promise.all(encontrados.filter((f) => f?.participantId === acceso.participantId).map((f) => conector.expirar(acceso, f!)))
      res.json(encontrados.filter((f) => f !== null && f.participantId === acceso.participantId).map((f) => vistaFlujo(f!)))
      return
    }
    const pagina = await dependencias.mensajes.listarPorProyecto({ projectId: acceso.projectId, limite: 50 })
    const encontrados = await Promise.all(pagina.items.filter((m) => m.tipoRemitente === "human" && m.participantId === acceso.participantId && m.requestId).map((m) => dependencias.mensajes.obtenerFlujo(acceso.projectId, m.requestId!)))
    await Promise.all(encontrados.filter((f) => f !== null).map((f) => conector.expirar(acceso, f!)))
    res.json(encontrados.filter((f) => f !== null).map(vistaFlujo))
  }))
  aplicacion.get(`${ruta}/turnos/:requestId/archivo`, requerir, controlar(async (req, res) => {
    const flujo = await flujos.obtener((req as SolicitudConAccesoProyecto).accesoProyecto, String(req.params.requestId))
    if (!flujo.archivo || flujo.estado !== "ready") throw new ErrorFlujoAsistente(404, "Este turno no contiene un artefacto descargable.")
    res.attachment(flujo.archivo.nombre).type(flujo.archivo.mime).send(Buffer.from(flujo.archivo.base64, "base64"))
  }))
  aplicacion.post(`${ruta}/turnos/:requestId/confirmar`, requerir, controlar(async (req, res) => {
    const { decision, modeloEjecucion, revisionEditor } = req.body ?? {}
    if ((decision !== "confirmar" && decision !== "rechazar") || !validarSolicitudInterpretacion({ instruccion: "validar", modelo: modeloEjecucion, revision: revisionEditor })) throw new ErrorFlujoAsistente(400, "La confirmación requiere decisión, UML y revisión válidos.")
    res.json(await flujos.confirmar((req as SolicitudConAccesoProyecto).accesoProyecto, String(req.params.requestId), decision, modeloEjecucion, revisionEditor))
  }))
  aplicacion.post(`${ruta}/turnos/:requestId/cancelar`, requerir, controlar(async (req, res) => { res.json(await flujos.cancelarEA((req as SolicitudConAccesoProyecto).accesoProyecto, String(req.params.requestId))) }))
  aplicacion.post(`${ruta}/turnos/:requestId/completar`, requerir, controlar(async (req, res) => {
    const { resultado, modeloEjecucion } = req.body ?? {}
    if (resultado !== "applied" && resultado !== "failed") throw new ErrorFlujoAsistente(400, "Resultado de aplicación inválido.")
    res.json(await flujos.completar((req as SolicitudConAccesoProyecto).accesoProyecto, String(req.params.requestId), resultado, modeloEjecucion))
  }))
  aplicacion.get("/api/proyectos/:id/asistente-colaborativo/proveedor-local", requerir, async (_solicitud, respuesta) => {
    respuesta.json({ modo: dependencias.planificadorLocal ? "hybrid_local" : "legacy",
      estado: dependencias.planificadorLocal ? await dependencias.planificadorLocal.comprobarEstado?.() ?? "sin_diagnostico" : "desactivado" })
  })
  aplicacion.post("/api/proyectos/:id/asistente-colaborativo/interactuar", requerir, cargarAdjuntoTurno, async (solicitud, respuesta) => {
    let entrada: unknown = solicitud.body
    if (solicitud.file) {
      try { entrada = JSON.parse(solicitud.body.turno) } catch { respuesta.status(400).json({ error: "El turno adjunto debe contener JSON válido." }); return }
    }
    const pregunta = leerPreguntaAsistenteColaborativo(entrada)
    if (!pregunta) {
      respuesta.status(400).json({ error: "La pregunta colaborativa no cumple el contrato permitido.", codigo: "SOLICITUD_INVALIDA" })
      return
    }
    try {
      respuesta.status(200).json(await servicio.ejecutar((solicitud as SolicitudConAccesoProyecto).accesoProyecto, pregunta, solicitud.file ? leerAdjuntoTurno(solicitud.file) : undefined))
    } catch (error) {
      if (responderErrorFlujo(error, respuesta)) return
      if (error instanceof ErrorConflictoRequestMensaje) { respuesta.status(409).json({ error: error.message, codigo: "REQUEST_ID_CONFLICTIVO" }); return }
      if (error instanceof ErrorMensajeInvalido) { respuesta.status(400).json({ error: error.message, codigo: "SOLICITUD_INVALIDA" }); return }
      if (error instanceof ErrorAsistenteContextual || error instanceof ErrorProveedorIA) {
        const estado = error.tipo === "limite" ? 429 : error.tipo === "timeout" ? 504 : error.tipo === "respuesta_invalida" ? 502 : 503
        if (error.retryAfterSeconds) respuesta.setHeader("Retry-After", error.retryAfterSeconds)
        respuesta.status(estado).json({
          error: error.tipo === "limite" ? `El asistente alcanzó temporalmente su límite de uso. Espera ${error.retryAfterSeconds ?? 30} segundos y reenvía la misma solicitud.`
            : error.tipo === "respuesta_invalida" ? "La respuesta del asistente no cumplió el contrato esperado."
              : dependencias.planificadorLocal ? "Ollama o el servicio especialista solicitado no están disponibles. No se cambió de proveedor. La pregunta permanece guardada y puede reintentarse."
                : "El asistente colaborativo no está disponible temporalmente. La pregunta permanece guardada y puede reintentarse.",
          codigo: error.tipo === "limite" ? "LIMITE_IA" : error.tipo === "respuesta_invalida" ? "RESPUESTA_IA_INVALIDA" : "IA_NO_DISPONIBLE",
          ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        }); return
      }
      if (error instanceof ErrorPersistenciaMensaje || error instanceof ErrorDatosMensajeCorruptos
        || error instanceof ErrorPersistenciaEvento || error instanceof ErrorDatosEventoCorruptos
        || error instanceof ErrorPersistenciaProyecto || error instanceof ErrorDatosProyectoCorruptos) {
        respuesta.status(503).json({ error: "La memoria colaborativa no está disponible.", codigo: "PERSISTENCIA_NO_DISPONIBLE" }); return
      }
      if (error instanceof ErrorProyectoNoEncontrado) { respuesta.status(404).json({ error: error.message, codigo: "PROYECTO_NO_ENCONTRADO" }); return }
      console.error("[IA][collaborative] internal_error", { requestId: pregunta.requestId, category: "unexpected_exception" })
      respuesta.status(500).json({ error: "No se pudo completar la consulta colaborativa por un error interno.", codigo: "ERROR_INTERNO" })
    }
  })
}

function responderErrorFlujo(error: unknown, respuesta: Response): boolean {
  if (error instanceof ErrorFlujoAsistente) { respuesta.status(error.status).json({ error: error.message }); return true }
  if (error instanceof ErrorIntegracionCandidato) { respuesta.status(422).json({ error: error.message }); return true }
  if (error instanceof ErrorInteroperabilidadXmi) { respuesta.status(error.tipo === "entrada" ? 400 : 503).json({ error: error.tipo === "entrada" ? error.message : "El servicio XMI/Crunch/Python no está disponible; no se completó la operación." }); return true }
  if (error instanceof ErrorProveedorVision) { respuesta.status(error.tipo === "limite" ? 429 : error.tipo === "respuesta_invalida" ? 502 : 503).json({ error: "El análisis de imagen no pudo completarse. Se conserva el turno para revisión; el UML no fue modificado." }); return true }
  return false
}
