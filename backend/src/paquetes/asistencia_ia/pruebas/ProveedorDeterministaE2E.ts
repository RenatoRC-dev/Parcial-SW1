import type { ProveedorModeloLenguaje, SolicitudProveedorUML } from "../compartido/proveedores/ProveedorModeloLenguaje.js"
import type { RespuestaInterpretacionUML } from "../compartido/contrato/PlanCambiosUML.js"

export class ProveedorDeterministaE2E implements ProveedorModeloLenguaje {
  async interpretarCambiosUML({ instruccion, modelo }: SolicitudProveedorUML): Promise<RespuestaInterpretacionUML> {
    const crear = instruccion.match(/crea (?:una )?clase ([A-Za-z][A-Za-z0-9]*)/i)
    if (crear) {
      return {
        resultado: "aplicar",
        mensaje: `Clase ${crear[1]} creada.`,
        comandos: [{ tipo: "crear_clase", refTemporal: "tmp_clase_1", nombre: crear[1], abstracta: false }],
      }
    }

    if (/agrega correo string al cliente/i.test(instruccion)) {
      const candidatas = modelo.clases.filter((clase) => clase.nombre.toLowerCase().startsWith("cliente"))
      if (candidatas.length > 1) {
        return { resultado: "aclarar", mensaje: "¿Quieres agregar el atributo a Cliente o ClienteEmpresa?", comandos: [] }
      }
    }

    const agregar = instruccion.match(/agrega (?:un )?atributo ([a-z][A-Za-z0-9]*) (?:de tipo )?([A-Za-z][A-Za-z0-9]*) a(?: la clase)? ([A-Za-z][A-Za-z0-9]*)/i)
    if (agregar) {
      const clase = modelo.clases.find((actual) => actual.nombre.toLowerCase() === agregar[3].toLowerCase())
      if (!clase) return { resultado: "aclarar", mensaje: `No existe la clase ${agregar[3]}.`, comandos: [] }
      return {
        resultado: "aplicar",
        mensaje: `Se agregó ${agregar[1]} a ${clase.nombre}.`,
        comandos: [{ tipo: "agregar_atributo", claseRef: clase.id, refTemporal: "tmp_atributo_1", nombre: agregar[1], tipoDato: agregar[2], visibilidad: "privada" }],
      }
    }
    return { resultado: "rechazar", mensaje: "La instrucción no está soportada por esta prueba determinista.", comandos: [] }
  }
}
