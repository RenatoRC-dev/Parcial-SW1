import type { ProveedorModeloLenguaje, SolicitudProveedorUML } from "../compartido/proveedores/ProveedorModeloLenguaje.js"
import type { RespuestaInterpretacionUML } from "../compartido/contrato/PlanCambiosUML.js"
import { normalizarNombreClaseAsistido } from "../casos_uso/cu04_modelar_con_ia/normalizarSemanticaAsistida.js"

export class ProveedorDeterministaE2E implements ProveedorModeloLenguaje {
  async interpretarCambiosUML({ instruccion, modelo }: SolicitudProveedorUML): Promise<RespuestaInterpretacionUML> {
    if (/Persona/i.test(instruccion) && /Autos?/i.test(instruccion) && /cero o muchos|0\.\.\*/i.test(instruccion) && /exactamente (?:a )?una Persona|1 Persona/i.test(instruccion)) {
      return {
        resultado: "aplicar",
        mensaje: "Se creó la relación Persona-Auto con cardinalidades de negocio explícitas.",
        comandos: [
          { tipo: "crear_clase", refTemporal: "tmp_persona", nombre: "Persona", abstracta: false },
          { tipo: "crear_clase", refTemporal: "tmp_auto", nombre: "Auto", abstracta: false },
          {
            tipo: "crear_relacion", refTemporal: "tmp_persona_autos",
            claseOrigenRef: "tmp_persona", claseDestinoRef: "tmp_auto", tipoRelacion: "asociacion",
            cantidadDestinoPorOrigen: "0..*", cantidadOrigenPorDestino: "1",
            rolOrigen: "persona", rolDestino: "autos",
          },
        ],
      }
    }

    const crear = instruccion.match(/crea (?:una )?clase ([A-Za-z][A-Za-z0-9 _-]*)/i)
    if (crear) {
      return {
        resultado: "aplicar",
        mensaje: `Clase ${crear[1]} creada.`,
        comandos: [{ tipo: "crear_clase", refTemporal: "tmp_clase_1", nombre: crear[1], abstracta: false }],
      }
    }

    const buscarClase = (nombre: string) => modelo.clases.find((clase) => normalizarNombreClaseAsistido(clase.nombre) === normalizarNombreClaseAsistido(nombre))
    const buscarMetodo = (nombre: string) => modelo.clases.flatMap((clase) => clase.metodos ?? []).filter((metodo) => metodo.nombre.toLowerCase() === nombre.toLowerCase())

    if (/agrega correo string al cliente/i.test(instruccion)) {
      const candidatas = modelo.clases.filter((clase) => clase.nombre.toLowerCase().startsWith("cliente"))
      if (candidatas.length > 1) {
        return { resultado: "aclarar", mensaje: "¿Quieres agregar el atributo a Cliente o ClienteEmpresa?", comandos: [] }
      }
    }

    const formaFinal = instruccion.match(/agrega (?:un )?atributo ([a-z][A-Za-z0-9]*) (?:de tipo )?([A-Za-z][A-Za-z0-9]*) a(?: la clase)? ([A-Za-z][A-Za-z0-9 _-]*)/i)
    const formaInicial = instruccion.match(/agrega a ([A-Za-z][A-Za-z0-9 _-]*?) (?:el )?atributo ([a-z][A-Za-z0-9]*) de tipo ([A-Za-z][A-Za-z0-9]*)/i)
      ?? instruccion.match(/a ([A-Za-z][A-Za-z0-9 _-]*?) agr[eé]gale (?:un atributo )?([a-z][A-Za-z0-9]*) de tipo ([A-Za-z][A-Za-z0-9]*)/i)
    const agregar = formaFinal
      ? { nombre: formaFinal[1], tipo: formaFinal[2], clase: formaFinal[3] }
      : formaInicial ? { nombre: formaInicial[2], tipo: formaInicial[3], clase: formaInicial[1] } : null
    if (agregar) {
      const clase = buscarClase(agregar.clase)
      if (!clase) return { resultado: "aclarar", mensaje: `No existe la clase ${agregar.clase}.`, comandos: [] }
      return {
        resultado: "aplicar",
        mensaje: `Se agregó ${agregar.nombre} a ${clase.nombre}.`,
        comandos: [{ tipo: "agregar_atributo", claseRef: clase.id, refTemporal: "tmp_atributo_1", nombre: agregar.nombre, tipoDato: agregar.tipo, visibilidad: "privada" }],
      }
    }

    const crearMetodo = instruccion.match(/agrega a ([A-Za-z][A-Za-z0-9 _-]*?) un m[eé]todo ([a-z][A-Za-z0-9]*)(?: que retorne ([A-Za-z][A-Za-z0-9]*))?/i)
    if (crearMetodo) {
      const clase = buscarClase(crearMetodo[1])
      if (!clase) return { resultado: "aclarar", mensaje: `No existe la clase ${crearMetodo[1]}.`, comandos: [] }
      return {
        resultado: "aplicar",
        mensaje: `Se agregó ${crearMetodo[2]} a ${clase.nombre}.`,
        comandos: [{ tipo: "crear_metodo", claseRef: clase.id, refTemporal: "tmp_metodo_1", nombre: crearMetodo[2], tipoRetorno: crearMetodo[3] ?? "void", visibilidad: "publica", parametros: [] }],
      }
    }

    const agregarParametro = instruccion.match(/agrega al m[eé]todo ([a-z][A-Za-z0-9]*) (?:un |el )?par[aá]metro ([a-z][A-Za-z0-9]*) (?:de tipo )?([A-Za-z][A-Za-z0-9]*)/i)
    if (agregarParametro) {
      const metodos = buscarMetodo(agregarParametro[1])
      if (metodos.length !== 1) return { resultado: "aclarar", mensaje: `No se pudo resolver un único método ${agregarParametro[1]}.`, comandos: [] }
      return {
        resultado: "aplicar",
        mensaje: `Se agregó el parámetro ${agregarParametro[2]}.`,
        comandos: [{ tipo: "agregar_parametro", metodoId: metodos[0].id, refTemporal: "tmp_parametro_1", nombre: agregarParametro[2], tipoDato: agregarParametro[3] }],
      }
    }

    const eliminarMetodo = instruccion.match(/elimina (?:el )?m[eé]todo ([a-z][A-Za-z0-9]*)/i)
    if (eliminarMetodo) {
      const metodos = buscarMetodo(eliminarMetodo[1])
      if (metodos.length !== 1) return { resultado: "aclarar", mensaje: `No se pudo resolver un único método ${eliminarMetodo[1]}.`, comandos: [] }
      return { resultado: "aplicar", mensaje: `Se eliminó ${eliminarMetodo[1]}.`, comandos: [{ tipo: "eliminar_metodo", metodoId: metodos[0].id }] }
    }
    return { resultado: "rechazar", mensaje: "La instrucción no está soportada por esta prueba determinista.", comandos: [] }
  }
}
