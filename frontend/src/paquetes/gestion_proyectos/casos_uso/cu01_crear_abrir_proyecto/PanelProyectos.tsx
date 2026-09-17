import { useEffect, useState } from "react"
import type { Proyecto, ResumenProyecto } from "../../compartido/Proyecto"
import { abrirProyecto, crearProyecto, listarProyectos } from "../../compartido/clienteProyectos"

export function PanelProyectos({ alAbrir }: { alAbrir: (proyecto: Proyecto) => void }) {
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
    <header><p className="eyebrow">SW1 · Gestión de Proyectos · CU01</p><h1>Proyectos de modelado</h1><p>Crea un proyecto o recupera uno guardado para comenzar a modelar.</p></header>
    <section className="project-create">
      <h2>Crear proyecto</h2>
      <label>Nombre del proyecto<input aria-label="Nombre del proyecto" value={nombre} maxLength={80} onChange={(e) => establecerNombre(e.target.value)} /></label>
      <button type="button" disabled={ocupado || nombre.trim().length === 0} onClick={crear}>Crear proyecto</button>
    </section>
    <section className="project-list"><h2>Mis proyectos</h2>
      {proyectos.length === 0 ? <p>No hay proyectos guardados.</p> : <ul>{proyectos.map((proyecto) => <li key={proyecto.id}>
        <div><strong>{proyecto.nombre}</strong><small>Actualizado: {new Date(proyecto.actualizadoEn).toLocaleString()}</small></div>
        <button type="button" disabled={ocupado} onClick={() => abrir(proyecto.id)}>Abrir</button>
      </li>)}</ul>}
    </section>
    {error ? <p className="error-banner" role="alert">{error}</p> : null}
  </main>
}

