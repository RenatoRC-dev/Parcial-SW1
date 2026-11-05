import type { CollaborationUser } from "@tumaet/apollon"

const COLORES = ["#2563eb", "#7c3aed", "#db2777", "#c2410c", "#047857", "#0e7490"]

export interface ParticipanteColaboracionAutenticado {
  id: string
  nombreVisible: string
}

export function crearIdentidadColaborador(participante: ParticipanteColaboracionAutenticado): CollaborationUser | null {
  const nombre = participante.nombreVisible.trim()
  if (!participante.id || nombre.length < 1 || nombre.length > 60) return null
  let hash = 0
  for (const caracter of participante.id) hash = (hash * 31 + caracter.charCodeAt(0)) | 0
  return {
    id: participante.id,
    name: nombre,
    color: COLORES[Math.abs(hash) % COLORES.length],
  }
}
