import { cargarConfiguracionEntorno } from "../../../configuracion/cargarConfiguracionEntorno.js"
import { asistirUsuario } from "../casos_uso/cu12_asistir_usuario/asistirUsuario.js"
import type { SolicitudAsistenteContextual } from "../compartido/ContratoAsistenteContextual.js"
import { ACCIONES_ASISTENTE_CONTEXTUAL } from "../compartido/ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../compartido/ProveedorAsistenteContextual.js"
import { ProveedorAsistenteContextualGroq } from "../compartido/proveedores/groq/ProveedorAsistenteContextualGroq.js"

cargarConfiguracionEntorno()

if (!process.env.GROQ_API_KEY) {
  console.error("Prerequisito ausente: configure GROQ_API_KEY en backend/.env o en el proceso.")
  process.exitCode = 2
} else {
  const solicitud: SolicitudAsistenteContextual = {
    pregunta: "¿Por qué no puedo generar el backend y qué debo hacer?",
    contexto: {
      proyecto: { id: "prueba-contextual", nombre: "Prueba Contextual" },
      area: "modelado_uml",
      elementoSeleccionado: null,
      elementosRelevantes: [{ id: "relacion-usuario-rol", tipo: "relacion", nombre: "Usuario (0..*) ↔ Rol (0..*)" }],
      resumenModelo: { clases: 2, relaciones: 1 },
      estadoUml: { estado: "valido", problemas: [] },
      generacion: {
        estado: "no_apto",
        bloqueos: ["La relación Usuario (0..*) ↔ Rol (0..*) representa un N:M directo. El generador Spring de SW1 requiere convertirla explícitamente en una clase asociativa antes de generar."],
        advertencias: [],
      },
      cambiosSinGuardar: false,
      candidatoImagenPendiente: false,
      accionesDisponibles: ["ENFOCAR_ELEMENTO"],
    },
    conversacion: [],
  }
  const contextoAntes = JSON.stringify(solicitud.contexto)
  const proveedor = new ProveedorAsistenteContextualGroq(process.env.GROQ_API_KEY, "openai/gpt-oss-20b")
  const respuesta = await asistirUsuario(solicitud, proveedor)
  const texto = respuesta.respuesta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const explicaBloqueo = /(no (puede|esta listo|es apto)|bloque|impide|requiere|debe)/.test(texto)
  const mencionaNmOAsociativa = /(n:m|muchos a muchos|many-to-many|clase asociativa|entidad asociativa)/.test(texto)
  const noAfirmaUmlInvalido = !/(uml (es|esta) invalid|uml no es valid|modelo uml (es|esta) invalid|modelo (es|esta) invalid)/.test(texto)
  const accionPermitida = ACCIONES_ASISTENTE_CONTEXTUAL.includes(respuesta.accionSugerida)
    && solicitud.contexto.accionesDisponibles.includes(respuesta.accionSugerida as "ENFOCAR_ELEMENTO")
  const sinMutacion = contextoAntes === JSON.stringify(solicitud.contexto)

  let accionFueraDeListaRechazada = false
  const proveedorInvalido = {
    responder: async () => ({ respuesta: "Acción inválida", accionSugerida: "BORRAR_MODELO", elementoRelacionadoId: null, nivel: "informacion" }),
  } as unknown as ProveedorAsistenteContextual
  try {
    await asistirUsuario(solicitud, proveedorInvalido)
  } catch (error) {
    accionFueraDeListaRechazada = error instanceof ErrorAsistenteContextual && error.tipo === "respuesta_invalida"
  }

  const evidencia = {
    realGroqContextUsed: true,
    model: proveedor.modelo,
    structuredOutput: true,
    responseReceived: respuesta.respuesta.trim().length > 0,
    explainsGenerationBlocked: explicaBloqueo,
    mentionsManyToManyOrAssociativeClass: mencionaNmOAsociativa,
    doesNotClaimUmlInvalid: noAfirmaUmlInvalido,
    suggestedActionIsWhitelisted: accionPermitida && accionFueraDeListaRechazada,
    noModelMutation: sinMutacion,
    semanticCondition: explicaBloqueo && mencionaNmOAsociativa && noAfirmaUmlInvalido && accionPermitida && accionFueraDeListaRechazada && sinMutacion,
  }
  console.log(JSON.stringify(evidencia, null, 2))
  if (!evidencia.semanticCondition) throw new Error("La respuesta real de Groq no cumplió la condición semántica de CU12.")
}
