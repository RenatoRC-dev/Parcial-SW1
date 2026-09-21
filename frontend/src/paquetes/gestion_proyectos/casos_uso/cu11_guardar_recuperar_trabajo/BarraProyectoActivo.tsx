import { ControlesPreferencias, usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function BarraProyectoActivo(props: { nombre: string; sucio: boolean; guardando: boolean; mensaje: string | null; alGuardar: () => void; alVolver: () => void }) {
  const { t } = usarPreferenciasUI()
  return <header className="project-toolbar">
    <div className="product-identity"><strong>SW1 Modeler</strong><span>{t("shell.producto")}</span></div>
    <div className="active-project"><span>{t("shell.proyecto")}</span><strong>{props.nombre}</strong><span className={`save-status ${props.sucio ? "is-dirty" : "is-saved"}`} data-testid="estado-guardado">{props.sucio ? t("proyectos.sucio") : t("proyectos.guardado")}</span></div>
    <div className="topbar-actions">
      <button type="button" className="secondary-action" onClick={props.alVolver}>{t("proyectos.mios")}</button>
      <button type="button" disabled={props.guardando || !props.sucio} onClick={props.alGuardar}>{props.guardando ? t("proyectos.guardando") : t("proyectos.guardar")}</button>
      <ControlesPreferencias />
    </div>
    {props.mensaje ? <p className="topbar-message" role="status">{props.mensaje}</p> : null}
  </header>
}
