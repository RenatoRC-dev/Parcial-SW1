import type { UMLModel } from "@tumaet/apollon"
import { resumirModelo } from "../resumenModeloApollon"

interface PropiedadesInspectorModeloDesarrollo {
  modelo: UMLModel | null
  error: string | null
}

export function InspectorModeloDesarrollo({
  modelo,
  error,
}: PropiedadesInspectorModeloDesarrollo) {
  const resumen = modelo ? resumirModelo(modelo) : null

  return (
    <aside className="model-inspector" aria-labelledby="titulo-inspector-modelo">
      <div className="inspector-heading">
        <p className="eyebrow">Evidencia de integración</p>
        <h2 id="titulo-inspector-modelo">Inspector de Modelo — Desarrollo</h2>
      </div>

      {error ? (
        <p className="inspector-state inspector-state-error" role="alert">
          Modelo no disponible: {error}
        </p>
      ) : null}

      {!resumen && !error ? (
        <p className="inspector-state">Esperando el modelo del editor…</p>
      ) : null}

      {resumen ? (
        <>
          <dl className="model-facts">
            <div>
              <dt>Id del modelo</dt>
              <dd title={resumen.id}>{resumen.id}</dd>
            </div>
            <div>
              <dt>Versión del modelo</dt>
              <dd>{resumen.version}</dd>
            </div>
            <div>
              <dt>Tipo de diagrama</dt>
              <dd>{resumen.tipoDiagrama}</dd>
            </div>
            <div>
              <dt>Nodos</dt>
              <dd>{resumen.cantidadNodos}</dd>
            </div>
            <div>
              <dt>Clases</dt>
              <dd>{resumen.cantidadClases}</dd>
            </div>
            <div>
              <dt>Relaciones</dt>
              <dd>{resumen.cantidadRelaciones}</dd>
            </div>
          </dl>

          <details className="model-json">
            <summary>Modelo UML estructurado (JSON)</summary>
            <pre>{JSON.stringify(modelo, null, 2)}</pre>
          </details>
        </>
      ) : null}
    </aside>
  )
}

