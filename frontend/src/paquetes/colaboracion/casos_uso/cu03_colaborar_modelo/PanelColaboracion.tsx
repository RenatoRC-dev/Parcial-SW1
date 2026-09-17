import { useEffect, useRef, useState } from "react"
import type { ApollonEditor, CollaboratorInfo } from "@tumaet/apollon"
import { conectarColaboracionApollon, normalizarSalaColaboracion, type ConexionColaboracion, type EstadoConexionColaboracion } from "./conectarColaboracionApollon"
import { crearIdentidadColaborador, obtenerIdSesionColaborador } from "./identidadColaborador"

export function PanelColaboracion({ editor, proyectoId, habilitada }: { editor: ApollonEditor | null; proyectoId: string; habilitada: boolean }) {
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
    <h2>Colaboración</h2>
    <p>Proyecto compartido: <code>{proyectoId}</code></p>
    <p role="status">Estado: <strong>{estado}</strong></p>
    <p data-testid="cantidad-participantes">Participantes: {participantes.length}</p>
    {participantes.length > 0 ? <ul aria-label="Participantes conectados">{participantes.map((participante) => <li key={participante.id}><span className="participant-color" style={{ backgroundColor: participante.color }} />{participante.name}{participante.isLocal ? " (Tú)" : ""}</li>)}</ul> : null}
    {error ? <p className="collaboration-error" role="alert">{error}</p> : null}
    <p className="collaboration-note">Sala efímera derivada del proyecto; el guardado persistente continúa siendo explícito.</p>
  </aside>
}
