import { useState } from "react"
import type { AccesoProyectoActivo, Proyecto, RespuestaCrearProyecto } from "../../compartido/Proyecto"
import { abrirProyecto, crearProyecto, ErrorApiProyecto, unirseProyecto } from "../../compartido/clienteProyectos"
import {
  guardarProyectoReciente,
  listarProyectosRecientes,
  quitarProyectoReciente,
  type ProyectoReciente,
} from "../../compartido/AlmacenProyectosRecientes"
import { ControlesPreferencias, usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

type VistaAcceso = "inicio" | "crear" | "unirse" | "codigo"

export function PanelProyectos({ alAcceder }: {
  alAcceder: (proyecto: Proyecto, acceso: AccesoProyectoActivo) => void
}) {
  const { idioma, t } = usarPreferenciasUI()
  const [recientes, establecerRecientes] = useState<ProyectoReciente[]>(listarProyectosRecientes)
  const [vista, establecerVista] = useState<VistaAcceso>("inicio")
  const [nombreProyecto, establecerNombreProyecto] = useState("")
  const [nombreParticipante, establecerNombreParticipante] = useState("")
  const [codigo, establecerCodigo] = useState("")
  const [creadoPendiente, establecerCreadoPendiente] = useState<RespuestaCrearProyecto | null>(null)
  const [error, establecerError] = useState<string | null>(null)
  const [mensajeCopia, establecerMensajeCopia] = useState<string | null>(null)
  const [ocupado, establecerOcupado] = useState(false)

  const iniciar = (nuevaVista: VistaAcceso) => {
    establecerVista(nuevaVista); establecerError(null); establecerMensajeCopia(null)
  }
  const accesoDesdeRespuesta = (proyecto: Proyecto, participante: { id: string; nombreVisible: string }, credencial: string): AccesoProyectoActivo => ({
    projectId: proyecto.id,
    participantId: participante.id,
    displayName: participante.nombreVisible,
    credential: credencial,
  })
  const recordar = (proyecto: Proyecto, acceso: AccesoProyectoActivo) => {
    establecerRecientes(guardarProyectoReciente({
      projectId: proyecto.id,
      projectName: proyecto.nombre,
      participantId: acceso.participantId,
      displayName: acceso.displayName,
      credential: acceso.credential,
      lastOpenedAt: new Date().toISOString(),
    }))
  }
  const crear = async () => {
    establecerOcupado(true); establecerError(null)
    try {
      const respuesta = await crearProyecto(nombreProyecto, nombreParticipante)
      recordar(respuesta.proyecto, accesoDesdeRespuesta(respuesta.proyecto, respuesta.participante, respuesta.credencial))
      establecerCreadoPendiente(respuesta); establecerVista("codigo")
    } catch (e) { establecerError((e as Error).message) } finally { establecerOcupado(false) }
  }
  const unirse = async () => {
    establecerOcupado(true); establecerError(null)
    try {
      const respuesta = await unirseProyecto(codigo, nombreParticipante)
      const acceso = accesoDesdeRespuesta(respuesta.proyecto, respuesta.participante, respuesta.credencial)
      recordar(respuesta.proyecto, acceso)
      alAcceder(respuesta.proyecto, acceso)
    } catch (e) { establecerError((e as Error).message) } finally { establecerOcupado(false) }
  }
  const abrirReciente = async (reciente: ProyectoReciente) => {
    establecerOcupado(true); establecerError(null)
    try {
      const proyecto = await abrirProyecto(reciente.projectId, reciente.credential)
      const acceso: AccesoProyectoActivo = {
        projectId: reciente.projectId,
        participantId: reciente.participantId,
        displayName: reciente.displayName,
        credential: reciente.credential,
      }
      recordar(proyecto, acceso)
      alAcceder(proyecto, acceso)
    } catch (e) {
      if (e instanceof ErrorApiProyecto && (e.estado === 401 || e.estado === 403)) {
        establecerRecientes(quitarProyectoReciente(reciente.projectId))
        establecerVista("unirse")
      }
      establecerError((e as Error).message)
    } finally { establecerOcupado(false) }
  }
  const copiarCodigo = async () => {
    if (!creadoPendiente) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard no disponible")
      await navigator.clipboard.writeText(creadoPendiente.codigoAcceso)
      establecerMensajeCopia(t("proyectos.codigoCopiado"))
    } catch { establecerMensajeCopia(t("proyectos.copiaManual")) }
  }
  const entrarCreado = () => {
    if (!creadoPendiente) return
    alAcceder(
      creadoPendiente.proyecto,
      accesoDesdeRespuesta(creadoPendiente.proyecto, creadoPendiente.participante, creadoPendiente.credencial),
    )
  }

  return <div className="projects-screen">
    <header className="projects-topbar"><div className="product-identity"><strong>NexoCASE</strong><span>{t("shell.producto")}</span></div><ControlesPreferencias /></header>
    <main className="project-home">
      <header className="projects-heading"><div><p className="eyebrow">{t("proyectos.gestion")}</p><h1>{t("proyectos.titulo")}</h1><p>{t("proyectos.descripcionAcceso")}</p></div></header>

      {vista === "inicio" ? <section className="project-access-actions" aria-label={t("proyectos.acceso")}>
        <button type="button" className="primary-create" onClick={() => iniciar("crear")}>{t("proyectos.crear")}</button>
        <button type="button" onClick={() => iniciar("unirse")}>{t("proyectos.unirse")}</button>
      </section> : null}

      {vista === "crear" ? <form className="project-create" aria-labelledby="titulo-crear-proyecto" onSubmit={(evento) => { evento.preventDefault(); if (!ocupado && nombreProyecto.trim() && nombreParticipante.trim()) void crear() }}>
        <div><h2 id="titulo-crear-proyecto">{t("proyectos.crear")}</h2><p>{t("proyectos.crearDescripcion")}</p></div>
        <div className="project-create-controls">
          <label>{t("proyectos.nombre")}<input aria-label={t("proyectos.nombre")} value={nombreProyecto} maxLength={80} onChange={(e) => establecerNombreProyecto(e.target.value)} /></label>
          <label>{t("proyectos.nombreParticipante")}<input aria-label={t("proyectos.nombreParticipante")} value={nombreParticipante} maxLength={60} onChange={(e) => establecerNombreParticipante(e.target.value)} /></label>
          <div className="project-form-actions"><button type="button" className="secondary-action" onClick={() => iniciar("inicio")}>{t("proyectos.cancelar")}</button><button type="submit" disabled={ocupado || !nombreProyecto.trim() || !nombreParticipante.trim()}>{ocupado ? t("proyectos.creando") : t("proyectos.crear")}</button></div>
        </div>
      </form> : null}

      {vista === "unirse" ? <form className="project-create" aria-labelledby="titulo-unirse-proyecto" onSubmit={(evento) => { evento.preventDefault(); if (!ocupado && codigo.trim() && nombreParticipante.trim()) void unirse() }}>
        <div><h2 id="titulo-unirse-proyecto">{t("proyectos.unirse")}</h2><p>{t("proyectos.unirseDescripcion")}</p></div>
        <div className="project-create-controls">
          <label>{t("proyectos.codigo")}<input aria-label={t("proyectos.codigo")} value={codigo} autoComplete="off" onChange={(e) => establecerCodigo(e.target.value)} /></label>
          <label>{t("proyectos.nombreParticipante")}<input aria-label={t("proyectos.nombreParticipante")} value={nombreParticipante} maxLength={60} onChange={(e) => establecerNombreParticipante(e.target.value)} /></label>
          <div className="project-form-actions"><button type="button" className="secondary-action" onClick={() => iniciar("inicio")}>{t("proyectos.cancelar")}</button><button type="submit" disabled={ocupado || !codigo.trim() || !nombreParticipante.trim()}>{ocupado ? t("proyectos.uniendo") : t("proyectos.entrar")}</button></div>
        </div>
      </form> : null}

      {vista === "codigo" && creadoPendiente ? <section className="project-created" aria-labelledby="titulo-proyecto-creado">
        <p className="eyebrow">{t("proyectos.creado")}</p><h2 id="titulo-proyecto-creado">{t("proyectos.compartirCodigo")}</h2>
        <label>{t("proyectos.codigoUnirse")}<output className="project-access-code">{creadoPendiente.codigoAcceso}</output></label>
        <p>{t("proyectos.codigoEfimero")}</p>
        <div className="project-form-actions"><button type="button" className="secondary-action" onClick={copiarCodigo}>{t("proyectos.copiarCodigo")}</button><button type="button" onClick={entrarCreado}>{t("proyectos.entrar")}</button></div>
        {mensajeCopia ? <p role="status">{mensajeCopia}</p> : null}
      </section> : null}

      <section className="project-list"><div className="section-heading"><div><p className="eyebrow">{t("proyectos.dispositivo")}</p><h2>{t("proyectos.mios")}</h2></div><span>{recientes.length}</span></div>
        {recientes.length === 0 ? <div className="project-empty"><strong>{t("proyectos.vacio")}</strong><p>{t("proyectos.vacioAyuda")}</p></div> : <ul>{recientes.map((proyecto) => <li key={proyecto.projectId}>
          <div className="project-card-icon" aria-hidden="true">UML</div><div className="project-card-copy"><strong>{proyecto.projectName}</strong><small>{proyecto.displayName} · {new Date(proyecto.lastOpenedAt).toLocaleString(idioma)}</small></div>
          <button type="button" disabled={ocupado} onClick={() => abrirReciente(proyecto)}>{t("proyectos.abrir")}</button>
        </li>)}</ul>}
      </section>
      {error ? <p className="error-banner" role="alert">{error}</p> : null}
    </main>
  </div>
}
