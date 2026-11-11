import { conProcedencia, registrarPasoIA } from "../../../mensajeria_colaborativa/compartido/ProcedenciaIA.js"
import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ContextoAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import type { RepositorioMensajes } from "../../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import { GestionarMensajesProyecto } from "../../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import type { PublicadorMensajesProyecto } from "../../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"
import type { PreguntaAsistenteColaborativo } from "../../compartido/ContratoPreguntaColaborativa.js"
import type { FlujoAsistentePersistido, OperacionFlujo, RespuestaFlujoAsistente, AplicacionFlujoAsistente } from "../../compartido/FlujoAsistente.js"
import { vistaFlujo } from "../../compartido/FlujoAsistente.js"
import { analizarImagenUML } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/analizarImagenUML.js"
import { ErrorProveedorVision, type ProveedorVisionUML } from "../../../asistencia_ia/compartido/proveedores/vision/ProveedorVisionUML.js"
import { aplicarCandidatoImagen, evaluarAtributoCandidato } from "../../../asistencia_ia/casos_uso/cu05_modelar_desde_imagen/aplicarCandidatoImagen.js"
import { importarModeloXmi } from "../../../interoperabilidad/casos_uso/cu06_importar_modelo_xmi/importarModeloXmi.js"
import { exportarModeloXmi } from "../../../interoperabilidad/casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"
import { evaluarAptitudGeneracionSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import { generarProyectoSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/GeneradorSpringBoot.js"
import { empaquetarBackendGenerado } from "../../../generacion_backend/casos_uso/cu10_obtener_backend_generado/EmpaquetadorBackendGenerado.js"
import { validarSolicitudInterpretacion } from "../../../asistencia_ia/casos_uso/cu04_modelar_con_ia/ValidarSolicitudInterpretacion.js"
import { ErrorInteroperabilidadXmi } from "../../../interoperabilidad/compartido/crunch_uml/AdaptadorCrunchUML.js"
import type { ConectorEA } from "../../herramientas/ConectorEA.js"

export interface AdjuntoTurno { tipo: "imagen" | "xmi"; nombre: string; mime: string; datos: Buffer }
export class ErrorFlujoAsistente extends Error { constructor(readonly status: number, mensaje: string) { super(mensaje) } }
export const huellaModelo = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor) ?? "undefined").digest("hex")

