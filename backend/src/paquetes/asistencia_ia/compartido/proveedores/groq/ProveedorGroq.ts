import Groq from "groq-sdk"
import type { RespuestaInterpretacionUML } from "../../contrato/PlanCambiosUML.js"
import { ErrorProveedorIA, type ProveedorModeloLenguaje, type SolicitudProveedorUML } from "../ProveedorModeloLenguaje.js"
import { esRespuestaInterpretacionUML } from "../../../casos_uso/cu04_modelar_con_ia/validarPlanCambiosUML.js"
import { ESQUEMA_RESPUESTA_GROQ } from "./EsquemaRespuestaGroq.js"

const MODELO_PREDETERMINADO = "openai/gpt-oss-20b"
const TIMEOUT_MS = 18_000

const INSTRUCCIONES = `Eres un intérprete de UNA instrucción incremental de modelado UML contra el modelo actual.
No generes un modelo completo. Devuelve exclusivamente el objeto del esquema.
Usa solo ids incluidos en el contexto para elementos existentes; nunca inventes esos ids.
Para elementos nuevos usa referencias temporales tmp_* únicas dentro de esta respuesta.
No crees elementos no solicitados salvo que la instrucción lo pida explícitamente.
Solo puedes crear relaciones de tipo asociacion. No uses semántica fuera del vocabulario permitido.
Si hay más de una interpretación posible, resultado=aclarar, comandos=[] y una pregunta breve.
Si la solicitud es inválida o no soportada, resultado=rechazar y comandos=[].
Solo una intención destructiva explícita puede producir eliminación.
No añadas requisitos de negocio ni prosa fuera del esquema.`

export class ProveedorGroq implements ProveedorModeloLenguaje {
  readonly modelo: string
  private readonly cliente: Groq | null

  constructor(apiKey = process.env.GROQ_API_KEY, modelo = process.env.GROQ_MODEL ?? MODELO_PREDETERMINADO) {
    this.modelo = modelo
    this.cliente = apiKey ? new Groq({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 }) : null
  }

  async interpretarCambiosUML(solicitud: SolicitudProveedorUML): Promise<RespuestaInterpretacionUML> {
    if (!this.cliente) throw new ErrorProveedorIA("no_disponible", "GROQ_API_KEY no está configurada en el backend.")
    try {
      const respuesta = await this.cliente.chat.completions.create({
        model: this.modelo,
        temperature: 0,
        messages: [
          { role: "system", content: INSTRUCCIONES },
          { role: "user", content: JSON.stringify({ instruccion: solicitud.instruccion, modeloActual: solicitud.contexto }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "respuesta_interpretacion_uml",
            strict: true,
            schema: ESQUEMA_RESPUESTA_GROQ,
          },
        },
      })
      const contenido = respuesta.choices[0]?.message?.content
      if (!contenido) throw new ErrorProveedorIA("respuesta_invalida", "Groq no devolvió una respuesta estructurada.")
      const candidata: unknown = JSON.parse(contenido)
      if (!esRespuestaInterpretacionUML(candidata)) throw new ErrorProveedorIA("respuesta_invalida", "La respuesta estructurada no cumple el contrato CU04.")
      return candidata
    } catch (error) {
      if (error instanceof ErrorProveedorIA) throw error
      const estado = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0
      if (estado === 429) throw new ErrorProveedorIA("limite", "El servicio de IA alcanzó temporalmente su límite de uso.")
      throw new ErrorProveedorIA("no_disponible", "El servicio de IA no está disponible temporalmente.")
    }
  }
}
