import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function PanelConflictoRevision({ recargando, alCargarVersionGuardada, alSeguirRevisando }: {
  recargando: boolean
  alCargarVersionGuardada: () => void
  alSeguirRevisando: () => void
}) {
  const { t } = usarPreferenciasUI()
  return <section className="revision-conflict" role="alertdialog" aria-labelledby="titulo-conflicto-revision">
    <div>
      <p className="eyebrow">{t("proyectos.conflictoEtiqueta")}</p>
      <h2 id="titulo-conflicto-revision">{t("proyectos.conflictoTitulo")}</h2>
      <p>{t("proyectos.conflictoDetalle")}</p>
    </div>
    <div className="project-form-actions">
      <button type="button" className="secondary-action" disabled={recargando} onClick={alSeguirRevisando}>{t("proyectos.seguirRevisando")}</button>
      <button type="button" disabled={recargando} onClick={alCargarVersionGuardada}>{recargando ? t("proyectos.cargandoVersion") : t("proyectos.cargarVersion")}</button>
    </div>
  </section>
}
