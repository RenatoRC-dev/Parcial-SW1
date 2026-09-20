import Groq from "groq-sdk"
import {
  ACCIONES_ASISTENTE_CONTEXTUAL,
  esRespuestaAsistenteContextual,
  type SolicitudAsistenteContextual,
  type RespuestaAsistenteContextual,
} from "../../ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual, type ProveedorAsistenteContextual } from "../../ProveedorAsistenteContextual.js"

const MODELO_PREDETERMINADO = "openai/gpt-oss-20b"
const TIMEOUT_MS = 18_000

const INSTRUCCIONES = `Eres el asistente contextual de la herramienta CASE SW1.
Ayuda a un Diseñador de Software a usar el producto y comprender el flujo de modelado de clases UML soportado.
Trata el estado estructurado suministrado por la aplicación como verdad autoritativa.
Nunca inventes clases, errores, capacidades o estado del producto.
Distingue claramente validez UML, completitud del modelo y aptitud para generar Spring.
CU12 solamente orienta: no afirmes haber modificado, guardado, generado, importado ni exportado nada.
Si la pregunta está fuera de SW1, UML, modelado, generación o interoperabilidad, redirige cortésmente al contexto del producto.
No afirmes que una funcionalidad no soportada existe. Responde de forma breve y práctica en el idioma de la pregunta.
Devuelve exclusivamente el objeto JSON solicitado y usa solamente una acción de la lista permitida.`

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    respuesta: { type: "string" },
    accionSugerida: { type: "string", enum: ACCIONES_ASISTENTE_CONTEXTUAL },
    elementoRelacionadoId: { type: ["string", "null"] },
    nivel: { type: "string", enum: ["informacion", "sugerencia", "advertencia"] },
  },
  required: ["respuesta", "accionSugerida", "elementoRelacionadoId", "nivel"],
} as const

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
        messages: [
          { role: "system", content: INSTRUCCIONES },
          ...solicitud.conversacion.map((mensaje) => ({ role: mensaje.rol === "usuario" ? "user" as const : "assistant" as const, content: mensaje.contenido })),
          { role: "user", content: JSON.stringify({ pregunta: solicitud.pregunta, contextoAplicacion: solicitud.contexto }) },
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
