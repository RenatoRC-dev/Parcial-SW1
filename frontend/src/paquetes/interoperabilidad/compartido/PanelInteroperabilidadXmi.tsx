import { useRef, useState, type ChangeEvent } from "react"
import type { ModeloUMLCanonico } from "../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { importarModeloXmi, type AdvertenciaInteroperabilidad } from "../casos_uso/cu06_importar_modelo_xmi/importarModeloXmi"
import { exportarModeloXmi } from "../casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi"
import { usarPreferenciasUI } from "../../../configuracion/PreferenciasUI"

interface PropiedadesPanelInteroperabilidadXmi {
  modelo: ModeloUMLCanonico
  alImportar: (modelo: ModeloUMLCanonico) => void
}

type EstadoXmi = "listo" | "importando" | "importado" | "exportando" | "exportado" | "error"

export function PanelInteroperabilidadXmi({ modelo, alImportar }: PropiedadesPanelInteroperabilidadXmi) {
  const { t } = usarPreferenciasUI()
  const selector = useRef<HTMLInputElement>(null)
  const [estado, establecerEstado] = useState<EstadoXmi>("listo")
  const [detalleError, establecerDetalleError] = useState<string | null>(null)
  const [advertencias, establecerAdvertencias] = useState<AdvertenciaInteroperabilidad[]>([])
  const [ocupado, establecerOcupado] = useState(false)

  async function seleccionarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ""
    if (!archivo) return
    if (!window.confirm(t("xmi.confirmar"))) return
    establecerOcupado(true)
    establecerEstado("importando")
    establecerDetalleError(null)
    establecerAdvertencias([])
    try {
      const resultado = await importarModeloXmi(await archivo.text())
      alImportar(resultado.modelo)
      establecerAdvertencias(resultado.advertencias)
      establecerEstado("importado")
    } catch (error) {
      establecerEstado("error")
      establecerDetalleError(error instanceof Error ? error.message : t("xmi.errorImportar"))
    } finally {
      establecerOcupado(false)
    }
  }

  async function descargar() {
    establecerOcupado(true)
    establecerEstado("exportando")
    establecerDetalleError(null)
    try {
      await exportarModeloXmi(modelo)
      establecerEstado("exportado")
    } catch (error) {
      establecerEstado("error")
      establecerDetalleError(error instanceof Error ? error.message : t("xmi.errorExportar"))
    } finally {
      establecerOcupado(false)
    }
  }

  return (
    <section className="interoperability-panel" aria-labelledby="titulo-interoperabilidad-xmi" aria-busy={ocupado}>
      <h2 id="titulo-interoperabilidad-xmi">{t("xmi.titulo")}</h2>
      <p className="feature-intro">{t("ux.xmiAyuda")}</p>
      <input
        ref={selector}
        data-testid="selector-xmi"
        type="file"
        accept=".xmi,.xml,application/xml,text/xml"
        onChange={seleccionarArchivo}
        hidden
      />
      <div className="feature-action-grid">
        <section><h3>{t("xmi.importar")}</h3><p>{t("ux.importarAyuda")}</p><button type="button" disabled={ocupado} onClick={() => selector.current?.click()}>{t("xmi.importar")}</button></section>
        <section><h3>{t("xmi.exportar")}</h3><p>{t("ux.exportarAyuda")}</p><button type="button" disabled={ocupado} onClick={descargar}>{t("xmi.exportar")}</button></section>
      </div>
      <p role="status">{estado === "error" ? `${t("xmi.error")}: ${detalleError ?? ""}` : t(`xmi.${estado}`)}</p>
      {advertencias.length > 0 ? (
        <ul className="mapping-warnings" aria-label={t("xmi.advertencias")}>
          {advertencias.map((advertencia, indice) => (
            <li key={`${advertencia.codigo}-${advertencia.elementoId ?? indice}`}>{advertencia.mensaje}</li>
          ))}
        </ul>
      ) : null}
      <details className="feature-details"><summary>{t("ux.compatibilidadXmi")}</summary><p>{t("ux.xmiLimites")}</p><p>{t("xmi.perfilAsociativo")}</p></details>
    </section>
  )
}
