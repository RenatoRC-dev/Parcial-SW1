import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ComandoModeloUML } from "./ComandoModeloUML"

export class ErrorEjecucionComandosUML extends Error {}

export function ejecutarComandosUML(
  original: ModeloUMLCanonico,
  comandos: ComandoModeloUML[],
  generarId: (categoria: "clase" | "atributo" | "metodo" | "parametro" | "relacion") => string = (categoria) => `${categoria}-${crypto.randomUUID()}`,
): ModeloUMLCanonico {
  const modelo = structuredClone(original)
  const temporales = new Map<string, string>()
  const registrar = (ref: string, id: string) => {
    if (!/^tmp_[A-Za-z0-9_]+$/.test(ref)) throw new ErrorEjecucionComandosUML(`Referencia temporal inválida: ${ref}.`)
    if (temporales.has(ref)) throw new ErrorEjecucionComandosUML(`Referencia temporal duplicada: ${ref}.`)
    temporales.set(ref, id)
  }
  const clase = (ref: string) => {
    const id = temporales.get(ref) ?? ref
    const encontrada = modelo.clases.find((actual) => actual.id === id)
    if (!encontrada) throw new ErrorEjecucionComandosUML(`No existe la clase ${ref}.`)
    return encontrada
  }
  const relacion = (id: string) => {
    const encontrada = modelo.relaciones.find((actual) => actual.id === id)
    if (!encontrada) throw new ErrorEjecucionComandosUML(`No existe la relación ${id}.`)
    return encontrada
  }
  const metodo = (id: string) => {
    const encontrado = modelo.clases.flatMap((actual) => actual.metodos ?? []).find((actual) => actual.id === id)
    if (!encontrado) throw new ErrorEjecucionComandosUML(`No existe el método ${id}.`)
    return encontrado
  }
  const parametro = (id: string) => {
    const encontrado = modelo.clases.flatMap((actual) => actual.metodos ?? []).flatMap((actual) => actual.parametros).find((actual) => actual.id === id)
    if (!encontrado) throw new ErrorEjecucionComandosUML(`No existe el parámetro ${id}.`)
    return encontrado
  }

  for (const comando of comandos) {
    switch (comando.tipo) {
      case "crear_clase": {
        const id = generarId("clase")
        registrar(comando.refTemporal, id)
        const indice = modelo.clases.length
        modelo.clases.push({ id, nombre: comando.nombre, abstracta: comando.abstracta, atributos: [], metodos: [], posicion: { x: 100 + (indice % 3) * 350, y: 100 + Math.floor(indice / 3) * 250 } })
        break
      }
      case "renombrar_clase":
        clase(comando.claseId).nombre = comando.nuevoNombre
        break
      case "eliminar_clase":
        clase(comando.claseId)
        modelo.clases = modelo.clases.filter((actual) => actual.id !== comando.claseId)
        modelo.relaciones = modelo.relaciones.filter((actual) => actual.claseOrigenId !== comando.claseId && actual.claseDestinoId !== comando.claseId)
        break
      case "agregar_atributo": {
        const id = generarId("atributo")
        registrar(comando.refTemporal, id)
        clase(comando.claseRef).atributos.push({ id, nombre: comando.nombre, tipo: comando.tipoDato, ...(comando.visibilidad ? { visibilidad: comando.visibilidad } : {}) })
        break
      }
      case "modificar_atributo": {
        const atributo = modelo.clases.flatMap((actual) => actual.atributos).find((actual) => actual.id === comando.atributoId)
        if (!atributo) throw new ErrorEjecucionComandosUML(`No existe el atributo ${comando.atributoId}.`)
        if (comando.nuevoNombre !== null) atributo.nombre = comando.nuevoNombre
        if (comando.nuevoTipo !== null) atributo.tipo = comando.nuevoTipo
        if (comando.nuevaVisibilidad !== null) atributo.visibilidad = comando.nuevaVisibilidad
        break
      }
      case "eliminar_atributo": {
        const contenedora = modelo.clases.find((actual) => actual.atributos.some((atributo) => atributo.id === comando.atributoId))
        if (!contenedora) throw new ErrorEjecucionComandosUML(`No existe el atributo ${comando.atributoId}.`)
        contenedora.atributos = contenedora.atributos.filter((atributo) => atributo.id !== comando.atributoId)
        break
      }
      case "crear_metodo": {
        const id = generarId("metodo")
        registrar(comando.refTemporal, id)
        const parametros = comando.parametros.map((candidato) => {
          const parametroId = generarId("parametro")
          registrar(candidato.refTemporal, parametroId)
          return { id: parametroId, nombre: candidato.nombre, tipo: candidato.tipo }
        })
        const contenedora = clase(comando.claseRef)
        contenedora.metodos = [...(contenedora.metodos ?? []), { id, nombre: comando.nombre, tipoRetorno: comando.tipoRetorno, visibilidad: comando.visibilidad, parametros }]
        break
      }
      case "modificar_metodo": {
        const actual = metodo(comando.metodoId)
        if (comando.nuevoNombre !== null) actual.nombre = comando.nuevoNombre
        if (comando.nuevoTipoRetorno !== null) actual.tipoRetorno = comando.nuevoTipoRetorno
        if (comando.nuevaVisibilidad !== null) actual.visibilidad = comando.nuevaVisibilidad
        break
      }
      case "eliminar_metodo": {
        const contenedora = modelo.clases.find((actual) => (actual.metodos ?? []).some((candidato) => candidato.id === comando.metodoId))
        if (!contenedora) throw new ErrorEjecucionComandosUML(`No existe el método ${comando.metodoId}.`)
        contenedora.metodos = (contenedora.metodos ?? []).filter((candidato) => candidato.id !== comando.metodoId)
        break
      }
      case "agregar_parametro": {
        const id = generarId("parametro")
        registrar(comando.refTemporal, id)
        metodo(comando.metodoId).parametros.push({ id, nombre: comando.nombre, tipo: comando.tipoDato })
        break
      }
      case "modificar_parametro": {
        const actual = parametro(comando.parametroId)
        if (comando.nuevoNombre !== null) actual.nombre = comando.nuevoNombre
        if (comando.nuevoTipo !== null) actual.tipo = comando.nuevoTipo
        break
      }
      case "eliminar_parametro": {
        const contenedor = modelo.clases.flatMap((actual) => actual.metodos ?? []).find((actual) => actual.parametros.some((candidato) => candidato.id === comando.parametroId))
        if (!contenedor) throw new ErrorEjecucionComandosUML(`No existe el parámetro ${comando.parametroId}.`)
        contenedor.parametros = contenedor.parametros.filter((candidato) => candidato.id !== comando.parametroId)
        break
      }
      case "crear_relacion": {
        const id = generarId("relacion")
        registrar(comando.refTemporal, id)
        modelo.relaciones.push({ id, tipo: comando.tipoRelacion, claseOrigenId: clase(comando.claseOrigenRef).id, claseDestinoId: clase(comando.claseDestinoRef).id, multiplicidadOrigen: comando.cantidadOrigenPorDestino, multiplicidadDestino: comando.cantidadDestinoPorOrigen, ...(comando.rolOrigen ? { rolOrigen: comando.rolOrigen } : {}), ...(comando.rolDestino ? { rolDestino: comando.rolDestino } : {}) })
        break
      }
      case "eliminar_relacion":
        relacion(comando.relacionId)
        modelo.relaciones = modelo.relaciones.filter((actual) => actual.id !== comando.relacionId)
        break
      case "cambiar_multiplicidad": {
        const actual = relacion(comando.relacionId)
        actual.multiplicidadOrigen = comando.cantidadOrigenPorDestino
        actual.multiplicidadDestino = comando.cantidadDestinoPorOrigen
        break
      }
    }
  }
  return modelo
}
