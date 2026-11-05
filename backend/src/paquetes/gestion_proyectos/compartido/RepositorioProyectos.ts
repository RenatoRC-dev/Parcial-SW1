import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { ProyectoPersistido, ResumenProyecto } from "./ProyectoPersistido.js"

export interface RepositorioProyectos {
  /** Compatibilidad legacy para migración/tests; F4-B ya no lo expone por HTTP. */
  listar(): Promise<ResumenProyecto[]>
  crear(proyecto: ProyectoPersistido, codigoAccesoDigest: string | null): Promise<ProyectoPersistido>
  obtenerPorId(id: string): Promise<ProyectoPersistido | null>
  buscarPorCodigoAccesoDigest(digest: string): Promise<ProyectoPersistido | null>
  eliminar(id: string): Promise<void>
  guardarModeloConRevision(
    id: string,
    modelo: ModeloUMLCanonicoIntercambio,
    revisionBase: number,
    actualizadoEn: string,
  ): Promise<ProyectoPersistido>
}

export class ErrorDatosProyectoCorruptos extends Error {}
export class ErrorPersistenciaProyecto extends Error {}
export class ErrorProyectoNoEncontrado extends Error {}
export class ErrorConflictoRevisionProyecto extends Error {}
export class ErrorCodigoAccesoDuplicado extends Error {}

