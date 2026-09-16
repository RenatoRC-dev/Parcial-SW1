import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export async function solicitarBackendGenerado(
  modelo: ModeloUMLCanonico,
  ejecutarFetch: typeof fetch = fetch
): Promise<Blob> {
  const respuesta = await ejecutarFetch("/api/generacion/spring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modelo),
  })
  if (!respuesta.ok) {
    const detalle = (await respuesta.json().catch(() => null)) as { error?: string; errores?: string[] } | null
    throw new Error(detalle?.errores?.join(" ") ?? detalle?.error ?? `Error HTTP ${respuesta.status}`)
  }
  return respuesta.blob()
}

export async function descargarBackendGenerado(modelo: ModeloUMLCanonico): Promise<void> {
  const archivo = await solicitarBackendGenerado(modelo)
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = "backend-generado.zip"
  enlace.click()
  URL.revokeObjectURL(url)
}
