import { ControlesPreferencias, usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function BarraProyectoActivo(props: { nombre: string; nombreParticipante: string; sucio: boolean; guardando: boolean; mensaje: string | null; conflictoPendiente: boolean; alGuardar: () => void; alVolver: () => void; alMostrarConflicto: () => void }) {
  const { t } = usarPreferenciasUI()
  return <header className="project-toolbar">
    <div className="product-identity"><strong>NexoCASE</strong><span>{t("shell.producto")}</span></div>
    <div className="active-project"><span>{t("shell.proyecto")}</span><strong>{props.nombre}</strong><span>{props.nombreParticipante}</span><span className={`save-status ${props.sucio ? "is-dirty" : "is-saved"}`} data-testid="estado-guardado">{props.sucio ? t("proyectos.sucio") : t("proyectos.guardado")}</span></div>
    <div className="topbar-actions">
      <button type="button" className="secondary-action" onClick={props.alVolver}>Volver</button>
      {props.conflictoPendiente ? <button type="button" className="conflict-action" onClick={props.alMostrarConflicto}>{t("proyectos.revisarConflicto")}</button> : null}
      <button type="button" disabled={props.guardando || !props.sucio} onClick={props.alGuardar}>{props.guardando ? t("proyectos.guardando") : t("proyectos.guardar")}</button>
      <ControlesPreferencias />
    </div>
    {props.mensaje ? <p className="topbar-message" role="status">{props.mensaje}</p> : null}
  </header>
}
