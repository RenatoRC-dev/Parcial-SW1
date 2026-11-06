import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { CambioAplicadoIA, ComandoModeloUML } from "./ComandoModeloUML"
import { crearEstructuraClaseAsociativa } from "../../../modelado_uml/compartido/clases_asociativas/crearEstructuraClaseAsociativa"

export class ErrorEjecucionComandosUML extends Error {}

export function ejecutarComandosUML(
  original: ModeloUMLCanonico,
  comandos: ComandoModeloUML[],
  generarId: (categoria: "clase" | "atributo" | "metodo" | "parametro" | "relacion") => string = (categoria) => `${categoria}-${crypto.randomUUID()}`,
): ModeloUMLCanonico {
  return ejecutarComandosUMLConTrazabilidad(original, comandos, generarId).modelo
}

export function ejecutarComandosUMLConTrazabilidad(
  original: ModeloUMLCanonico,
  comandos: ComandoModeloUML[],
  generarId: (categoria: "clase" | "atributo" | "metodo" | "parametro" | "relacion") => string = (categoria) => `${categoria}-${crypto.randomUUID()}`,
): { modelo: ModeloUMLCanonico; cambios: CambioAplicadoIA[] } {
  let modelo = structuredClone(original)
  const cambios: CambioAplicadoIA[] = []
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

  for (const [commandIndex, comando] of comandos.entries()) {
    switch (comando.tipo) {
      case "crear_clase": {
        const id = generarId("clase")
        registrar(comando.refTemporal, id)
        const indice = modelo.clases.length
        modelo.clases.push({ id, nombre: comando.nombre, abstracta: comando.abstracta, tipoClase: "normal", atributos: [], metodos: [], posicion: { x: 100 + (indice % 3) * 350, y: 100 + Math.floor(indice / 3) * 250 } })
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "class", nombreSnapshot: comando.nombre } })
        break
      }
      case "crear_clase_asociativa": {
        const claseId = generarId("clase")
        registrar(comando.refTemporal, claseId)
        modelo = crearEstructuraClaseAsociativa(modelo, {
          nombre: comando.nombre,
          claseAId: clase(comando.claseARef).id,
          claseBId: clase(comando.claseBRef).id,
          ids: { clase: claseId, relacionA: generarId("relacion"), relacionB: generarId("relacion") },
        })
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id: claseId, tipo: "class", nombreSnapshot: comando.nombre } })
        break
      }
      case "convertir_relacion_en_clase_asociativa": {
        const existente = relacion(comando.relacionId)
        const claseId = generarId("clase")
        registrar(comando.refTemporal, claseId)
        modelo = crearEstructuraClaseAsociativa(modelo, {
          nombre: comando.nombre,
          claseAId: existente.claseOrigenId,
          claseBId: existente.claseDestinoId,
          relacionReemplazadaId: existente.id,
          ids: { clase: claseId, relacionA: generarId("relacion"), relacionB: generarId("relacion") },
        })
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id: claseId, tipo: "class", nombreSnapshot: comando.nombre } })
        break
      }
      case "renombrar_clase":
        clase(comando.claseId).nombre = comando.nuevoNombre
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_UPDATED", elemento: { id: comando.claseId, tipo: "class", nombreSnapshot: comando.nuevoNombre } })
        break
      case "eliminar_clase": {
        const eliminada = clase(comando.claseId)
        modelo.clases = modelo.clases.filter((actual) => actual.id !== comando.claseId)
        modelo.relaciones = modelo.relaciones.filter((actual) => actual.claseOrigenId !== comando.claseId && actual.claseDestinoId !== comando.claseId)
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_DELETED", elemento: { id: comando.claseId, tipo: "class", nombreSnapshot: eliminada.nombre } })
        break
      }
      case "agregar_atributo": {
        const id = generarId("atributo")
        registrar(comando.refTemporal, id)
        clase(comando.claseRef).atributos.push({ id, nombre: comando.nombre, tipo: comando.tipoDato, ...(comando.visibilidad ? { visibilidad: comando.visibilidad } : {}) })
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "attribute", nombreSnapshot: comando.nombre } })
        break
      }
      case "modificar_atributo": {
        const atributo = modelo.clases.flatMap((actual) => actual.atributos).find((actual) => actual.id === comando.atributoId)
        if (!atributo) throw new ErrorEjecucionComandosUML(`No existe el atributo ${comando.atributoId}.`)
        if (comando.nuevoNombre !== null) atributo.nombre = comando.nuevoNombre
        if (comando.nuevoTipo !== null) atributo.tipo = comando.nuevoTipo
        if (comando.nuevaVisibilidad !== null) atributo.visibilidad = comando.nuevaVisibilidad
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_UPDATED", elemento: { id: atributo.id, tipo: "attribute", nombreSnapshot: atributo.nombre } })
        break
      }
      case "eliminar_atributo": {
        const contenedora = modelo.clases.find((actual) => actual.atributos.some((atributo) => atributo.id === comando.atributoId))
        if (!contenedora) throw new ErrorEjecucionComandosUML(`No existe el atributo ${comando.atributoId}.`)
        const eliminada = contenedora.atributos.find((atributo) => atributo.id === comando.atributoId)!
        contenedora.atributos = contenedora.atributos.filter((atributo) => atributo.id !== comando.atributoId)
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_DELETED", elemento: { id: comando.atributoId, tipo: "attribute", nombreSnapshot: eliminada.nombre } })
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
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "method", nombreSnapshot: comando.nombre } })
        break
      }
      case "modificar_metodo": {
        const actual = metodo(comando.metodoId)
        if (comando.nuevoNombre !== null) actual.nombre = comando.nuevoNombre
        if (comando.nuevoTipoRetorno !== null) actual.tipoRetorno = comando.nuevoTipoRetorno
        if (comando.nuevaVisibilidad !== null) actual.visibilidad = comando.nuevaVisibilidad
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_UPDATED", elemento: { id: actual.id, tipo: "method", nombreSnapshot: actual.nombre } })
        break
      }
      case "eliminar_metodo": {
        const contenedora = modelo.clases.find((actual) => (actual.metodos ?? []).some((candidato) => candidato.id === comando.metodoId))
        if (!contenedora) throw new ErrorEjecucionComandosUML(`No existe el método ${comando.metodoId}.`)
        const eliminado = (contenedora.metodos ?? []).find((candidato) => candidato.id === comando.metodoId)!
        contenedora.metodos = (contenedora.metodos ?? []).filter((candidato) => candidato.id !== comando.metodoId)
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_DELETED", elemento: { id: eliminado.id, tipo: "method", nombreSnapshot: eliminado.nombre } })
        break
      }
      case "agregar_parametro": {
        const id = generarId("parametro")
        registrar(comando.refTemporal, id)
        metodo(comando.metodoId).parametros.push({ id, nombre: comando.nombre, tipo: comando.tipoDato })
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "parameter", nombreSnapshot: comando.nombre } })
        break
      }
      case "modificar_parametro": {
        const actual = parametro(comando.parametroId)
        if (comando.nuevoNombre !== null) actual.nombre = comando.nuevoNombre
        if (comando.nuevoTipo !== null) actual.tipo = comando.nuevoTipo
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_UPDATED", elemento: { id: actual.id, tipo: "parameter", nombreSnapshot: actual.nombre } })
        break
      }
      case "eliminar_parametro": {
        const contenedor = modelo.clases.flatMap((actual) => actual.metodos ?? []).find((actual) => actual.parametros.some((candidato) => candidato.id === comando.parametroId))
        if (!contenedor) throw new ErrorEjecucionComandosUML(`No existe el parámetro ${comando.parametroId}.`)
        const eliminado = contenedor.parametros.find((candidato) => candidato.id === comando.parametroId)!
        contenedor.parametros = contenedor.parametros.filter((candidato) => candidato.id !== comando.parametroId)
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_DELETED", elemento: { id: eliminado.id, tipo: "parameter", nombreSnapshot: eliminado.nombre } })
        break
      }
      case "crear_relacion": {
        const id = generarId("relacion")
        registrar(comando.refTemporal, id)
        if ("subclaseRef" in comando) {
          modelo.relaciones.push({ id, tipo: "generalizacion", claseOrigenId: clase(comando.subclaseRef).id, claseDestinoId: clase(comando.superclaseRef).id, multiplicidadOrigen: null, multiplicidadDestino: null })
          cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "relationship", nombreSnapshot: id } })
          break
        }
        if ("parteRef" in comando) {
          modelo.relaciones.push({ id, tipo: comando.tipoRelacion, claseOrigenId: clase(comando.parteRef).id, claseDestinoId: clase(comando.todoRef).id, multiplicidadOrigen: comando.cantidadPartesPorTodo, multiplicidadDestino: comando.cantidadTodosPorParte, ...(comando.rolParte ? { rolOrigen: comando.rolParte } : {}), ...(comando.rolTodo ? { rolDestino: comando.rolTodo } : {}) })
          cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "relationship", nombreSnapshot: id } })
          break
        }
        modelo.relaciones.push({ id, tipo: "asociacion", claseOrigenId: clase(comando.claseOrigenRef).id, claseDestinoId: clase(comando.claseDestinoRef).id, multiplicidadOrigen: comando.cantidadOrigenPorDestino, multiplicidadDestino: comando.cantidadDestinoPorOrigen, ...(comando.rolOrigen ? { rolOrigen: comando.rolOrigen } : {}), ...(comando.rolDestino ? { rolDestino: comando.rolDestino } : {}) })
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_CREATED", elemento: { id, tipo: "relationship", nombreSnapshot: id } })
        break
      }
      case "eliminar_relacion": {
        const eliminada = relacion(comando.relacionId)
        modelo.relaciones = modelo.relaciones.filter((actual) => actual.id !== comando.relacionId)
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_DELETED", elemento: { id: eliminada.id, tipo: "relationship", nombreSnapshot: eliminada.id } })
        break
      }
      case "cambiar_multiplicidad": {
        const actual = relacion(comando.relacionId)
        actual.multiplicidadOrigen = comando.cantidadOrigenPorDestino
        actual.multiplicidadDestino = comando.cantidadDestinoPorOrigen
        cambios.push({ commandIndex, tipo: "UML_ELEMENT_UPDATED", elemento: { id: actual.id, tipo: "relationship", nombreSnapshot: actual.id } })
        break
      }
    }
  }
  return { modelo, cambios }
}
