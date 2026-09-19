import { useEffect, useState } from "react"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { analizarImagenUML } from "./analizarImagenUML"
import { aplicarCandidatoImagen } from "./aplicarCandidatoImagen"
import type { CandidatoModeloUMLImagen } from "./CandidatoModeloUMLImagen"
import { evaluarAtributoCandidato } from "./evaluarAtributoCandidato"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

interface PropiedadesPanelModeladoDesdeImagen {
  modelo: ModeloUMLCanonico
  alAplicarModelo: (modelo: ModeloUMLCanonico) => void
}

export function PanelModeladoDesdeImagen({ modelo, alAplicarModelo }: PropiedadesPanelModeladoDesdeImagen) {
  const { t } = usarPreferenciasUI()
  const [imagen, establecerImagen] = useState<File | null>(null)
  const [urlVistaPrevia, establecerUrlVistaPrevia] = useState<string | null>(null)
  const [candidato, establecerCandidato] = useState<CandidatoModeloUMLImagen | null>(null)
  const [estado, establecerEstado] = useState<"idle" | "selected" | "analizando" | "candidato" | "sin_modelo" | "error" | "aplicando">("idle")
  const [mensaje, establecerMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (!imagen || typeof URL.createObjectURL !== "function") {
      establecerUrlVistaPrevia(null)
      return
    }
    const url = URL.createObjectURL(imagen)
    establecerUrlVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [imagen])

  const seleccionar = (archivo: File | null) => {
    establecerImagen(archivo)
    establecerCandidato(null)
    establecerMensaje(null)
    establecerEstado(archivo ? "selected" : "idle")
  }

  const analizar = async () => {
    if (!imagen) return
    establecerEstado("analizando")
    establecerMensaje(null)
    try {
      const respuesta = await analizarImagenUML(imagen)
      establecerMensaje(respuesta.mensaje)
      if (respuesta.resultado === "sin_modelo") {
        establecerCandidato(null)
        establecerEstado("sin_modelo")
      } else {
        establecerCandidato(respuesta.candidato)
        establecerEstado("candidato")
      }
    } catch (error) {
      establecerEstado("error")
      establecerMensaje(error instanceof Error ? error.message : t("imagen.errorAnalisis"))
    }
  }

  const confirmar = () => {
    if (!candidato) return
    establecerEstado("aplicando")
    try {
      alAplicarModelo(aplicarCandidatoImagen(modelo, candidato))
      establecerCandidato(null)
      establecerImagen(null)
      establecerEstado("idle")
      establecerMensaje(t("imagen.agregado"))
    } catch (error) {
      establecerEstado("error")
      establecerMensaje(error instanceof Error ? error.message : t("imagen.errorAplicacion"))
    }
  }

  const cancelar = () => {
    establecerCandidato(null)
    establecerEstado(imagen ? "selected" : "idle")
    establecerMensaje(t("imagen.descartado"))
  }

  const nombreClase = (ref: string) => candidato?.clases.find((clase) => clase.refTemporal === ref)?.nombre ?? ref
  const describirAtributo = (nombreClaseActual: string, atributo: CandidatoModeloUMLImagen["clases"][number]["atributos"][number]) => {
    const importabilidad = evaluarAtributoCandidato(atributo)
    if (importabilidad.importable) return `${atributo.nombre}: ${importabilidad.tipo}`
    return importabilidad.motivo === "tipo_no_visible"
      ? `${atributo.nombre} — ${t("imagen.tipoNoVisible")} · ${t("imagen.noImportara")}. ${t("imagen.atributo")} '${atributo.nombre}' ${t("imagen.deClase")} '${nombreClaseActual}' ${t("imagen.sinTipoDetalle")}`
      : `${atributo.nombre}: ${atributo.tipoDato?.trim()} · ${t("imagen.tipoNoSoportado")} · ${t("imagen.noImportara")}.`
  }

  return (
    <aside className="image-ai-panel" data-testid="panel-modelado-imagen">
      <h2>{t("imagen.titulo")}</h2>
      <label htmlFor="imagen-uml">{t("imagen.seleccionar")}</label>
      <input id="imagen-uml" type="file" accept="image/png,image/jpeg" disabled={estado === "analizando" || estado === "aplicando"} onChange={(evento) => seleccionar(evento.target.files?.[0] ?? null)} />
      {imagen ? <p className="image-file">{t("imagen.seleccionada")}: <strong>{imagen.name}</strong> ({Math.ceil(imagen.size / 1024)} KB)</p> : null}
      {urlVistaPrevia ? <img className="image-preview" src={urlVistaPrevia} alt={t("imagen.vistaPrevia")} /> : null}
      <button type="button" disabled={!imagen || estado === "analizando" || estado === "aplicando"} onClick={() => void analizar()}>
        {estado === "analizando" ? t("imagen.analizando") : t("imagen.analizar")}
      </button>
      {mensaje ? <p role="status" className={estado === "error" ? "image-error" : undefined}>{mensaje}</p> : null}
      {candidato ? (
        <section className="candidate-preview" aria-label={t("imagen.candidatoAria")}>
          <h3>{t("imagen.candidato")}</h3>
          <p>{t("imagen.clasesDetectadas")}: {candidato.clases.length} · {t("imagen.relacionesDetectadas")}: {candidato.relaciones.length}</p>
          {candidato.clases.map((clase) => (
            <div className="candidate-class" key={clase.refTemporal}>
              <strong>{clase.nombre}</strong>
              {clase.atributos.length > 0 ? <ul>{clase.atributos.map((atributo) => <li key={atributo.refTemporal}>{describirAtributo(clase.nombre, atributo)}</li>)}</ul> : <p>{t("imagen.sinAtributos")}</p>}
            </div>
          ))}
          {candidato.relaciones.map((relacion) => <p className="candidate-relation" key={relacion.refTemporal}>{nombreClase(relacion.origenRef)} [{relacion.multiplicidadOrigen}] — [{relacion.multiplicidadDestino}] {nombreClase(relacion.destinoRef)}{relacion.rolOrigen || relacion.rolDestino ? ` · ${t("imagen.roles")}: ${relacion.rolOrigen ?? "—"} / ${relacion.rolDestino ?? "—"}` : ""}</p>)}
          {candidato.advertencias.length > 0 ? <div className="candidate-warnings"><strong>{t("imagen.advertencias")}</strong><ul>{candidato.advertencias.map((advertencia, indice) => <li key={`${indice}-${advertencia}`}>{advertencia}</li>)}</ul></div> : null}
          <div className="candidate-actions">
            <button type="button" disabled={estado === "aplicando"} onClick={confirmar}>{t("imagen.agregar")}</button>
            <button type="button" disabled={estado === "aplicando"} onClick={cancelar}>{t("imagen.cancelar")}</button>
          </div>
        </section>
      ) : null}
      <p className="ai-note">{t("imagen.nota")}</p>
    </aside>
  )
}
