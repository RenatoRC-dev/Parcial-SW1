import Groq from "groq-sdk"
import type { RespuestaInterpretacionUML } from "../../contrato/PlanCambiosUML.js"
import { ErrorProveedorIA, type ProveedorModeloLenguaje, type SolicitudProveedorUML } from "../ProveedorModeloLenguaje.js"
import { esRespuestaInterpretacionUML } from "../../../casos_uso/cu04_modelar_con_ia/validarPlanCambiosUML.js"
import { ESQUEMA_RESPUESTA_GROQ } from "./EsquemaRespuestaGroq.js"
import { TIPOS_UML_SOPORTADOS_IA } from "../../contrato/ComandoModeloUML.js"

const MODELO_PREDETERMINADO = "openai/gpt-oss-20b"
const TIMEOUT_MS = 18_000

const INSTRUCCIONES = `Eres un intérprete de UNA instrucción incremental de modelado UML contra el modelo actual.
No generes un modelo completo. Devuelve exclusivamente el objeto del esquema.
Usa solo ids incluidos en el contexto para elementos existentes; nunca inventes esos ids.
Para elementos nuevos usa referencias temporales tmp_* únicas dentro de esta respuesta.
No crees elementos no solicitados salvo que la instrucción lo pida explícitamente.
Puedes crear asociacion, agregacion, composicion y generalizacion con un solo comando crear_relacion y sus campos discriminados.
Asociacion no implica navegabilidad. Usa claseOrigenRef/claseDestinoRef; si no se indican cardinalidades, envía ambas cantidades como null sin inventarlas. Cuando se indiquen, cantidadDestinoPorOrigen responde "para UNA instancia origen, cuántas instancias destino puede haber" y cantidadOrigenPorDestino responde la pregunta inversa.
Agregacion y composicion usan parteRef/todoRef. cantidadPartesPorTodo es cuántas Partes corresponden a un Todo; cantidadTodosPorParte es cuántos Todos corresponden a una Parte. Usa null cuando no se expresen. Ejemplos: "Equipo es el todo" => parteRef=Jugador, todoRef=Equipo; "Pedido se compone de DetallePedido" => parteRef=DetallePedido, todoRef=Pedido.
Generalizacion usa subclaseRef/superclaseRef y no tiene multiplicidades. "Cliente hereda de Persona" => subclaseRef=Cliente, superclaseRef=Persona.
Si una agregacion/composicion no permite identificar Todo y Parte, o una generalizacion no permite identificar Subclase y Superclase, resultado=aclarar y comandos=[].
En cambiar_multiplicidad, cantidadDestinoPorOrigen y cantidadOrigenPorDestino conservan las preguntas de negocio anteriores. Ejemplo: una Persona tiene cero o muchos Autos y cada Auto una Persona => origen Persona, destino Auto, cantidadDestinoPorOrigen="0..*", cantidadOrigenPorDestino="1". El ejecutor las convierte a multiplicidades de extremos UML.
Normaliza referencias naturales de clases a sus ids del contexto. id: Long es un atributo explícito válido.
Para atributos sin visibilidad explícita usa privada. Para métodos sin visibilidad o retorno explícitos usa publica y void.
Los métodos son únicamente firmas de diseño: nombre, visibilidad, retorno y parámetros; nunca inventes cuerpos o algoritmos.
Tipos de datos admitidos: ${TIPOS_UML_SOPORTADOS_IA.join(", ")}; los retornos además admiten void.
Conserva crear/modificar/eliminar métodos y parámetros como comandos estructurados.
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
