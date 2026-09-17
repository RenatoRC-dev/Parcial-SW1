import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { ProyectoPersistido, ResumenProyecto } from "./ProyectoPersistido.js"

export interface RepositorioProyectos {
  listar(): Promise<ResumenProyecto[]>
  crear(proyecto: ProyectoPersistido): Promise<ProyectoPersistido>
  obtenerPorId(id: string): Promise<ProyectoPersistido | null>
  guardarModelo(id: string, modelo: ModeloUMLCanonicoIntercambio, actualizadoEn: string): Promise<ProyectoPersistido | null>
}

export class ErrorNombreProyectoDuplicado extends Error {}
export class ErrorDatosProyectoCorruptos extends Error {}
export class ErrorPersistenciaProyecto extends Error {}

