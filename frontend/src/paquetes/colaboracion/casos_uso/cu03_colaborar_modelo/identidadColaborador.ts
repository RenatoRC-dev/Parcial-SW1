import type { CollaborationUser } from "@tumaet/apollon"

const COLORES = ["#2563eb", "#7c3aed", "#db2777", "#c2410c", "#047857", "#0e7490"]

export function normalizarNombreColaborador(nombre: string): string | null {
  const normalizado = nombre.trim()
  return normalizado.length >= 1 && normalizado.length <= 40 ? normalizado : null
}

export function crearIdentidadColaborador(nombre: string, idSesion: string): CollaborationUser | null {
  const nombreNormalizado = normalizarNombreColaborador(nombre)
  if (!nombreNormalizado) return null
  let hash = 0
  for (const caracter of `${nombreNormalizado}:${idSesion}`) hash = (hash * 31 + caracter.charCodeAt(0)) | 0
  return {
    id: idSesion,
    name: nombreNormalizado,
    color: COLORES[Math.abs(hash) % COLORES.length],
  }
}

export function obtenerIdSesionColaborador(): string {
  const clave = "sw1-colaborador-id"
  const existente = sessionStorage.getItem(clave)
  if (existente) return existente
  const creado = crypto.randomUUID()
  sessionStorage.setItem(clave, creado)
  return creado
}
