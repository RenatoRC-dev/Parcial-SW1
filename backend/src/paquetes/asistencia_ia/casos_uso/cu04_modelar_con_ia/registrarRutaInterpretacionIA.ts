import { randomUUID } from "node:crypto"
import type { Express, Response } from "express"
import type { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import type { SolicitudConAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { crearRequerirAccesoProyecto } from "../../../gestion_proyectos/api/requerirAccesoProyecto.js"
import type { RepositorioParticipantes } from "../../../gestion_proyectos/compartido/RepositorioParticipantes.js"
import type { RepositorioProyectos } from "../../../gestion_proyectos/compartido/RepositorioProyectos.js"
import { GestionarMensajesProyecto } from "../../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import type { PublicadorMensajesProyecto } from "../../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"
import type { AccionIAModeladoPersistida, RepositorioMensajes } from "../../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { RegistrarActividadProyecto, type CambioAplicadoIA } from "../../../trazabilidad/casos_uso/RegistrarActividadProyecto.js"
import type { ReferenciaElementoEvento } from "../../../trazabilidad/compartido/EventoProyecto.js"
import type { RepositorioEventos } from "../../../trazabilidad/compartido/RepositorioEventos.js"
import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import { ErrorProveedorIA, type ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import { interpretarInstruccionModelado } from "./interpretarInstruccionModelado.js"
import { validarSolicitudInterpretacion } from "./ValidarSolicitudInterpretacion.js"

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type DependenciasCU04 = {
  proveedor: ProveedorModeloLenguaje; proyectos: RepositorioProyectos; participantes: RepositorioParticipantes; protector: ProtegerAccesoProyecto
  mensajes: RepositorioMensajes; eventos: RepositorioEventos; publicador: PublicadorMensajesProyecto
}

export function registrarRutaInterpretacionIA(aplicacion: Express, dependencias: DependenciasCU04): void {
  const requerir = crearRequerirAccesoProyecto(dependencias.proyectos, dependencias.participantes, dependencias.protector)
  const mensajes = new GestionarMensajesProyecto(dependencias.mensajes, dependencias.proyectos)
  const actividad = new RegistrarActividadProyecto(dependencias.eventos, dependencias.proyectos)

  aplicacion.post("/api/proyectos/:id/modelado-ia/interpretar", requerir, async (solicitud, respuesta) => {
    const entrada = validarSolicitudInterpretacion(solicitud.body)
    const requestId = solicitud.body?.requestId
    if (!entrada || typeof requestId !== "string" || !PATRON_UUID.test(requestId)) {
      respuesta.status(400).json({ error: "La solicitud de modelado con IA es invalida.", codigo: "SOLICITUD_INVALIDA" }); return
    }
    const acceso = (solicitud as SolicitudConAccesoProyecto).accesoProyecto
    try {
      const humano = await mensajes.registrarMensajeHumanoIdempotente(acceso, entrada.instruccion, requestId)
      if (humano.creado) dependencias.publicador.publicar(humano.mensaje)
      const existente = await dependencias.mensajes.obtenerAccionIAPorMensaje(acceso.projectId, humano.mensaje.id)
      if (existente) { respuesta.status(200).json(await salidaExistente(existente, humano.mensaje, mensajes)); return }
      const plan = await interpretarInstruccionModelado(entrada, dependencias.proveedor)
      if (plan.resultado !== "aplicar") {
        const ia = await mensajes.registrarMensajeIAIdempotente(acceso.projectId, plan.mensaje, requestId, humano.mensaje.id)
        if (ia.creado) dependencias.publicador.publicar(ia.mensaje)
        respuesta.status(200).json({ kind: "clarification", mensajeHumano: humano.mensaje, mensajeIA: ia.mensaje, plan }); return
      }
      const accion = await dependencias.mensajes.reservarAccionIA({
        actionId: randomUUID(), projectId: acceso.projectId, requestId, sourceMessageId: humano.mensaje.id,
        requestingParticipantId: acceso.participantId, origen: "direct", normalizedInstruction: entrada.instruccion,
        baseEditorRevision: entrada.revision, modeloBase: structuredClone(entrada.modelo), plan,
        estado: "planned", creadoEn: new Date().toISOString(), completadoEn: null,
      })
      respuesta.status(200).json(salidaAccion(accion, humano.mensaje))
    } catch (error) { responderErrorIA(error, respuesta) }
  })

  aplicacion.post("/api/proyectos/:id/modelado-ia/acciones/:actionId/completar", requerir, async (solicitud, respuesta) => {
    const acceso = (solicitud as SolicitudConAccesoProyecto).accesoProyecto
    const actionId = Array.isArray(solicitud.params.actionId) ? "" : solicitud.params.actionId
    if (!PATRON_UUID.test(actionId)) { respuesta.status(400).json({ error: "La accion IA no es valida.", codigo: "SOLICITUD_INVALIDA" }); return }
    try {
      const accion = await dependencias.mensajes.obtenerAccionIAPorId(acceso.projectId, actionId)
      if (!accion) { respuesta.status(404).json({ error: "Accion IA no encontrada.", codigo: "ACCION_NO_ENCONTRADA" }); return }
      if (accion.requestingParticipantId !== acceso.participantId) { respuesta.status(403).json({ error: "La accion pertenece a otro participante.", codigo: "ACCESO_DENEGADO" }); return }
      if (accion.estado === "applied") { respuesta.status(200).json({ kind: "action_already_applied", actionId }); return }
      const estado = solicitud.body?.resultado
      if (estado !== "applied" && estado !== "failed") { respuesta.status(400).json({ error: "El resultado de ejecucion no es valido.", codigo: "SOLICITUD_INVALIDA" }); return }
      const cambios = estado === "applied" ? validarCambios(accion, solicitud.body?.cambios) : []
      if (estado === "applied" && !cambios) { respuesta.status(400).json({ error: "La evidencia de ejecucion no corresponde al plan.", codigo: "RESULTADO_INVALIDO" }); return }
      const cierre = await dependencias.mensajes.completarAccionIA(acceso.projectId, actionId, acceso.participantId, estado, new Date().toISOString())
      if (!cierre.accion) { respuesta.status(404).json({ error: "Accion IA no encontrada.", codigo: "ACCION_NO_ENCONTRADA" }); return }
      if (!cierre.transicion) { respuesta.status(200).json({ kind: cierre.accion.estado === "applied" ? "action_already_applied" : "action_already_finished", actionId }); return }
      let traceabilityWarning = false
      if (estado === "applied") {
        try { await actividad.registrarIA(acceso, actionId, accion.origen === "collaborative" ? accion.sourceMessageId : null, cambios!) }
        catch { traceabilityWarning = true; console.error("No se pudo registrar toda la trazabilidad secundaria de la accion IA.") }
      }
      const contenido = estado === "applied" ? accion.plan.mensaje : (typeof solicitud.body?.mensaje === "string" && solicitud.body.mensaje.trim() ? solicitud.body.mensaje.trim().slice(0, 500) : "No se pudo aplicar el cambio solicitado.")
      const ia = await mensajes.registrarMensajeIAIdempotente(acceso.projectId, contenido, accion.requestId, accion.sourceMessageId)
      if (ia.creado) dependencias.publicador.publicar(ia.mensaje)
      respuesta.status(200).json({ kind: estado === "applied" ? "action_applied" : "action_failed", actionId, mensajeIA: ia.mensaje, traceabilityWarning })
    } catch (error) { responderErrorIA(error, respuesta) }
  })
}

function salidaAccion(accion: AccionIAModeladoPersistida, mensajeHumano: unknown) {
  return { kind: "action", actionId: accion.actionId, sourceMessageId: accion.origen === "collaborative" ? accion.sourceMessageId : null,
    normalizedInstruction: accion.normalizedInstruction, baseEditorRevision: accion.baseEditorRevision, plan: accion.plan, mensajeHumano }
}
async function salidaExistente(accion: AccionIAModeladoPersistida, mensajeHumano: unknown, mensajes: GestionarMensajesProyecto) {
  if (accion.estado === "planned") return salidaAccion(accion, mensajeHumano)
  return { kind: accion.estado === "applied" ? "action_already_applied" : "action_already_finished", actionId: accion.actionId, mensajeHumano,
    mensajeIA: await mensajes.obtenerPorRequestId(accion.projectId, accion.requestId, "ai") }
}

function referenciaExistente(modelo: ModeloUMLCanonicoIA, id: string): ReferenciaElementoEvento | null {
  const clase = modelo.clases.find((item) => item.id === id); if (clase) return { id, tipo: "class", nombreSnapshot: clase.nombre }
  for (const candidata of modelo.clases) {
    const atributo = candidata.atributos.find((item) => item.id === id); if (atributo) return { id, tipo: "attribute", nombreSnapshot: atributo.nombre }
    const metodo = (candidata.metodos ?? []).find((item) => item.id === id); if (metodo) return { id, tipo: "method", nombreSnapshot: metodo.nombre }
    for (const actual of candidata.metodos ?? []) { const parametro = actual.parametros.find((item) => item.id === id); if (parametro) return { id, tipo: "parameter", nombreSnapshot: parametro.nombre } }
  }
  const relacion = modelo.relaciones.find((item) => item.id === id); return relacion ? { id, tipo: "relationship", nombreSnapshot: relacion.id } : null
}

function expectativa(comando: ComandoModeloUML, modelo: ModeloUMLCanonicoIA): { tipo: CambioAplicadoIA["tipo"]; elementoTipo: ReferenciaElementoEvento["tipo"]; id?: string; nombre?: string } {
  switch (comando.tipo) {
    case "crear_clase": case "crear_clase_asociativa": case "convertir_relacion_en_clase_asociativa": return { tipo: "UML_ELEMENT_CREATED", elementoTipo: "class", nombre: comando.nombre }
    case "agregar_atributo": return { tipo: "UML_ELEMENT_CREATED", elementoTipo: "attribute", nombre: comando.nombre }
    case "crear_metodo": return { tipo: "UML_ELEMENT_CREATED", elementoTipo: "method", nombre: comando.nombre }
    case "agregar_parametro": return { tipo: "UML_ELEMENT_CREATED", elementoTipo: "parameter", nombre: comando.nombre }
    case "crear_relacion": return { tipo: "UML_ELEMENT_CREATED", elementoTipo: "relationship" }
    case "eliminar_clase": return eliminada("class", comando.claseId, modelo)
    case "eliminar_atributo": return eliminada("attribute", comando.atributoId, modelo)
    case "eliminar_metodo": return eliminada("method", comando.metodoId, modelo)
    case "eliminar_parametro": return eliminada("parameter", comando.parametroId, modelo)
    case "eliminar_relacion": return eliminada("relationship", comando.relacionId, modelo)
    case "renombrar_clase": return { tipo: "UML_ELEMENT_UPDATED", elementoTipo: "class", id: comando.claseId, nombre: comando.nuevoNombre }
    case "modificar_atributo": return { tipo: "UML_ELEMENT_UPDATED", elementoTipo: "attribute", id: comando.atributoId }
    case "modificar_metodo": return { tipo: "UML_ELEMENT_UPDATED", elementoTipo: "method", id: comando.metodoId }
    case "modificar_parametro": return { tipo: "UML_ELEMENT_UPDATED", elementoTipo: "parameter", id: comando.parametroId }
    case "cambiar_multiplicidad": return { tipo: "UML_ELEMENT_UPDATED", elementoTipo: "relationship", id: comando.relacionId }
  }
}
function eliminada(tipo: ReferenciaElementoEvento["tipo"], id: string, modelo: ModeloUMLCanonicoIA) {
  return { tipo: "UML_ELEMENT_DELETED" as const, elementoTipo: tipo, id, nombre: referenciaExistente(modelo, id)?.nombreSnapshot }
}

function validarCambios(accion: AccionIAModeladoPersistida, valor: unknown): CambioAplicadoIA[] | null {
  if (!Array.isArray(valor) || valor.length !== accion.plan.comandos.length) return null
  const vistos = new Set<number>(); const salida: CambioAplicadoIA[] = []
  for (const candidato of valor) {
    if (typeof candidato !== "object" || candidato === null) return null
    const item = candidato as Record<string, unknown>; const indice = item.commandIndex
    if (!Number.isInteger(indice) || Number(indice) < 0 || Number(indice) >= accion.plan.comandos.length || vistos.has(Number(indice))) return null
    const elemento = item.elemento as Record<string, unknown>; const esperado = expectativa(accion.plan.comandos[Number(indice)], accion.modeloBase)
    if (item.tipo !== esperado.tipo || !elemento || typeof elemento.id !== "string" || !elemento.id || elemento.id.length > 160
      || elemento.tipo !== esperado.elementoTipo || typeof elemento.nombreSnapshot !== "string" || !elemento.nombreSnapshot || elemento.nombreSnapshot.length > 120
      || (esperado.id && elemento.id !== esperado.id) || (esperado.nombre && elemento.nombreSnapshot !== esperado.nombre)) return null
    vistos.add(Number(indice)); salida.push({ commandIndex: Number(indice), tipo: esperado.tipo, elemento: { id: elemento.id, tipo: esperado.elementoTipo, nombreSnapshot: elemento.nombreSnapshot } })
  }
  return salida.sort((a, b) => a.commandIndex - b.commandIndex)
}

function responderErrorIA(error: unknown, respuesta: Response): void {
  if (error instanceof ErrorProveedorIA) {
    const estado = error.tipo === "limite" ? 429 : error.tipo === "timeout" ? 504 : error.tipo === "respuesta_invalida" ? 502 : 503
    const mensajes = {
      limite: "El servicio de IA está temporalmente limitado. Espera unos segundos e intenta nuevamente. El modelo no fue modificado.",
      timeout: "La IA tardó demasiado en responder. Intenta nuevamente. El modelo no fue modificado.",
      respuesta_invalida: "La IA respondió en un formato que no pudo procesarse. El modelo no fue modificado.",
      configuracion: "No se pudo acceder al servicio de IA por un problema de configuración. El modelo no fue modificado.",
      autenticacion: "No se pudo acceder al servicio de IA por un problema de configuración. El modelo no fue modificado.",
      no_disponible: "El servicio de IA no está disponible en este momento. Intenta nuevamente. El modelo no fue modificado.",
    }
    respuesta.status(estado).json({ error: mensajes[error.tipo], tipo: error.tipo }); return
  }
  console.error("[CU04][AI] internal_error", error)
  respuesta.status(500).json({ error: "No se pudo completar la operacion. El modelo no fue modificado.", tipo: "interno" })
}
