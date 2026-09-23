import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"

export async function exportarModeloXmi(modelo: ModeloUMLCanonico): Promise<void> {
  const respuesta = await fetch(construirUrlBackend("/api/interoperabilidad/xmi/exportar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modelo),
  })
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({})) as { error?: string }
    throw new Error(cuerpo.error ?? "No se pudo exportar el modelo XMI.")
  }
  const url = URL.createObjectURL(await respuesta.blob())
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = "modelo.xmi"
  enlace.click()
  URL.revokeObjectURL(url)
}
