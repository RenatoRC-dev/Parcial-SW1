import { useRef, useState, type ChangeEvent } from "react"
import type { ModeloUMLCanonico } from "../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { importarModeloXmi, type AdvertenciaInteroperabilidad } from "../casos_uso/cu06_importar_modelo_xmi/importarModeloXmi"
import { exportarModeloXmi } from "../casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi"

interface PropiedadesPanelInteroperabilidadXmi {
  modelo: ModeloUMLCanonico
  alImportar: (modelo: ModeloUMLCanonico) => void
}

export function PanelInteroperabilidadXmi({ modelo, alImportar }: PropiedadesPanelInteroperabilidadXmi) {
  const selector = useRef<HTMLInputElement>(null)
  const [estado, establecerEstado] = useState("Listo")
  const [advertencias, establecerAdvertencias] = useState<AdvertenciaInteroperabilidad[]>([])
  const [ocupado, establecerOcupado] = useState(false)

  async function seleccionarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ""
    if (!archivo) return
    if (!window.confirm("Importar este XMI reemplazará el diagrama actual.")) return
    establecerOcupado(true)
    establecerEstado("Importando...")
    establecerAdvertencias([])
    try {
      const resultado = await importarModeloXmi(await archivo.text())
      alImportar(resultado.modelo)
      establecerAdvertencias(resultado.advertencias)
      establecerEstado("Importado correctamente")
    } catch (error) {
      establecerEstado(`Error: ${error instanceof Error ? error.message : "No se pudo importar el XMI."}`)
    } finally {
      establecerOcupado(false)
    }
  }

  async function descargar() {
    establecerOcupado(true)
    establecerEstado("Exportando...")
    try {
      await exportarModeloXmi(modelo)
      establecerEstado("XMI exportado")
    } catch (error) {
      establecerEstado(`Error: ${error instanceof Error ? error.message : "No se pudo exportar el XMI."}`)
    } finally {
      establecerOcupado(false)
    }
  }

  return (
    <section className="interoperability-panel" aria-labelledby="titulo-interoperabilidad-xmi">
      <h2 id="titulo-interoperabilidad-xmi">Interoperabilidad XMI</h2>
      <input
        ref={selector}
        data-testid="selector-xmi"
        type="file"
        accept=".xmi,.xml,application/xml,text/xml"
        onChange={seleccionarArchivo}
        hidden
      />
      <div className="interoperability-actions">
        <button type="button" disabled={ocupado} onClick={() => selector.current?.click()}>Importar XMI</button>
        <button type="button" disabled={ocupado} onClick={descargar}>Exportar XMI</button>
      </div>
      <p role="status">{estado}</p>
      {advertencias.length > 0 ? (
        <ul className="mapping-warnings" aria-label="Advertencias de importación">
          {advertencias.map((advertencia, indice) => (
            <li key={`${advertencia.codigo}-${advertencia.elementoId ?? indice}`}>{advertencia.mensaje}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
