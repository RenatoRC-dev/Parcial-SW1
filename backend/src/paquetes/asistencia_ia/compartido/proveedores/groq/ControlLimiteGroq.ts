// CU04 y CU12 comparten la cuota del modelo en este backend. Sin reintentos automáticos.
const pausas = new Map<string, number>()

export function segundosEsperaGroq(modelo: string): number {
  return Math.max(0, Math.ceil(((pausas.get(modelo) ?? 0) - Date.now()) / 1000))
}

export function registrarLimiteGroq(modelo: string, error: unknown): number {
  const headers = (error as { headers?: Headers | Record<string, string> } | null)?.headers
  const valor = headers && (typeof headers.get === "function" ? headers.get("retry-after") : (headers as Record<string, string>)["retry-after"])
  const segundos = valor ? Number(valor) : NaN
  const espera = Number.isFinite(segundos) ? segundos : valor ? (Date.parse(valor) - Date.now()) / 1000 : 30
  const acotada = Math.min(300, Math.max(1, Math.ceil(Number.isFinite(espera) ? espera : 30)))
  pausas.set(modelo, Math.max(pausas.get(modelo) ?? 0, Date.now() + acotada * 1000))
  return segundosEsperaGroq(modelo)
}

export function registrarUsoGroq(flow: "CU04" | "CU12", model: string, requestId: string, usage: unknown): void {
  const uso = usage as { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null
  console.info("[Groq] usage", { flow, model, requestId, inputTokens: uso?.prompt_tokens, outputTokens: uso?.completion_tokens, cachedTokens: uso?.prompt_tokens_details?.cached_tokens })
}
