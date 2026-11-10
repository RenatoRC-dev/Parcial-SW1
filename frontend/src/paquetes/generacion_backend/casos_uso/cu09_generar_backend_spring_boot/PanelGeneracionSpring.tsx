import { useState } from "react"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { descargarBackendGenerado } from "../cu10_obtener_backend_generado/descargarBackendGenerado"
import type { ResultadoAptitudGeneracion } from "./EvaluadorAptitudGeneracionSpring"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

interface PropiedadesPanelGeneracionSpring {
  modelo: ModeloUMLCanonico
  validacion: ResultadoValidacion
  aptitud: ResultadoAptitudGeneracion
  alGenerar?: (modelo: ModeloUMLCanonico) => Promise<void>
}

type EstadoGeneracion = "inactivo" | "generando" | "exito" | "error"

export function PanelGeneracionSpring({ modelo, validacion, aptitud, alGenerar = descargarBackendGenerado }: PropiedadesPanelGeneracionSpring) {
  const { t } = usarPreferenciasUI()
  const [estado, establecerEstado] = useState<EstadoGeneracion>("inactivo")
  const [mensajeError, establecerMensajeError] = useState("")

  async function generar() {
    establecerEstado("generando")
    establecerMensajeError("")
    try {
      await alGenerar(modelo)
      establecerEstado("exito")
    } catch (error) {
      establecerEstado("error")
      establecerMensajeError(error instanceof Error ? error.message : t("generacion.errorGenerar"))
    }
  }

  return (
    <section className="generation-panel" aria-labelledby="titulo-generacion" data-testid="panel-generacion" aria-busy={estado === "generando"}>
      <h2 id="titulo-generacion">{t("generacion.titulo")}</h2>
      <p className="feature-intro">{t("ux.generacionAyuda")}</p>
      <dl className="generation-status">
        <div><dt>{t("generacion.modelo")}</dt><dd>{validacion.valido ? t("generacion.valido") : t("generacion.invalido")}</dd></div>
        <div><dt>{t("generacion.generador")}</dt><dd>{aptitud.apto ? t("generacion.apto") : t("generacion.noApto")}</dd></div>
      </dl>
      <div className="feature-actions">
        <button type="button" onClick={generar} disabled={!aptitud.apto || estado === "generando"}>
          {estado === "generando" ? t("generacion.generando") : t("generacion.generar")}
        </button>
      </div>
      {estado === "exito" ? <p className="generation-success" role="status">{t("generacion.exito")}</p> : null}
      {estado === "error" ? <p className="generation-error" role="alert">{t("generacion.error")}: {mensajeError}</p> : null}
      {aptitud.motivos.length > 0 ? <ul className="generation-reasons">{aptitud.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul> : null}
      {aptitud.advertencias.length > 0 ? <ul className="generation-warnings">{aptitud.advertencias.map((advertencia) => (
        <li key={`${advertencia.codigo}-${advertencia.relacion}`}>
          {t("generacion.minimoColeccionPrefijo")} {advertencia.relacion} {t("generacion.minimoColeccionSufijo")}
        </li>
      ))}</ul> : null}
      <details className="feature-details"><summary>{t("ux.alcanceGeneracion")}</summary><p>{t("ux.generacionLimites")}</p></details>
    </section>
  )
}
