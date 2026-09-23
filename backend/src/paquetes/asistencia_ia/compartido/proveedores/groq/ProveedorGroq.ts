import Groq from "groq-sdk"
import type { RespuestaInterpretacionUML } from "../../contrato/PlanCambiosUML.js"
import { ErrorProveedorIA, type ProveedorModeloLenguaje, type SolicitudProveedorUML } from "../ProveedorModeloLenguaje.js"
import { esRespuestaInterpretacionUML } from "../../../casos_uso/cu04_modelar_con_ia/validarPlanCambiosUML.js"
import { ESQUEMA_RESPUESTA_GROQ, normalizarRespuestaGroq } from "./EsquemaRespuestaGroq.js"
import { TIPOS_UML_SOPORTADOS_IA } from "../../contrato/ComandoModeloUML.js"

const MODELO_PREDETERMINADO = "openai/gpt-oss-20b"
export const CU04_AI_TIMEOUT_MS = 60_000

type TipoErrorProveedor = ErrorProveedorIA["tipo"]

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

export function clasificarErrorProveedorGroq(error: unknown): { estado: number; codigo: string; tipo: TipoErrorProveedor; motivo: string } {
  const exterior = objeto(error) ? error : {}
  const interior = objeto(exterior.error) ? exterior.error : {}
  const estado = Number(exterior.status) || 0
  const codigo = String(interior.code ?? exterior.code ?? "unknown")
  const motivo = String(interior.message ?? (error instanceof Error ? error.message : "unknown")).replace(/\s+/g, " ").slice(0, 500)
  if (estado === 429) return { estado, codigo, tipo: "limite", motivo }
  if (estado === 401 || estado === 403) return { estado, codigo, tipo: "autenticacion", motivo }
  if (codigo === "json_validate_failed") return { estado, codigo, tipo: "respuesta_invalida", motivo }
  if (estado === 400) return { estado, codigo, tipo: "configuracion", motivo }
  const nombre = error instanceof Error ? error.name.toLowerCase() : ""
  if (estado === 408 || codigo === "ETIMEDOUT" || codigo === "ABORT_ERR" || nombre.includes("timeout") || /timed? out|tiempo de espera/i.test(motivo)) {
    return { estado, codigo, tipo: "timeout", motivo }
  }
  return { estado, codigo, tipo: "no_disponible", motivo }
}

const INSTRUCCIONES = `Eres un intérprete de UNA instrucción incremental de modelado UML contra el modelo actual.
No generes un modelo completo. Devuelve exclusivamente el objeto del esquema.
Usa literalmente los nombres de comando del esquema; nunca inventes alias como crear_atributo. Para crear una clase usa crear_clase con refTemporal, nombre y abstracta. Para añadir un atributo usa agregar_atributo con claseRef, refTemporal, nombre, tipoDato y visibilidad. Incluye todos los campos requeridos por el esquema aunque su valor sea null.
Usa solo ids incluidos en el contexto para elementos existentes; nunca inventes esos ids.
Para elementos nuevos usa referencias temporales tmp_* únicas dentro de esta respuesta.
No crees elementos no solicitados salvo que la instrucción lo pida explícitamente.
Una clase asociativa sólo existe cuando el usuario la declara explícitamente. Usa crear_clase_asociativa para crearla entre dos clases o convertir_relacion_en_clase_asociativa para reemplazar una asociación N:M existente. No inventes atributos id, PK ni FK.
Para el transporte estructurado usa crear_asociacion, crear_agregacion, crear_composicion o crear_generalizacion; el adaptador los convierte al comando interno crear_relacion.
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
    this.cliente = apiKey ? new Groq({ apiKey, timeout: CU04_AI_TIMEOUT_MS, maxRetries: 0 }) : null
  }

  async interpretarCambiosUML(solicitud: SolicitudProveedorUML): Promise<RespuestaInterpretacionUML> {
    if (!this.cliente) throw new ErrorProveedorIA("configuracion", "GROQ_API_KEY no está configurada en el backend.")
    console.info(`[CU04][AI] request_started provider_model=${this.modelo}`)
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
      console.info("[CU04][AI] provider_success")
      const contenido = respuesta.choices[0]?.message?.content
      if (!contenido) throw new ErrorProveedorIA("respuesta_invalida", "Groq no devolvió una respuesta estructurada.")
      let candidata: unknown
      try {
        candidata = normalizarRespuestaGroq(JSON.parse(contenido))
      } catch {
        console.warn("[CU04][AI] parse_error invalid_json")
        throw new ErrorProveedorIA("respuesta_invalida", "Groq devolvió JSON inválido.")
      }
      if (!esRespuestaInterpretacionUML(candidata)) throw new ErrorProveedorIA("respuesta_invalida", "La respuesta estructurada no cumple el contrato CU04.")
      console.info("[CU04][AI] parse_success")
      return candidata
    } catch (error) {
      if (error instanceof ErrorProveedorIA) throw error
      const { estado, codigo, tipo } = clasificarErrorProveedorGroq(error)
      const eventos: Record<TipoErrorProveedor, string> = {
        timeout: `provider_timeout timeout_ms=${CU04_AI_TIMEOUT_MS}`,
        limite: "provider_rate_limit",
        autenticacion: "provider_auth_error",
        configuracion: "provider_config_error",
        respuesta_invalida: "parse_error",
        no_disponible: "provider_unavailable",
      }
      console.error(`[CU04][AI] ${eventos[tipo]} status=${estado || "unknown"} code=${codigo}`)
      const mensajes: Record<TipoErrorProveedor, string> = {
        limite: "El servicio de IA alcanzó temporalmente su límite de uso.",
        autenticacion: "La autenticación del proveedor de IA falló.",
        configuracion: "El proveedor rechazó la configuración de CU04.",
        timeout: "El proveedor de IA excedió el tiempo de espera.",
        respuesta_invalida: "El proveedor devolvió una respuesta que no cumple el esquema CU04.",
        no_disponible: "El servicio de IA no está disponible temporalmente.",
      }
      throw new ErrorProveedorIA(tipo, mensajes[tipo])
    }
  }
}
