import type { ModeloUMLCanonicoIntercambio } from "../../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { RepositorioProyectos } from "../../compartido/RepositorioProyectos.js"
import { esModeloUMLPersistible } from "../../compartido/ValidarProyectoPersistido.js"

export class ErrorModeloPersistibleInvalido extends Error {}

export async function guardarTrabajo(repositorio: RepositorioProyectos, id: string, modelo: unknown) {
  if (!esModeloUMLPersistible(modelo)) throw new ErrorModeloPersistibleInvalido("El modelo canónico no tiene una estructura persistible válida.")
  return repositorio.guardarModelo(id, modelo as ModeloUMLCanonicoIntercambio, new Date().toISOString())
}

export const recuperarTrabajo = (repositorio: RepositorioProyectos, id: string) => repositorio.obtenerPorId(id)

