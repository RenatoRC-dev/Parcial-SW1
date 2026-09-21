import { cargarConfiguracionEntorno } from "../../../configuracion/cargarConfiguracionEntorno.js"
import { asistirUsuario } from "../casos_uso/cu12_asistir_usuario/asistirUsuario.js"
import type { ContextoAsistente, MensajeConversacionContextual, SolicitudAsistenteContextual } from "../compartido/ContratoAsistenteContextual.js"
import { ACCIONES_ASISTENTE_CONTEXTUAL } from "../compartido/ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../compartido/ProveedorAsistenteContextual.js"
import { ProveedorAsistenteContextualGroq } from "../compartido/proveedores/groq/ProveedorAsistenteContextualGroq.js"

cargarConfiguracionEntorno()

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function contextoBase(clases: Array<Record<string, unknown>>, relaciones: Array<Record<string, unknown>> = []): ContextoAsistente {
  const elementosRelevantes: ContextoAsistente["elementosRelevantes"] = [
    ...clases.map((clase) => ({ id: String(clase.id), tipo: "clase" as const, nombre: String(clase.nombre) })),
    ...relaciones.map((relacion) => ({ id: String(relacion.id), tipo: "relacion" as const, nombre: String(relacion.id) })),
  ].slice(0, 8)
  return {
    proyecto: { id: "prueba-contextual", nombre: "Prueba Contextual" }, area: "modelado_uml", idioma: "es", revisionModelo: 1,
    modeloActual: { id: "modelo-contextual", nombre: "Prueba Contextual", version: "1", clases, relaciones, truncado: false },
    elementoSeleccionado: null, elementosRelevantes, resumenModelo: { clases: clases.length, relaciones: relaciones.length },
    estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] },
    generacion: { estado: "apto", bloqueos: [], advertencias: [] }, cambiosSinGuardar: false, candidatoImagenPendiente: false,
    accionesDisponibles: ["NINGUNA", ...(elementosRelevantes.length > 0 ? ["ENFOCAR_ELEMENTO" as const] : []), "IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI"],
  }
}

