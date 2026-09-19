import { useEffect, useState } from "react"
import type { Proyecto, ResumenProyecto } from "../../compartido/Proyecto"
import { abrirProyecto, crearProyecto, listarProyectos } from "../../compartido/clienteProyectos"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

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

  return <main className="project-home">
    <header><p className="eyebrow">SW1 · {t("paquete.proyectos")} · CU01</p><h1>{t("proyectos.titulo")}</h1><p>{t("proyectos.descripcion")}</p></header>
    <section className="project-create">
      <h2>{t("proyectos.crear")}</h2>
      <label>{t("proyectos.nombre")}<input aria-label={t("proyectos.nombre")} value={nombre} maxLength={80} onChange={(e) => establecerNombre(e.target.value)} /></label>
      <button type="button" disabled={ocupado || nombre.trim().length === 0} onClick={crear}>{t("proyectos.crear")}</button>
    </section>
    <section className="project-list"><h2>{t("proyectos.mios")}</h2>
      {proyectos.length === 0 ? <p>{t("proyectos.vacio")}</p> : <ul>{proyectos.map((proyecto) => <li key={proyecto.id}>
        <div><strong>{proyecto.nombre}</strong><small>{t("proyectos.actualizado")}: {new Date(proyecto.actualizadoEn).toLocaleString(idioma)}</small></div>
        <button type="button" disabled={ocupado} onClick={() => abrir(proyecto.id)}>{t("proyectos.abrir")}</button>
      </li>)}</ul>}
    </section>
    {error ? <p className="error-banner" role="alert">{error}</p> : null}
  </main>
}
