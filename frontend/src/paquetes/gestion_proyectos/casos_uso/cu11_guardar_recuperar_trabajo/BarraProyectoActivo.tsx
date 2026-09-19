import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function BarraProyectoActivo(props: { nombre: string; sucio: boolean; guardando: boolean; mensaje: string | null; alGuardar: () => void; alVolver: () => void }) {
  const { t } = usarPreferenciasUI()
  return <div className="project-toolbar">
    <div><strong>{props.nombre}</strong><span data-testid="estado-guardado">{props.sucio ? t("proyectos.sucio") : t("proyectos.guardado")}</span></div>
    <div><button type="button" onClick={props.alVolver}>{t("proyectos.mios")}</button><button type="button" disabled={props.guardando || !props.sucio} onClick={props.alGuardar}>{props.guardando ? t("proyectos.guardando") : t("proyectos.guardar")}</button></div>
    {props.mensaje ? <p role="status">{props.mensaje}</p> : null}
  </div>
}
