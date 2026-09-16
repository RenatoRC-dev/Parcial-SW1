import type { UMLModel } from "@tumaet/apollon"
import type { ResultadoAdaptacionApollon } from "../../../compartido/integracion_apollon/AdaptadorApollon"
import type { ResultadoValidacion } from "../../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { resumirModelo } from "../resumenModeloApollon"

interface PropiedadesInspectorModeloDesarrollo {
  modeloApollon: UMLModel | null
  resultadoCanonico: ResultadoAdaptacionApollon | null
  resultadoValidacion: ResultadoValidacion | null
  error: string | null
}

export function InspectorModeloDesarrollo({
  modeloApollon,
  resultadoCanonico,
  resultadoValidacion,
  error,
}: PropiedadesInspectorModeloDesarrollo) {
  const resumen = modeloApollon ? resumirModelo(modeloApollon) : null
  const modeloCanonico = resultadoCanonico?.modelo ?? null
  const advertencias = resultadoCanonico?.advertencias ?? []
  const cantidadAtributos =
    modeloCanonico?.clases.reduce(
      (total, clase) => total + clase.atributos.length,
      0
    ) ?? 0
  const cantidadErrores =
    resultadoValidacion?.diagnosticos.filter(
      (diagnostico) => diagnostico.severidad === "error"
    ).length ?? 0
  const cantidadAdvertencias =
    resultadoValidacion?.diagnosticos.filter(
      (diagnostico) => diagnostico.severidad === "advertencia"
    ).length ?? 0

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
          <section
            className="inspector-section"
            aria-labelledby="titulo-apollon"
          >
            <h3 id="titulo-apollon">Apollon</h3>
            <dl
              className="model-facts apollon-facts"
              data-testid="resumen-apollon"
            >
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
              <summary>Modelo Apollon (JSON)</summary>
              <pre>{JSON.stringify(modeloApollon, null, 2)}</pre>
            </details>
          </section>

          {modeloCanonico ? (
            <section
              className="inspector-section"
              aria-labelledby="titulo-modelo-canonico"
            >
              <h3 id="titulo-modelo-canonico">UML canónico</h3>
              <dl
                className="model-facts canonical-facts"
                data-testid="resumen-canonico"
              >
                <div>
                  <dt>Clases</dt>
                  <dd>{modeloCanonico.clases.length}</dd>
                </div>
                <div>
                  <dt>Atributos</dt>
                  <dd>{cantidadAtributos}</dd>
                </div>
                <div>
                  <dt>Relaciones</dt>
                  <dd>{modeloCanonico.relaciones.length}</dd>
                </div>
              </dl>

              {advertencias.length > 0 ? (
                <div className="mapping-warnings" role="status">
                  <strong>Advertencias de adaptación</strong>
                  <ul>
                    {advertencias.map((advertencia) => (
                      <li key={advertencia}>{advertencia}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <details className="model-json canonical-json">
                <summary>Modelo UML canónico (JSON)</summary>
                <pre>{JSON.stringify(modeloCanonico, null, 2)}</pre>
              </details>
            </section>
          ) : null}

          {resultadoValidacion ? (
            <section
              className="inspector-section validation-section"
              aria-labelledby="titulo-validacion"
              data-testid="resumen-validacion"
            >
              <h3 id="titulo-validacion">Validación</h3>
              <dl className="model-facts validation-facts">
                <div>
                  <dt>Estado</dt>
                  <dd
                    className={
                      resultadoValidacion.valido
                        ? "validation-valid"
                        : "validation-invalid"
                    }
                  >
                    {resultadoValidacion.valido ? "Válido" : "Inválido"}
                  </dd>
                </div>
                <div>
                  <dt>Errores</dt>
                  <dd>{cantidadErrores}</dd>
                </div>
                <div>
                  <dt>Advertencias</dt>
                  <dd>{cantidadAdvertencias}</dd>
                </div>
              </dl>

              {resultadoValidacion.diagnosticos.length > 0 ? (
                <details className="validation-diagnostics">
                  <summary>Diagnósticos</summary>
                  <ul>
                    {resultadoValidacion.diagnosticos.map(
                      (diagnostico, indice) => (
                        <li
                          key={`${diagnostico.codigo}-${diagnostico.elementoId ?? indice}`}
                          className={`diagnostic-${diagnostico.severidad}`}
                        >
                          <code>{diagnostico.codigo}</code>: {diagnostico.mensaje}
                        </li>
                      )
                    )}
                  </ul>
                </details>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </aside>
  )
}
