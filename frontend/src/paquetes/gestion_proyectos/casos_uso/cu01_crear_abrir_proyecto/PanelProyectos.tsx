import { useEffect, useState } from "react"
import type { Proyecto, ResumenProyecto } from "../../compartido/Proyecto"
import { abrirProyecto, crearProyecto, listarProyectos } from "../../compartido/clienteProyectos"
import { ControlesPreferencias, usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function PanelProyectos({ alAbrir }: { alAbrir: (proyecto: Proyecto) => void }) {
  const { idioma, t } = usarPreferenciasUI()
  const [proyectos, establecerProyectos] = useState<ResumenProyecto[]>([])
  const [nombre, establecerNombre] = useState("")
  const [error, establecerError] = useState<string | null>(null)
  const [ocupado, establecerOcupado] = useState(false)

  useEffect(() => { listarProyectos().then(establecerProyectos).catch((e: Error) => establecerError(e.message)) }, [])

  const crear = async () => {
    setBusy(true)
    try { alAbrir(await crearProyecto(nombre)); establecerNombre("") } catch (e) { establecerError((e as Error).message) } finally { setBusy(false) }
  }
  const abrir = async (id: string) => {
    setBusy(true)
    try { alAbrir(await abrirProyecto(id)) } catch (e) { establecerError((e as Error).message) } finally { setBusy(false) }
  }
  const setBusy = (valor: boolean) => { establecerOcupado(valor); if (valor) establecerError(null) }

  return <div className="projects-screen">
    <header className="projects-topbar"><div className="product-identity"><strong>SW1 Modeler</strong><span>{t("shell.producto")}</span></div><ControlesPreferencias /></header>
    <main className="project-home">
      <header className="projects-heading"><div><p className="eyebrow">{t("paquete.proyectos")}</p><h1>{t("proyectos.titulo")}</h1><p>{t("proyectos.descripcion")}</p></div></header>
      <section className="project-create" aria-labelledby="titulo-crear-proyecto">
        <div><h2 id="titulo-crear-proyecto">{t("proyectos.nuevo")}</h2><p>{t("proyectos.nuevoDescripcion")}</p></div>
        <div className="project-create-controls"><label>{t("proyectos.nombre")}<input aria-label={t("proyectos.nombre")} value={nombre} maxLength={80} placeholder={t("proyectos.nombrePlaceholder")} onChange={(e) => establecerNombre(e.target.value)} /></label><button type="button" className="primary-create" disabled={ocupado || nombre.trim().length === 0} onClick={crear}>{t("proyectos.crear")}</button></div>
      </section>
      <section className="project-list"><div className="section-heading"><div><p className="eyebrow">{t("proyectos.recientes")}</p><h2>{t("proyectos.mios")}</h2></div><span>{proyectos.length}</span></div>
        {proyectos.length === 0 ? <div className="project-empty"><strong>{t("proyectos.vacio")}</strong><p>{t("proyectos.vacioAyuda")}</p></div> : <ul>{proyectos.map((proyecto) => <li key={proyecto.id}>
          <div className="project-card-icon" aria-hidden="true">UML</div><div className="project-card-copy"><strong>{proyecto.nombre}</strong><small>{t("proyectos.actualizado")}: {new Date(proyecto.actualizadoEn).toLocaleString(idioma)}</small></div>
          <button type="button" disabled={ocupado} onClick={() => abrir(proyecto.id)}>{t("proyectos.abrir")}</button>
        </li>)}</ul>}
      </section>
      {error ? <p className="error-banner" role="alert">{error}</p> : null}
    </main>
  </div>
}
