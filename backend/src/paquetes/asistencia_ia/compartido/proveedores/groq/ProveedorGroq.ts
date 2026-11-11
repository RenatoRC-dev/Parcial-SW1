import Groq from "groq-sdk"
import { randomUUID } from "node:crypto"
import { registrarLimiteGroq, registrarUsoGroq, segundosEsperaGroq } from "./ControlLimiteGroq.js"
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

export function esErrorOperativoGroq(error: unknown): boolean {
  if (!objeto(error)) return false
  return (typeof error.status === "number" && error.status >= 400 && error.status <= 599)
    || ["ETIMEDOUT", "ABORT_ERR", "ECONNRESET", "ECONNREFUSED"].includes(String(error.code))
    || (error instanceof Error && /^(APIConnectionError|APIConnectionTimeoutError|APIUserAbortError|AbortError|TimeoutError)$/.test(error.name))
}

export function clasificarErrorProveedorGroq(error: unknown): { estado: number; codigo: string; tipo: TipoErrorProveedor; motivo: string } {
  const exterior = objeto(error) ? error : {}
  const cuerpo = objeto(exterior.error) ? exterior.error : {}
  const interior = objeto(cuerpo.error) ? cuerpo.error : cuerpo
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
Puede incluir un modelo completo si la instrucción lo solicita: crea todas las clases, atributos y relaciones concretamente especificados, en orden de dependencias, usando tmp_* para enlazar los nuevos elementos. Tablas significa clases UML, nunca DDL. Devuelve exclusivamente el objeto del esquema.
Si faltan especificaciones esenciales para ese modelo, pregunta con resultado=aclarar y comandos=[]. No entregues un plan parcial como si estuviera completo ni inventes reglas de negocio para rellenar lo solicitado.
Usa literalmente los nombres de comando del esquema; nunca inventes alias como crear_atributo. Para crear una clase usa crear_clase con refTemporal, nombre y abstracta. Para añadir un atributo usa agregar_atributo con claseRef, refTemporal, nombre, tipoDato y visibilidad. Incluye todos los campos requeridos por el esquema aunque su valor sea null.
Una clase puede no tener atributos. Un atributo UML puede no tener tipo: si no se especifica, usa tipoDato=null, nunca infieras String, Object ni otro tipo. Ejemplo: "Crea Cliente con nombre, correo y telefono sin definir sus tipos" crea Cliente y exactamente esos tres atributos con tipoDato=null. UML conceptual no es un esquema relacional ni un modelo JPA: no conviertas anotaciones PK/FK en atributos obligatorios, no dupliques una asociación mediante una FK y no añadas anotaciones JPA. Conserva los atributos id/PK/FK que el usuario solicite explícitamente. En modificar_atributo, nuevoTipo=null conserva el tipo existente; no significa borrarlo.
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

  constructor(apiKey = process.env.GROQ_API_KEY, modelo = process.env.GROQ_CU04_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || MODELO_PREDETERMINADO) {
    this.modelo = modelo
    this.cliente = apiKey ? new Groq({ apiKey, timeout: CU04_AI_TIMEOUT_MS, maxRetries: 0 }) : null
  }

  async interpretarCambiosUML(solicitud: SolicitudProveedorUML): Promise<RespuestaInterpretacionUML> {
    if (!this.cliente) throw new ErrorProveedorIA("configuracion", "GROQ_API_KEY no está configurada en el backend.")
    const espera = segundosEsperaGroq(this.modelo)
    if (espera) throw new ErrorProveedorIA("limite", "Espera antes de reintentar la misma solicitud.", espera)
    const requestId = solicitud.requestId ?? randomUUID()
    console.info(`[CU04][AI] request_started provider_model=${this.modelo}`)
    try {
      const respuesta = await this.cliente.chat.completions.create({
        model: this.modelo,
        temperature: 0,
        max_completion_tokens: 6000,
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
      registrarUsoGroq("CU04", this.modelo, requestId, respuesta.usage)
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
      if (!esErrorOperativoGroq(error)) throw error
      const { estado, codigo, tipo } = clasificarErrorProveedorGroq(error)
      const eventos: Record<TipoErrorProveedor, string> = {
        timeout: `provider_timeout timeout_ms=${CU04_AI_TIMEOUT_MS}`,
        limite: "provider_rate_limit",
        autenticacion: "provider_auth_error",
        configuracion: "provider_config_error",
        respuesta_invalida: "parse_error",
        no_disponible: "provider_unavailable",
      }
      const categoria = /^[a-z_]{1,50}$/.test(codigo) ? codigo : "unknown"
      console.error(`[CU04][AI] ${eventos[tipo]} status=${estado || "unknown"} code=${categoria}`, { model: this.modelo, requestId })
      const mensajes: Record<TipoErrorProveedor, string> = {
        limite: "El servicio de IA alcanzó temporalmente su límite de uso.",
        autenticacion: "La autenticación del proveedor de IA falló.",
        configuracion: "El proveedor rechazó la configuración de CU04.",
        timeout: "El proveedor de IA excedió el tiempo de espera.",
        respuesta_invalida: "El proveedor devolvió una respuesta que no cumple el esquema CU04.",
        no_disponible: "El servicio de IA no está disponible temporalmente.",
      }
      throw new ErrorProveedorIA(tipo, mensajes[tipo], tipo === "limite" ? registrarLimiteGroq(this.modelo, error) : undefined)
    }
  }
}
