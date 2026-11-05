import type { ModeloUMLCanonicoIntercambio } from "../../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { RepositorioProyectos } from "../../compartido/RepositorioProyectos.js"
import { esModeloUMLPersistible } from "../../compartido/ValidarProyectoPersistido.js"

export class ErrorModeloPersistibleInvalido extends Error {}

export async function guardarTrabajo(repositorio: RepositorioProyectos, id: string, modelo: unknown, revisionBase: unknown) {
  if (!esModeloUMLPersistible(modelo)) throw new ErrorModeloPersistibleInvalido("El modelo canónico no tiene una estructura persistible válida.")
  if (!Number.isInteger(revisionBase) || Number(revisionBase) < 0) {
    throw new ErrorModeloPersistibleInvalido("La revisión base debe ser un entero mayor o igual a cero.")
  }
  return repositorio.guardarModeloConRevision(
    id,
    modelo as ModeloUMLCanonicoIntercambio,
    Number(revisionBase),
    new Date().toISOString(),
  )
}

export const recuperarTrabajo = (repositorio: RepositorioProyectos, id: string) => repositorio.obtenerPorId(id)

