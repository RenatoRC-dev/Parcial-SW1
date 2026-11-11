import { AsyncLocalStorage } from "node:async_hooks"

import type { NombrePasoIA, PasoIA } from "./MensajeProyecto.js"
export type { PasoIA } from "./MensajeProyecto.js"
const contexto = new AsyncLocalStorage<{ requestId: string; pasos: PasoIA[] }>()

export function conProcedencia<T>(requestId: string, ejecutar: () => Promise<T>): Promise<T> {
  return contexto.getStore() ? ejecutar() : contexto.run({ requestId, pasos: [] }, ejecutar)
}
export function procedenciaActual(): PasoIA[] {
  return structuredClone(contexto.getStore()?.pasos ?? [])
}
/** Solo hechos de ejecución; nunca la operación que el LLM dice haber elegido. */
export async function registrarPasoIA<T>(nombre: NombrePasoIA, ejecutar: () => Promise<T> | T): Promise<T> {
  const actual = contexto.getStore()
  const diagnostico = (estado: string) => console.info("[IA] lifecycle", { requestId: actual?.requestId, nombre, estado })
  diagnostico("started")
  try {
    const resultado = await ejecutar()
    actual?.pasos.push({ nombre, estado: "completed" }); diagnostico("completed")
    return resultado
  } catch (error) {
    actual?.pasos.push({ nombre, estado: "failed" }); diagnostico("failed")
    throw error
  }
}
