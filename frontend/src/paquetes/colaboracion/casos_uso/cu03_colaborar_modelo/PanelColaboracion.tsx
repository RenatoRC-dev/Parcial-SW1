import { useEffect, useRef, useState } from "react"
import type { ApollonEditor, CollaboratorInfo } from "@tumaet/apollon"
import { conectarColaboracionApollon, type ConexionColaboracion, type EstadoConexionColaboracion } from "./conectarColaboracionApollon"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import type { AccesoProyectoActivo } from "../../../gestion_proyectos/compartido/Proyecto"

export function PanelColaboracion({ editor, acceso, habilitada }: {
  editor: ApollonEditor | null
  acceso: AccesoProyectoActivo
  habilitada: boolean
}) {
  const { t } = usarPreferenciasUI()
  const [estado, establecerEstado] = useState<EstadoConexionColaboracion>("desconectado")
  const [participantes, establecerParticipantes] = useState<CollaboratorInfo[]>([])
  const [error, establecerError] = useState<string | null>(null)
  const conexion = useRef<ConexionColaboracion | null>(null)

  useEffect(() => {
    conexion.current?.desconectar()
    conexion.current = null
    establecerParticipantes([])
    establecerEstado("desconectado")
    if (!editor || !habilitada) return
    establecerError(null)
    conexion.current = conectarColaboracionApollon({
      editor,
      projectId: acceso.projectId,
      credential: acceso.credential,
      alCambiarEstado: establecerEstado,
      alCambiarParticipantes: establecerParticipantes,
      alOcurrirError: establecerError,
    })
    return () => { conexion.current?.desconectar(); conexion.current = null }
  }, [acceso.credential, acceso.projectId, editor, habilitada])

  return <aside className="collaboration-panel" data-testid="panel-colaboracion">
    <h2>{t("colaboracion.titulo")}</h2>
    <p role="status">{t("colaboracion.estado")}: <strong>{t(`colaboracion.${estado}`)}</strong></p>
    <p data-testid="cantidad-participantes">{t("colaboracion.participantes")}: {participantes.length}</p>
    {participantes.length > 0 ? <ul aria-label={t("colaboracion.lista")}>{participantes.map((participante) => <li key={participante.id}><span className="participant-color" style={{ backgroundColor: participante.color }} />{participante.name}{participante.isLocal ? ` (${t("colaboracion.tu")})` : ""}</li>)}</ul> : null}
    {participantes.length === 0 ? <p className="collaboration-empty">{t("colaboracion.sinParticipantes")}</p> : null}
    {error ? <p className="collaboration-error" role="alert">{error}</p> : null}
    <p className="collaboration-note">{t("colaboracion.nota")}</p>
  </aside>
}
