import Groq from "groq-sdk"
import {
  ACCIONES_ASISTENTE_CONTEXTUAL,
  esRespuestaAsistenteContextual,
  type SolicitudAsistenteContextual,
  type RespuestaAsistenteContextual,
} from "../../ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../ProveedorAsistenteContextual.js"
import { CONTEXTO_PRODUCTO_SW1 } from "../../ContextoProductoSW1.js"

const MODELO_PREDETERMINADO = "openai/gpt-oss-20b"
const TIMEOUT_MS = 18_000

const INSTRUCCIONES = `Eres el asistente contextual de la herramienta CASE NexoCASE.
Tu responsabilidad es orientar sobre el uso del producto y explicar hechos objetivos del modelo UML suministrado. No eres un analista de requisitos ni un diseñador autónomo del dominio.

Prioridad de verdad: modeloActual > elementoSeleccionado > validación/generación actuales > contextoProducto > conversación reciente. Para preguntas del modelo manda el UML actual; para preguntas de uso del producto manda contextoProducto. Si el modelo cambió, ignora supuestos antiguos incompatibles. Usa la conversación solo para resolver continuaciones claras; si una referencia es ambigua, pide una aclaración breve.

Al explicar NexoCASE menciona solo accesos, botones y flujos presentes en contextoProducto. Nunca inventes menús, iconos, diálogos, vistas, edición textual XMI o gestos. Nunca escribas identificadores internos de acciones. Exprésalos mediante la interfaz visible, por ejemplo: "Abre Validación desde la barra izquierda".
En ayuda de voz, explica que Hablar graba, transcribe y envía automáticamente la instrucción al flujo CU04; nunca indiques pulsar Enviar después. En ayuda XMI, no hables de candidato ni vista previa: la confirmación ocurre porque importar reemplaza el diagrama actual. Exportar descarga modelo.xmi para interoperabilidad y no es requisito ni mecanismo de generación Spring. El concepto de candidato con confirmación pertenece exclusivamente a Desde imagen (CU05).

Al analizar el modelo revisa primero si cada clase o atributo ya existe. No sugieras como faltante algo presente. No propongas métodos CRUD como operaciones del dominio: el CRUD generado no implica métodos UML. Explica errores, advertencias, inconsistencias, multiplicidades y aptitud Spring que estén presentes. Si preguntan qué falta, qué otras entidades deberían existir o si el negocio está completo y no se suministraron requisitos/casos de uso, explica que NexoCASE no puede determinar completitud de negocio desde el UML solo y solicita esa información. No inventes requisitos, clases, atributos, actores, módulos, procesos ni cardinalidades. Solo si el usuario pide explícitamente una idea, permite como máximo un ejemplo hipotético, marcado OPCIONAL y con "Solo aplica si...".

Clasifica cada respuesta: OBLIGATORIO solo ante un problema concreto; RECOMENDADO para una mejora sustentada; OPCIONAL si depende de requisitos ausentes; INFORMATIVO para explicaciones. Explica las multiplicidades como reglas de negocio y ofrece alternativas cuando falte evidencia.

CU12 orienta y nunca modifica, guarda, genera, importa ni exporta. Distingue UML válido, aptitud Spring y completitud de negocio: esta última no puede afirmarse sin requisitos o casos de uso. Responde en contextoAplicacion.idioma, de forma breve, en texto plano y con encabezados cortos como Resultado:, Cómo hacerlo:, Nota: o Condición de negocio:. No uses Markdown. Si la pregunta está fuera de NexoCASE/UML, redirige al producto.

Devuelve exclusivamente el JSON solicitado y usa solo acciones permitidas.`

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    respuesta: { type: "string", maxLength: 2400 },
    accionSugerida: { type: "string", enum: ACCIONES_ASISTENTE_CONTEXTUAL },
    elementoRelacionadoId: { type: ["string", "null"] },
    nivel: { type: "string", enum: ["informacion", "sugerencia", "advertencia"] },
    categoriaRecomendacion: { type: "string", enum: ["INFORMATIVO", "OBLIGATORIO", "RECOMENDADO", "OPCIONAL"] },
  },
  required: ["respuesta", "accionSugerida", "elementoRelacionadoId", "nivel", "categoriaRecomendacion"],
} as const

export function construirContenidoPreguntaContextual(solicitud: SolicitudAsistenteContextual): string {
  return JSON.stringify({
    pregunta: solicitud.pregunta,
    contextoAplicacion: solicitud.contexto,
    contextoProducto: CONTEXTO_PRODUCTO_SW1,
  })
}

export class ProveedorAsistenteContextualGroq implements ProveedorAsistenteContextual {
  readonly modelo: string
  private readonly cliente: Groq | null

  constructor(apiKey = process.env.GROQ_API_KEY, modelo = process.env.GROQ_MODEL?.trim() || MODELO_PREDETERMINADO) {
    this.modelo = modelo
    this.cliente = apiKey ? new Groq({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 }) : null
  }

  async responder(solicitud: SolicitudAsistenteContextual): Promise<RespuestaAsistenteContextual> {
    if (!this.cliente) throw new ErrorAsistenteContextual("no_disponible", "GROQ_API_KEY no está configurada en el backend.")
    try {
      const respuesta = await this.cliente.chat.completions.create({
        model: this.modelo,
        temperature: 0,
        max_tokens: 700,
        messages: [
          { role: "system", content: INSTRUCCIONES },
          ...solicitud.conversacion.map((mensaje) => ({ role: mensaje.rol === "usuario" ? "user" as const : "assistant" as const, content: mensaje.contenido })),
          { role: "user", content: construirContenidoPreguntaContextual(solicitud) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "respuesta_asistente_contextual", strict: true, schema: ESQUEMA } },
      })
      const contenido = respuesta.choices[0]?.message?.content
      if (!contenido) throw new ErrorAsistenteContextual("respuesta_invalida", "Groq no devolvió una respuesta estructurada para CU12.")
      const candidata: unknown = JSON.parse(contenido)
      if (!esRespuestaAsistenteContextual(candidata)) throw new ErrorAsistenteContextual("respuesta_invalida", "La respuesta de CU12 contiene una acción o estructura no permitida.")
      return candidata
    } catch (error) {
      if (error instanceof ErrorAsistenteContextual) throw error
      const estado = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0
      if (estado === 429) throw new ErrorAsistenteContextual("limite", "El asistente alcanzó temporalmente su límite de uso.")
      throw new ErrorAsistenteContextual("no_disponible", "El asistente IA no está disponible temporalmente.")
    }
  }
}
