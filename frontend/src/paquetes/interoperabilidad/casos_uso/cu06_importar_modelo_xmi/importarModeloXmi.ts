import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { construirUrlBackend } from "../../../../configuracion/BackendRemoto"

export interface AdvertenciaInteroperabilidad {
  codigo: string
  mensaje: string
  elementoId?: string
}

export interface ResultadoImportacionXmi {
  modelo: ModeloUMLCanonico
  advertencias: AdvertenciaInteroperabilidad[]
}

export async function importarModeloXmi(texto: string): Promise<ResultadoImportacionXmi> {
  const respuesta = await fetch(construirUrlBackend("/api/interoperabilidad/xmi/importar"), {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: texto,
  })
  const cuerpo = await respuesta.json() as ResultadoImportacionXmi | { error?: string }
  if (!respuesta.ok) {
    throw new Error("error" in cuerpo && cuerpo.error ? cuerpo.error : "No se pudo importar el XMI.")
  }
  return cuerpo as ResultadoImportacionXmi
}