export function detectarComandoFlujo(texto: string): OperacionFlujo | null {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/^[¿?\s]+/, "").replace(/^por favor[, ]+|^please\s+/, "").replace(/^(puedes|podrias|can you|could you)\s+/, "").replace(/^(quiero|necesito|quisiera) (que )?|^i (want|need) to /, "")
  if (/\b(no|not|don't|si|if|pero|but)\b/.test(t) || /^(como|how|que|what)\b/.test(t)) return null
  if (/\b(enterprise architect|ea)\b/.test(t)) {
    if (/^(importa\w*|import|trae\w*|bring|exporta\w*|export)\b/.test(t)
      && (/\b(desde|from|de) (?:el |the )?(?:modelo (?:seleccionado )?de )?(enterprise architect|ea)\b/.test(t) || /\b(into|to|a) nexocase\b/.test(t))) return "importar_desde_ea"
    if (/^(exporta\w*|export|lleva\w*|importa\w*)\b/.test(t)) return "automatizar_ea"
  }
  if (/^(exporta\w*|export)\b/.test(t) && /\bxmi\b/.test(t)) return "exportar_xmi"
  if (/^(genera\w*|generate|crea|create)\b/.test(t) && /\b(spring|backend)\b/.test(t)) return "generar_spring"
  return null
}

export class EjecutarFlujosAsistente {
  conectorEA?: ConectorEA
  constructor(private readonly repo: RepositorioMensajes, private readonly mensajes: GestionarMensajesProyecto,
    private readonly publicador: PublicadorMensajesProyecto, private readonly vision: ProveedorVisionUML) {}

  async ejecutar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo, operacion: OperacionFlujo, adjunto?: AdjuntoTurno): Promise<RespuestaFlujoAsistente> {
    return conProcedencia(pregunta.requestId, () => this.ejecutarUnaVez(acceso, pregunta, operacion, adjunto))
  }

  private async ejecutarUnaVez(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo, operacion: OperacionFlujo, adjunto?: AdjuntoTurno): Promise<RespuestaFlujoAsistente> {
    if (!pregunta.modeloEjecucion || pregunta.revisionEditor === undefined) throw new ErrorFlujoAsistente(400, "Se requiere la vista actual y revisión del UML.")
    const contenido = `${pregunta.contenido}${adjunto ? `\n📎 ${adjunto.nombre}` : ""}`
    const humano = await this.mensajes.registrarMensajeHumanoIdempotente(acceso, contenido, pregunta.requestId)
    if (humano.creado) this.publicador.publicar(humano.mensaje)
    const huella = huellaModelo([pregunta.contenido, pregunta.modeloEjecucion, pregunta.revisionEditor, operacion,
      adjunto ? [adjunto.nombre, adjunto.mime, createHash("sha256").update(adjunto.datos).digest("hex")] : null])
    const existente = await this.repo.obtenerFlujo(acceso.projectId, pregunta.requestId)
    if (existente) {
      if (existente.huella !== huella) throw new ErrorFlujoAsistente(409, "La solicitud ya fue usada con otro archivo, modelo o revisión.")
      return this.respuesta(acceso, existente)
    }
    // Desconexión previa a la reserva: el mismo requestId puede recuperarse
    // después de conectar, sin un trabajo fallido irreversible ni una escritura EA.
    if (["automatizar_ea", "importar_desde_ea"].includes(operacion)) {
      if (!this.conectorEA) throw new ErrorFlujoAsistente(503, "Configura Enterprise Architect en este asistente.")
      this.conectorEA.disponible(acceso)
    }
    const flujo: FlujoAsistentePersistido = { projectId: acceso.projectId, participantId: acceso.participantId, requestId: pregunta.requestId,
      sourceMessageId: humano.mensaje.id, completionRequestId: randomUUID(), huella, modeloBase: structuredClone(pregunta.modeloEjecucion),
      revision: pregunta.revisionEditor, operacion, estado: "processing", resumen: "Procesando el turno solicitado.", advertencias: [] }
    if (!await this.repo.reservarFlujo(flujo)) {
      const reservado = await this.repo.obtenerFlujo(acceso.projectId, pregunta.requestId)
      if (!reservado || reservado.huella !== huella) throw new ErrorFlujoAsistente(409, "La solicitud está reservada por otra operación.")
      return this.respuesta(acceso, reservado)
    }
    try {
      if (operacion === "importar_desde_ea") {
        if (detectarComandoFlujo(pregunta.contenido) !== operacion) throw new ErrorFlujoAsistente(403, "Autoriza importar desde Enterprise Architect a NexoCASE.")
        if (!this.conectorEA) throw new ErrorFlujoAsistente(503, "Configura Enterprise Architect en este asistente.")
        flujo.ea = { ...this.conectorEA.preparar(acceso, Buffer.alloc(0)), direction: "ea_to_nexo" }
        flujo.estado = "queued"
        flujo.resumen = "Esperando al conector Windows para exportar el paquete EA aprobado localmente. CU06 prepara una vista previa; no se reemplaza el UML sin confirmacion."
      } else if (operacion === "analizar_imagen") {
        if (adjunto?.tipo !== "imagen") throw new ErrorFlujoAsistente(400, "Adjunta una imagen PNG o JPEG.")
        const resultado = await analizarImagenUML({ datos: adjunto.datos, mimeType: adjunto.mime as "image/png" | "image/jpeg", nombreArchivo: adjunto.nombre, instruccion: pregunta.contenido }, { analizarImagen: (imagen) => registrarPasoIA("groq_cu05", () => this.vision.analizarImagen(imagen)) })
        flujo.resumen = resultado.mensaje
        if (resultado.resultado === "candidato") {
          flujo.candidato = resultado.candidato
          flujo.advertencias = [...resultado.candidato.advertencias, ...resultado.candidato.clases.flatMap((clase) => clase.atributos.flatMap((atributo) => {
            const evaluacion = evaluarAtributoCandidato(atributo)
            return evaluacion.importable ? [] : [`${clase.nombre}.${atributo.nombre}: ${evaluacion.motivo === "tipo_no_visible" ? "tipo no visible" : "tipo no soportado"}; este atributo no se importará.`]
          }))]
          flujo.clases = resultado.candidato.clases.map((c) => c.nombre)
          flujo.estado = "review"; flujo.resumen += " Revisa el candidato y confirma Agregar al modelo. Todavía no se modificó el UML."
        } else { flujo.estado = "ready" }
      } else if (operacion === "importar_xmi") {
        if (adjunto?.tipo !== "xmi") throw new ErrorFlujoAsistente(400, "Adjunta un archivo XMI/XML.")
        await this.prepararImportacionXmi(flujo, adjunto.datos)
      } else {
        let datos: Buffer
        if (operacion === "exportar_xmi" || operacion === "automatizar_ea") {
          if (operacion === "automatizar_ea") {
            if (detectarComandoFlujo(pregunta.contenido) !== "automatizar_ea") throw new ErrorFlujoAsistente(400, "Autoriza explícitamente exportar el UML a Enterprise Architect.")
            if (!this.conectorEA) throw new ErrorFlujoAsistente(503, "Instala y autoriza el conector Windows: desktop/ea/README.md. No se importó nada en EA.")
            this.conectorEA.disponible(acceso)
            if (!validarModelo(flujo.modeloBase).valido) throw new ErrorFlujoAsistente(422, "CU08 rechazó el UML; corrige la validación antes de exportar a EA.")
          }
          datos = await registrarPasoIA("cu07", () => exportarModeloXmi(flujo.modeloBase))
          flujo.archivo = { nombre: "modelo.xmi", mime: "application/xml", base64: "" }
          flujo.advertencias = ["Perfil XMI compatible de NexoCASE; no garantiza interoperabilidad universal con Enterprise Architect ni sincroniza con él.",
            ...(flujo.modeloBase.clases.some((c) => (c.metodos?.length ?? 0) > 0) ? ["Las operaciones UML no forman parte del perfil XMI soportado."] : [])]
          flujo.resumen = "XMI generado por CU07. Descarga el archivo en esta conversación. No se importó ni sincronizó con Enterprise Architect."
        } else {
          const aptitud = evaluarAptitudGeneracionSpring(flujo.modeloBase, validarModelo(flujo.modeloBase))
          if (!aptitud.apto) throw new ErrorFlujoAsistente(422, `No se puede generar Spring: ${aptitud.motivos.join(" ")}`)
          const temporal = await mkdtemp(join(tmpdir(), "nexocase-chat-spring-"))
          try { datos = await registrarPasoIA("spring", async () => { await generarProyectoSpring(flujo.modeloBase, join(temporal, "proyecto")); return empaquetarBackendGenerado(join(temporal, "proyecto")) }) }
          finally { await rm(temporal, { recursive: true, force: true }) }
          flujo.archivo = { nombre: "backend-generado.zip", mime: "application/zip", base64: "" }
          flujo.advertencias = ["La generación se limita al perfil Spring/JPA soportado; no implementa reglas de negocio ni mapeos adicionales.", ...aptitud.advertencias.map((a) => a.relacion)]
          flujo.resumen = "Proyecto Spring Boot generado y empaquetado. Descarga el ZIP en esta conversación."
        }
        if (datos.length > 5 * 1024 * 1024) throw new ErrorFlujoAsistente(413, "El artefacto excede el límite de 5 MB del chat.")
        flujo.archivo.base64 = datos.toString("base64"); flujo.estado = "ready"
        if (operacion === "automatizar_ea") {
          flujo.ea = this.conectorEA!.preparar(acceso, datos)
          flujo.estado = "queued"
          flujo.resumen = "XMI real generado por CU07. En espera del conector Windows para importar en un paquete EA nuevo y verificar mediante COM; aún no se confirmó la importación."
          flujo.advertencias = ["Los GUID se regeneran para aislar cada importación; no hay sincronización continua ni sobrescritura.", "Los diagramas y su disposición visual no se importan (ImportDiagrams=0). La versión canónica del modelo no forma parte de la verificación EA. Métodos, abstracción y relaciones distintas de asociación son rechazados por el perfil CU07 actual.", ...(flujo.modeloBase.clases.some((c) => c.tipoClase === "asociativa") ? ["El marcador de clase asociativa es específico de NexoCASE; no se verifica su conservación en Enterprise Architect. Puede importarse como clase normal."] : [])]
        }
      }
    } catch (error) {
      flujo.estado = "failed"; flujo.resumen = error instanceof ErrorFlujoAsistente ? error.message : "El servicio solicitado no pudo completar el turno. No se modificó el UML ni se produjo un artefacto descargable."
      await this.repo.actualizarFlujo(flujo, "processing")
      await this.respuesta(acceso, flujo)
      if (error instanceof ErrorFlujoAsistente || error instanceof ErrorInteroperabilidadXmi || error instanceof ErrorProveedorVision) throw error
      throw new ErrorFlujoAsistente(503, flujo.resumen)
    }
    if (!await this.repo.actualizarFlujo(flujo, "processing")) throw new ErrorFlujoAsistente(409, "El turno cambió durante su procesamiento.")
    return this.respuesta(acceso, flujo)
  }

  async obtener(acceso: ContextoAccesoProyecto, requestId: string): Promise<FlujoAsistentePersistido> {
    const flujo = await this.repo.obtenerFlujo(acceso.projectId, requestId)
    if (!flujo) throw new ErrorFlujoAsistente(404, "Turno no encontrado.")
    if (flujo.participantId !== acceso.participantId) throw new ErrorFlujoAsistente(403, "Este turno pertenece a otro participante.")
    await this.conectorEA?.expirar(acceso, flujo)
    return flujo
  }

  async prepararImportacionXmi(flujo: FlujoAsistentePersistido, datos: Buffer): Promise<void> {
    if (!datos.length || datos.length > 5 * 1024 * 1024) throw new ErrorFlujoAsistente(413, "XMI vacío o mayor a 5 MB.")
    const importado = await registrarPasoIA("cu06", () => importarModeloXmi(datos.toString("utf8")))
    if (JSON.stringify(importado.modelo).length > 800_000 || !validarSolicitudInterpretacion({ instruccion: "validar", modelo: importado.modelo, revision: flujo.revision })) throw new ErrorFlujoAsistente(422, "El modelo importado excede el contrato admitido por el editor del chat.")
    const validacion = validarModelo(importado.modelo)
    if (!validacion.valido) throw new ErrorFlujoAsistente(422, "CU08 rechazó el modelo importado; no se preparó un reemplazo.")
    flujo.modeloResultado = importado.modelo
    flujo.advertencias = importado.advertencias.map((a) => a.mensaje)
    flujo.clases = importado.modelo.clases.map((c) => c.nombre)
    flujo.resumenModelo = { clases: importado.modelo.clases.length, atributos: importado.modelo.clases.reduce((n, c) => n + c.atributos.length, 0), relaciones: importado.modelo.relaciones.length }
    flujo.estado = "review"
    flujo.resumen = `Importación preparada: ${flujo.resumenModelo.clases} clases, ${flujo.resumenModelo.atributos} atributos y ${flujo.resumenModelo.relaciones} relaciones. Confirmar REEMPLAZARÁ las ${flujo.modeloBase.clases.length} clases y ${flujo.modeloBase.relaciones.length} relaciones actuales de este proyecto (revisión ${flujo.revision}). No se guardará automáticamente.`
  }

  async confirmar(acceso: ContextoAccesoProyecto, requestId: string, decision: "confirmar" | "rechazar", modelo: PreguntaAsistenteColaborativo["modeloEjecucion"], revision: number): Promise<AplicacionFlujoAsistente> {
    const flujo = await this.obtener(acceso, requestId)
    if (["applied", "cancelled", "failed"].includes(flujo.estado)) return { flujo: vistaFlujo(flujo) }
    if (flujo.estado !== "review" && flujo.estado !== "issued") throw new ErrorFlujoAsistente(409, "El turno no espera confirmación.")
    if (decision === "rechazar" && flujo.estado === "review") {
      flujo.estado = "cancelled"; flujo.resumen = "Propuesta descartada por su solicitante. El UML no fue modificado."
      if (!await this.repo.actualizarFlujo(flujo, "review")) throw new ErrorFlujoAsistente(409, "La propuesta ya cambió.")
      await this.finalizar(acceso, flujo); return { flujo: vistaFlujo(flujo) }
    }
    if (decision !== "confirmar") throw new ErrorFlujoAsistente(409, "La aplicación ya fue autorizada; verifica su resultado antes de descartarla.")
    if (revision !== flujo.revision || huellaModelo(modelo) !== huellaModelo(flujo.modeloBase)) throw new ErrorFlujoAsistente(409, "El UML cambió desde la propuesta. Vuelve a analizar/importar sobre la revisión actual; no se aplicó nada.")
    if (flujo.estado === "review") {
      if (flujo.operacion === "analizar_imagen" && flujo.candidato) flujo.modeloResultado = aplicarCandidatoImagen(flujo.modeloBase, flujo.candidato)
      if (!flujo.modeloResultado) throw new ErrorFlujoAsistente(400, "La propuesta no contiene un modelo válido.")
      const validacion = validarModelo(flujo.modeloResultado)
      if (!validacion.valido) throw new ErrorFlujoAsistente(422, validacion.diagnosticos.filter((d) => d.severidad === "error").map((d) => d.mensaje).join(" "))
      flujo.estado = "issued"
      if (!await this.repo.actualizarFlujo(flujo, "review")) throw new ErrorFlujoAsistente(409, "La propuesta ya cambió.")
    }
    return { flujo: vistaFlujo(flujo), modeloResultado: flujo.modeloResultado }
  }

  async cancelarEA(acceso: ContextoAccesoProyecto, requestId: string): Promise<RespuestaFlujoAsistente> {
    const flujo = await this.obtener(acceso, requestId)
    if (flujo.estado === "cancelled") return this.respuesta(acceso, flujo)
    if (!["automatizar_ea", "importar_desde_ea"].includes(flujo.operacion) || flujo.estado !== "queued") throw new ErrorFlujoAsistente(409, "El trabajo ya fue recibido o finalizado. No se puede prometer cancelación de una operación COM en curso.")
    flujo.estado = "cancelled"; flujo.resumen = "Trabajo EA cancelado antes de su entrega al conector. No se inició ninguna operación externa."
    if (!await this.repo.actualizarFlujo(flujo, "queued")) throw new ErrorFlujoAsistente(409, "El trabajo ya cambió.")
    await this.finalizar(acceso, flujo)
    return this.respuesta(acceso, flujo)
  }

  async completar(acceso: ContextoAccesoProyecto, requestId: string, resultado: "applied" | "failed", modelo?: PreguntaAsistenteColaborativo["modeloEjecucion"]): Promise<RespuestaFlujoAsistente> {
    const flujo = await this.obtener(acceso, requestId)
    if (flujo.estado === "issued") {
      if (resultado === "applied" && huellaModelo(modelo) !== huellaModelo(flujo.modeloResultado)) throw new ErrorFlujoAsistente(400, "El resultado aplicado no corresponde a la propuesta validada.")
      flujo.estado = resultado
      flujo.resumen = resultado === "applied" ? "Propuesta aplicada por su solicitante al editor colaborativo. Los cambios están sin guardar hasta Guardar explícito." : "La propuesta no pudo aplicarse al UML vivo. No se informa éxito."
      if (!await this.repo.actualizarFlujo(flujo, "issued")) throw new ErrorFlujoAsistente(409, "La aplicación ya cambió.")
    } else if (flujo.estado !== "applied" && flujo.estado !== "failed") throw new ErrorFlujoAsistente(409, "La propuesta no fue confirmada.")
    await this.finalizar(acceso, flujo)
    return this.respuesta(acceso, flujo)
  }

  async finalizar(acceso: ContextoAccesoProyecto, flujo: FlujoAsistentePersistido): Promise<void> {
    const original = await this.mensajes.obtenerPorRequestId(acceso.projectId, flujo.requestId, "ai")
    const ia = await this.mensajes.registrarMensajeIAIdempotente(acceso.projectId, flujo.resumen, flujo.completionRequestId, flujo.sourceMessageId, [], null, flujo.procedencia ?? original?.procedencia)
    if (ia.creado) this.publicador.publicar(ia.mensaje)
  }
  async respuesta(acceso: ContextoAccesoProyecto, flujo: FlujoAsistentePersistido): Promise<RespuestaFlujoAsistente> {
    if (flujo.participantId !== acceso.participantId) throw new ErrorFlujoAsistente(403, "El turno pertenece a otro participante.")
    if (flujo.estado === "processing") throw new ErrorFlujoAsistente(409, "La solicitud sigue en curso. Recupera el mismo turno; no vuelvas a ejecutarlo.")
    const humano = await this.repo.obtenerPorId(acceso.projectId, flujo.sourceMessageId)
    if (!humano) throw new ErrorFlujoAsistente(404, "Mensaje fuente no encontrado.")
    const ia = await this.mensajes.registrarMensajeIAIdempotente(acceso.projectId, flujo.resumen.slice(0, 7500), flujo.requestId, flujo.sourceMessageId)
    if (ia.creado) this.publicador.publicar(ia.mensaje)
    const cierre = await this.mensajes.obtenerPorRequestId(acceso.projectId, flujo.completionRequestId, "ai")
    return { kind: "workflow", mensajeHumano: humano, mensajeIA: cierre ?? ia.mensaje, flujo: vistaFlujo(flujo) }
  }
}
