export function BarraProyectoActivo(props: { nombre: string; sucio: boolean; guardando: boolean; mensaje: string | null; alGuardar: () => void; alVolver: () => void }) {
  return <div className="project-toolbar">
    <div><strong>{props.nombre}</strong><span data-testid="estado-guardado">{props.sucio ? "Cambios sin guardar" : "Guardado"}</span></div>
    <div><button type="button" onClick={props.alVolver}>Mis proyectos</button><button type="button" disabled={props.guardando || !props.sucio} onClick={props.alGuardar}>{props.guardando ? "Guardando…" : "Guardar"}</button></div>
    {props.mensaje ? <p role="status">{props.mensaje}</p> : null}
  </div>
}
