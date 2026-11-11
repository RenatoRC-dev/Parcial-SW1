import type { SolicitudAsistenteContextual } from "./ContratoAsistenteContextual.js"
import { ErrorAsistenteContextual } from "./ProveedorAsistenteContextual.js"

export const OPERACIONES_LOCALES = ["conversar", "modificar_uml", "analizar_imagen", "validar_uml", "importar_xmi", "exportar_xmi", "generar_spring", "automatizar_ea", "aclarar"] as const
export type OperacionLocal = typeof OPERACIONES_LOCALES[number]
export interface PlanLocal { operacion: OperacionLocal; argumentos: Record<string, never>; respuesta: string }
export interface PlanificadorLocal {
  planificar(solicitud: SolicitudAsistenteContextual): Promise<PlanLocal>
  comprobarEstado?(): Promise<"disponible" | "modelo_ausente" | "no_disponible">
}

// El modelo no aporta IDs, permisos, revisiones ni autoridad de ejecución.
// El backend puede recuperar el consejo durable propio como datos de una petición
// humana explícita; únicamente CU04 interpreta esa instrucción autocontenida.
export const ESQUEMA_PLAN_LOCAL = {
  type: "object", additionalProperties: false,
  properties: {
    operacion: { type: "string", enum: OPERACIONES_LOCALES },
    argumentos: { type: "object", additionalProperties: false, properties: {} },
    respuesta: { type: "string", minLength: 1, maxLength: 2400 },
  }, required: ["operacion", "argumentos", "respuesta"],
} as const

export function validarPlanLocal(valor: unknown): PlanLocal {
  const objeto = (dato: unknown): dato is Record<string, unknown> => typeof dato === "object" && dato !== null && !Array.isArray(dato)
  if (!objeto(valor) || Object.keys(valor).sort().join(",") !== "argumentos,operacion,respuesta"
    || !OPERACIONES_LOCALES.includes(valor.operacion as OperacionLocal)
    || !objeto(valor.argumentos) || Object.keys(valor.argumentos).length !== 0
    || typeof valor.respuesta !== "string" || !valor.respuesta.trim() || valor.respuesta.length > 2400) {
    throw new ErrorAsistenteContextual("respuesta_invalida", "Ollama devolvió una operación o argumentos no permitidos.")
  }
  return { operacion: valor.operacion as OperacionLocal, argumentos: {}, respuesta: valor.respuesta.trim() }
}
