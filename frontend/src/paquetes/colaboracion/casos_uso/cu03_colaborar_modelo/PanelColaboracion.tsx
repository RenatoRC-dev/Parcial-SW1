import { useEffect, useRef, useState } from "react"
import type { ApollonEditor, CollaboratorInfo } from "@tumaet/apollon"
import { conectarColaboracionApollon, normalizarSalaColaboracion, type ConexionColaboracion, type EstadoConexionColaboracion } from "./conectarColaboracionApollon"
import { crearIdentidadColaborador, obtenerIdSesionColaborador } from "./identidadColaborador"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function PanelColaboracion({ editor, proyectoId, habilitada }: { editor: ApollonEditor | null; proyectoId: string; habilitada: boolean }) {
  const { t } = usarPreferenciasUI()
  const [estado, establecerEstado] = useState<EstadoConexionColaboracion>("desconectado")
  const [participantes, establecerParticipantes] = useState<CollaboratorInfo[]>([])
  const [error, establecerError] = useState<string | null>(null)
  const conexion = useRef<ConexionColaboracion | null>(null)
  const sala = normalizarSalaColaboracion(`proyecto-${proyectoId}`)

  useEffect(() => {
    conexion.current?.desconectar()
    conexion.current = null
    establecerParticipantes([])
    establecerEstado("desconectado")
    if (!editor || !habilitada || !sala) return
    const identidad = crearIdentidadColaborador("Diseñador", obtenerIdSesionColaborador())
    if (!identidad) return
    establecerError(null)
    conexion.current = conectarColaboracionApollon({ editor, sala, identidad, alCambiarEstado: establecerEstado, alCambiarParticipantes: establecerParticipantes, alOcurrirError: establecerError })
    return () => { conexion.current?.desconectar(); conexion.current = null }
  }, [editor, habilitada, proyectoId, sala])

  return <aside className="collaboration-panel" data-testid="panel-colaboracion">
    <h2>{t("colaboracion.titulo")}</h2>
    <p>{t("colaboracion.proyecto")}: <code>{proyectoId}</code></p>
    <p role="status">{t("colaboracion.estado")}: <strong>{t(`colaboracion.${estado}`)}</strong></p>
    <p data-testid="cantidad-participantes">{t("colaboracion.participantes")}: {participantes.length}</p>
    {participantes.length > 0 ? <ul aria-label={t("colaboracion.lista")}>{participantes.map((participante) => <li key={participante.id}><span className="participant-color" style={{ backgroundColor: participante.color }} />{participante.name}{participante.isLocal ? ` (${t("colaboracion.tu")})` : ""}</li>)}</ul> : null}
    {error ? <p className="collaboration-error" role="alert">{error}</p> : null}
    <p className="collaboration-note">{t("colaboracion.nota")}</p>
  </aside>
}
