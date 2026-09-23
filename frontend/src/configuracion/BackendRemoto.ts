function normalizarBaseBackend(valor: string | undefined): string {
  const base = valor?.trim()
  if (!base) return ""
  const url = new URL(base)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL debe usar HTTP o HTTPS.")
  }
  return url.origin
}

export function obtenerBaseBackend(): string {
  return normalizarBaseBackend(import.meta.env.VITE_API_BASE_URL)
}

export function construirUrlBackend(ruta: string): string {
  if (!ruta.startsWith("/")) throw new Error("La ruta del backend debe comenzar con '/'.")
  const base = obtenerBaseBackend()
  return base ? `${base}${ruta}` : ruta
}

export function obtenerUbicacionBackend(
  ubicacionActual: Pick<Location, "protocol" | "host"> = window.location,
): Pick<Location, "protocol" | "host"> {
  const base = obtenerBaseBackend()
  if (!base) return ubicacionActual
  const url = new URL(base)
  return { protocol: url.protocol, host: url.host }
}
