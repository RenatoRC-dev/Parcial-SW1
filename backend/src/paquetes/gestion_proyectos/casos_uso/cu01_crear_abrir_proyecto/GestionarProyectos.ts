import { randomUUID } from "node:crypto"
import type { RepositorioProyectos } from "../../compartido/RepositorioProyectos.js"
import type { ProyectoPersistido } from "../../compartido/ProyectoPersistido.js"

export class ErrorNombreProyectoInvalido extends Error {}

export async function crearProyecto(repositorio: RepositorioProyectos, nombreSolicitado: string): Promise<ProyectoPersistido> {
  const nombre = nombreSolicitado.trim()
  if (nombre.length < 1 || nombre.length > 80) throw new ErrorNombreProyectoInvalido("El nombre debe tener entre 1 y 80 caracteres.")
  const id = randomUUID()
  const ahora = new Date().toISOString()
  return repositorio.crear({
    id,
    nombre,
    creadoEn: ahora,
    actualizadoEn: ahora,
    modelo: { id: `modelo-${id}`, nombre, version: "4.2.0", clases: [], relaciones: [] },
  })
}

export const listarProyectos = (repositorio: RepositorioProyectos) => repositorio.listar()
export const abrirProyecto = (repositorio: RepositorioProyectos, id: string) => repositorio.obtenerPorId(id)

