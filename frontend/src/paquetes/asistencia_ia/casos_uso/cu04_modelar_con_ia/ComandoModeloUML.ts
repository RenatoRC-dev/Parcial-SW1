import type { ModeloUMLCanonico, Multiplicidad, VisibilidadUML } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export type ComandoModeloUML =
  | { tipo: "crear_clase"; refTemporal: string; nombre: string; abstracta: boolean }
  | { tipo: "renombrar_clase"; claseId: string; nuevoNombre: string }
  | { tipo: "eliminar_clase"; claseId: string }
  | { tipo: "agregar_atributo"; claseRef: string; refTemporal: string; nombre: string; tipoDato: string; visibilidad: VisibilidadUML | null }
  | { tipo: "modificar_atributo"; atributoId: string; nuevoNombre: string | null; nuevoTipo: string | null; nuevaVisibilidad: VisibilidadUML | null }
  | { tipo: "eliminar_atributo"; atributoId: string }
  | { tipo: "crear_metodo"; claseRef: string; refTemporal: string; nombre: string; tipoRetorno: string; visibilidad: VisibilidadUML; parametros: Array<{ refTemporal: string; nombre: string; tipo: string }> }
  | { tipo: "modificar_metodo"; metodoId: string; nuevoNombre: string | null; nuevoTipoRetorno: string | null; nuevaVisibilidad: VisibilidadUML | null }
  | { tipo: "eliminar_metodo"; metodoId: string }
  | { tipo: "agregar_parametro"; metodoId: string; refTemporal: string; nombre: string; tipoDato: string }
  | { tipo: "modificar_parametro"; parametroId: string; nuevoNombre: string | null; nuevoTipo: string | null }
  | { tipo: "eliminar_parametro"; parametroId: string }
  | { tipo: "crear_relacion"; refTemporal: string; claseOrigenRef: string; claseDestinoRef: string; tipoRelacion: "asociacion"; cantidadDestinoPorOrigen: Multiplicidad; cantidadOrigenPorDestino: Multiplicidad; rolOrigen: string | null; rolDestino: string | null }
  | { tipo: "eliminar_relacion"; relacionId: string }
  | { tipo: "cambiar_multiplicidad"; relacionId: string; cantidadDestinoPorOrigen: Multiplicidad; cantidadOrigenPorDestino: Multiplicidad }

export interface RespuestaInterpretacionUML {
  resultado: "aplicar" | "aclarar" | "rechazar"
  mensaje: string
  comandos: ComandoModeloUML[]
  revision: number
}

export interface SolicitudInterpretacionUML {
  instruccion: string
  modelo: ModeloUMLCanonico
  revision: number
}
