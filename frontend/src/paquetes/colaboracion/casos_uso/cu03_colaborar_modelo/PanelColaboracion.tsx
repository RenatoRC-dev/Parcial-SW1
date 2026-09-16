import { useEffect, useRef, useState } from "react"
import type { ApollonEditor, CollaboratorInfo } from "@tumaet/apollon"
import {
  conectarColaboracionApollon,
  normalizarSalaColaboracion,
  type ConexionColaboracion,
  type EstadoConexionColaboracion,
} from "./conectarColaboracionApollon"
import { crearIdentidadColaborador, obtenerIdSesionColaborador } from "./identidadColaborador"

export interface PropiedadesPanelColaboracion {
  editor: ApollonEditor | null
}

function salaInicial(): string {
  return new URLSearchParams(window.location.search).get("room") ?? "parcial-demo"
}

export function PanelColaboracion({ editor }: PropiedadesPanelColaboracion) {
  const [nombre, establecerNombre] = useState("")
  const [sala, establecerSala] = useState(salaInicial)
  const [estado, establecerEstado] = useState<EstadoConexionColaboracion>("desconectado")
  const [participantes, establecerParticipantes] = useState<CollaboratorInfo[]>([])
  const [error, establecerError] = useState<string | null>(null)
  const conexion = useRef<ConexionColaboracion | null>(null)

  useEffect(() => () => conexion.current?.desconectar(), [])

  const conectar = () => {
    if (!editor) {
      establecerError("El editor todavía no está disponible.")
      return
    }
    const identidad = crearIdentidadColaborador(nombre, obtenerIdSesionColaborador())
    const salaNormalizada = normalizarSalaColaboracion(sala)
    if (!identidad) {
      establecerError("El nombre es obligatorio y admite hasta 40 caracteres.")
      return
    }
    if (!salaNormalizada) {
      establecerError("La sala debe usar 1–64 letras, números, guion o guion bajo.")
      return
    }

    establecerError(null)
    const parametros = new URLSearchParams(window.location.search)
    parametros.set("room", salaNormalizada)
    window.history.replaceState(null, "", `${window.location.pathname}?${parametros.toString()}`)
    conexion.current = conectarColaboracionApollon({
      editor,
      sala: salaNormalizada,
      identidad,
      alCambiarEstado: establecerEstado,
      alCambiarParticipantes: establecerParticipantes,
      alOcurrirError: establecerError,
    })
  }

  const desconectar = () => {
    conexion.current?.desconectar()
    conexion.current = null
  }

  const conectado = estado === "conectado" || estado === "conectando"
  return (
    <aside className="collaboration-panel" data-testid="panel-colaboracion">
      <h2>Colaboración</h2>
      <label>
        Nombre
        <input value={nombre} maxLength={40} disabled={conectado} onChange={(evento) => establecerNombre(evento.target.value)} />
      </label>
      <label>
        Sala
        <input value={sala} maxLength={64} disabled={conectado} onChange={(evento) => establecerSala(evento.target.value)} />
      </label>
      {conectado ? (
        <button type="button" onClick={desconectar}>Desconectar</button>
      ) : (
        <button type="button" disabled={!editor} onClick={conectar}>Conectar</button>
      )}
      <p role="status">Estado: <strong>{estado}</strong>{estado === "conectado" ? ` a ${sala.trim()}` : ""}</p>
      <p data-testid="cantidad-participantes">Participantes: {participantes.length}</p>
      {participantes.length > 0 ? (
        <ul aria-label="Participantes conectados">
          {participantes.map((participante) => (
            <li key={participante.id}>
              <span className="participant-color" style={{ backgroundColor: participante.color }} />
              {participante.name}{participante.isLocal ? " (Tú)" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="collaboration-error" role="alert">{error}</p> : null}
      <p className="collaboration-note">Sala efímera: sin persistencia ni control de acceso en esta iteración.</p>
    </aside>
  )
}