if (!process.env.GROQ_API_KEY) {
  console.error("Prerequisito ausente: configure GROQ_API_KEY en backend/.env o en el proceso.")
  process.exitCode = 2
} else {
  const proveedor = new ProveedorAsistenteContextualGroq(process.env.GROQ_API_KEY, "openai/gpt-oss-20b")
  const consultar = async (pregunta: string, contexto: ContextoAsistente, conversacion: MensajeConversacionContextual[] = []) => {
    const solicitud: SolicitudAsistenteContextual = { pregunta, contexto, conversacion }
    const antes = JSON.stringify(contexto)
    const respuesta = await asistirUsuario(solicitud, proveedor)
    return { respuesta, texto: normalizar(respuesta.respuesta), sinMutacion: antes === JSON.stringify(contexto) }
  }

  const contextoNm = contextoBase(
    [{ id: "usuario", nombre: "Usuario", atributos: [] }, { id: "rol", nombre: "Rol", atributos: [] }],
    [{ id: "relacion-usuario-rol", origen: { nombre: "Usuario", multiplicidad: "0..*" }, destino: { nombre: "Rol", multiplicidad: "0..*" } }],
  )
  contextoNm.generacion = { estado: "no_apto", bloqueos: ["La relación Usuario (0..*) ↔ Rol (0..*) representa un N:M directo. Debe convertirse explícitamente en clase asociativa."], advertencias: [] }

  const bloqueo = await consultar("Analiza técnicamente la relación Usuario-Rol y explica el bloqueo actual.", contextoNm)
  const ayudaProducto = await consultar("Explica brevemente cómo crear una clase por texto o voz con Asistente IA y cómo importar o exportar XMI aquí.", contextoBase([]))
  const modeloActualizado = contextoBase([
    { id: "cliente", nombre: "Cliente", atributos: [{ nombre: "id", tipo: "Long" }, { nombre: "correo", tipo: "String" }] },
    { id: "direccion", nombre: "Dirección", atributos: [{ nombre: "calle", tipo: "String" }] },
  ])
  modeloActualizado.revisionModelo = 2
  let modeloVigente: Awaited<ReturnType<typeof consultar>> | null = null
  try {
    modeloVigente = await consultar("El modelo cambió. ¿Y ahora? ¿Qué podría faltarle a Cliente o a este dominio?", modeloActualizado, [
      { rol: "usuario", contenido: "¿Qué podría faltar?" },
      { rol: "asistente", contenido: "OPCIONAL: Dirección. Solo aplica si el negocio registra domicilios." },
    ])
  } catch (error) {
    if (!(error instanceof ErrorAsistenteContextual) || error.tipo !== "no_disponible") throw error
  }

  const explicaBloqueo = /(no (puede|esta listo|es apto)|bloque|impide|requiere|debe)/.test(bloqueo.texto)
  const mencionaNmOAsociativa = /(n:m|muchos a muchos|many-to-many|clase asociativa|entidad asociativa)/.test(bloqueo.texto)
  const noAfirmaUmlInvalido = !/(uml (es|esta) invalid|uml no es valid|modelo (uml )?(es|esta) invalid)/.test(bloqueo.texto)
  const mencionaAsistenteIa = /asistente ia/.test(ayudaProducto.texto)
  const mencionaInstruccionTexto = /(instruccion|texto|escrib)/.test(ayudaProducto.texto)
  const mencionaVoz = /(hablar|voz|dict)/.test(ayudaProducto.texto)
  const mencionaAplicacionAutomatica = /(aplica|aplicara|automatic)/.test(ayudaProducto.texto)
  const vozTranscribeYEnvia = /transcri/.test(ayudaProducto.texto)
    && /(envia.{0,40}automaticamente|automaticamente.{0,40}envia|transcri.{0,100}(automatic|mismo flujo))/s.test(ayudaProducto.texto)
  const noExigeEnviarTrasHablar = !/(hablar|voz|dict).{0,100}(luego|despues).{0,30}(puls|presion|clic).{0,20}enviar/s.test(ayudaProducto.texto)
  const noInventaFlujoCu04 = !/(ir_a_|(?:asistente ia|cambios? validos?).{0,40}(?:requiere confirmacion|debes confirmar))/s.test(ayudaProducto.texto)
  const ayudaIaCorrecta = mencionaAsistenteIa && mencionaInstruccionTexto && mencionaVoz && mencionaAplicacionAutomatica && vozTranscribeYEnvia && noExigeEnviarTrasHablar && noInventaFlujoCu04
  const ayudaXmiCorrecta = /xmi/.test(ayudaProducto.texto)
    && /importar/.test(ayudaProducto.texto)
    && /exportar/.test(ayudaProducto.texto)
    && /(confirm|reemplaz)/.test(ayudaProducto.texto)
    && /modelo\.xmi/.test(ayudaProducto.texto)
    && !/(candidato xmi|modelo candidato|vista previa|archivo\s*(→|>|-).*export|editor (de )?xmi|vista (de )?texto xmi|ir_a_)/.test(ayudaProducto.texto)
    && !/(xmi.{0,80}(requer|necesar).{0,50}(gener|spring)|(gener|spring).{0,80}(requer|necesar).{0,50}xmi)/s.test(ayudaProducto.texto)
  const noDuplicaCorreo = modeloVigente === null || !/(falta\w*[^.\n]{0,35}correo|agreg\w*[^.\n]{0,25}correo|anad\w*[^.\n]{0,25}correo|deber\w*[^.\n]{0,25}correo)/.test(modeloVigente.texto)
  const proponeExtension = modeloVigente !== null && /(nueva clase|nueva entidad|podri\w* (modelar|crear|incorporar)|estadofactura)/.test(modeloVigente.texto)
  const alcanceBienClasificado = modeloVigente === null || !proponeExtension || (modeloVigente.respuesta.categoriaRecomendacion === "OPCIONAL" && /(solo aplica si|si el negocio|si se requiere|depende de)/.test(modeloVigente.texto))
  const respetaModeloActual = modeloVigente === null || (/(cliente|modelo actual|uml actual|valido|apto)/.test(modeloVigente.texto)
    && !/(falta\w*[^.\n]{0,25}direccion|debes crear[^.\n]{0,25}direccion)/.test(modeloVigente.texto))
  const respuestas = [bloqueo, ayudaProducto, ...(modeloVigente ? [modeloVigente] : [])]
  const accionesPermitidas = respuestas.every(({ respuesta }) => ACCIONES_ASISTENTE_CONTEXTUAL.includes(respuesta.accionSugerida))
  const sinIdsInternos = respuestas.every(({ texto }) => !/(ir_a_|mostrar_imagen_candidata|enfocar_elemento)/.test(texto))
  const sinMutacion = respuestas.every((resultado) => resultado.sinMutacion)

  let accionFueraDeListaRechazada = false
  const proveedorInvalido = { responder: async () => ({ respuesta: "Acción inválida", accionSugerida: "BORRAR_MODELO", elementoRelacionadoId: null, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO" }) } as unknown as ProveedorAsistenteContextual
  try { await asistirUsuario({ pregunta: "prueba", contexto: contextoNm, conversacion: [] }, proveedorInvalido) } catch (error) {
    accionFueraDeListaRechazada = error instanceof ErrorAsistenteContextual && error.tipo === "respuesta_invalida"
  }

  const evidencia = {
    realGroqContextUsed: true, model: proveedor.modelo, structuredOutput: true,
    responseReceived: respuestas.every(({ respuesta }) => respuesta.respuesta.trim().length > 0),
    explainsGenerationBlocked: explicaBloqueo, mentionsManyToManyOrAssociativeClass: mencionaNmOAsociativa,
    doesNotClaimUmlInvalid: noAfirmaUmlInvalido, productHelpGrounded: ayudaIaCorrecta,
    mentionsAsistenteIa: mencionaAsistenteIa, mentionsTextInstruction: mencionaInstruccionTexto,
    mentionsVoice: mencionaVoz, mentionsAutomaticApply: mencionaAplicacionAutomatica,
    voiceTranscribesAndSendsAutomatically: vozTranscribeYEnvia, noManualSendAfterVoice: noExigeEnviarTrasHablar,
    avoidsInventedCu04Flow: noInventaFlujoCu04,
    xmiHelpGrounded: ayudaXmiCorrecta, existingAttributeNotSuggestedAsMissing: noDuplicaCorreo,
    extendedModelCasesExecuted: modeloVigente !== null,
    optionalScopeQualified: alcanceBienClasificado, currentModelOverridesConversation: respetaModeloActual,
    internalActionIdsHidden: sinIdsInternos, suggestedActionIsWhitelisted: accionesPermitidas && accionFueraDeListaRechazada,
    noModelMutation: sinMutacion,
    semanticCondition: explicaBloqueo && mencionaNmOAsociativa && noAfirmaUmlInvalido && ayudaIaCorrecta && ayudaXmiCorrecta
      && noDuplicaCorreo && alcanceBienClasificado && respetaModeloActual && sinIdsInternos && accionesPermitidas && accionFueraDeListaRechazada && sinMutacion,
  }
  console.log(JSON.stringify(evidencia, null, 2))
  if (!evidencia.semanticCondition) throw new Error("La respuesta real de Groq no cumplió la condición semántica product-grounded de CU12.")
}
