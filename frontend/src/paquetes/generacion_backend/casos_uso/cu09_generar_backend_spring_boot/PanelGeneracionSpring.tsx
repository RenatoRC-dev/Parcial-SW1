import { useState } from "react"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { descargarBackendGenerado } from "../cu10_obtener_backend_generado/descargarBackendGenerado"
import type { ResultadoAptitudGeneracion } from "./EvaluadorAptitudGeneracionSpring"

interface PropiedadesPanelGeneracionSpring {
  modelo: ModeloUMLCanonico
  validacion: ResultadoValidacion
  aptitud: ResultadoAptitudGeneracion
  alGenerar?: (modelo: ModeloUMLCanonico) => Promise<void>
}

type EstadoGeneracion = "inactivo" | "generando" | "exito" | "error"

export function PanelGeneracionSpring({ modelo, validacion, aptitud, alGenerar = descargarBackendGenerado }: PropiedadesPanelGeneracionSpring) {
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
      establecerMensajeError(error instanceof Error ? error.message : "No se pudo generar el backend.")
    }
  }

  return (
    <section className="generation-panel" aria-labelledby="titulo-generacion" data-testid="panel-generacion">
      <p className="eyebrow">CU09 / CU10</p>
      <h2 id="titulo-generacion">Generación Spring Boot</h2>
      <dl className="generation-status">
        <div><dt>Modelo UML</dt><dd>{validacion.valido ? "Válido" : "Inválido"}</dd></div>
        <div><dt>Generador</dt><dd>{aptitud.apto ? "Apto" : "No apto"}</dd></div>
      </dl>
      {aptitud.motivos.length > 0 ? <ul className="generation-reasons">{aptitud.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul> : null}
      <button type="button" onClick={generar} disabled={!aptitud.apto || estado === "generando"}>
        {estado === "generando" ? "Generando…" : "Generar backend Spring Boot"}
      </button>
      {estado === "exito" ? <p className="generation-success" role="status">Backend generado y descargado.</p> : null}
      {estado === "error" ? <p className="generation-error" role="alert">Error: {mensajeError}</p> : null}
    </section>
  )
}
