import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"

export class ErrorPlanCambiosUML extends Error {}

export function ejecutarComandosUML(
  original: ModeloUMLCanonicoIA,
  comandos: ComandoModeloUML[],
  generarId: (categoria: "clase" | "atributo" | "relacion") => string,
): ModeloUMLCanonicoIA {
  const modelo = structuredClone(original)
  const referencias = new Map<string, string>()

  const registrarTemporal = (ref: string, id: string) => {
    if (!/^tmp_[A-Za-z0-9_]+$/.test(ref)) throw new ErrorPlanCambiosUML(`Referencia temporal inválida: ${ref}.`)
    if (referencias.has(ref)) throw new ErrorPlanCambiosUML(`Referencia temporal duplicada: ${ref}.`)
    referencias.set(ref, id)
  }
  const resolverClase = (ref: string) => referencias.get(ref) ?? ref
  const obtenerClase = (ref: string) => {
    const id = resolverClase(ref)
    const clase = modelo.clases.find((actual) => actual.id === id)
    if (!clase) throw new ErrorPlanCambiosUML(`No existe la clase con referencia ${ref}.`)
    return clase
  }
  const obtenerRelacion = (id: string) => {
    const relacion = modelo.relaciones.find((actual) => actual.id === id)
    if (!relacion) throw new ErrorPlanCambiosUML(`No existe la relación ${id}.`)
    return relacion
  }

  for (const comando of comandos) {
    switch (comando.tipo) {
      case "crear_clase": {
        const id = generarId("clase")
        registrarTemporal(comando.refTemporal, id)
        const indice = modelo.clases.length
        modelo.clases.push({
          id,
          nombre: comando.nombre,
          abstracta: comando.abstracta,
          atributos: [],
          posicion: { x: 100 + (indice % 3) * 350, y: 100 + Math.floor(indice / 3) * 250 },
        })
        break
      }
      case "renombrar_clase":
        obtenerClase(comando.claseId).nombre = comando.nuevoNombre
        break
      case "eliminar_clase": {
        obtenerClase(comando.claseId)
        modelo.clases = modelo.clases.filter((clase) => clase.id !== comando.claseId)
        modelo.relaciones = modelo.relaciones.filter(
          (relacion) => relacion.claseOrigenId !== comando.claseId && relacion.claseDestinoId !== comando.claseId,
        )
        break
      }
      case "agregar_atributo": {
        const clase = obtenerClase(comando.claseRef)
        const id = generarId("atributo")
        registrarTemporal(comando.refTemporal, id)
        clase.atributos.push({
          id,
          nombre: comando.nombre,
          tipo: comando.tipoDato,
          ...(comando.visibilidad ? { visibilidad: comando.visibilidad } : {}),
        })
        break
      }
      case "modificar_atributo": {
        const atributo = modelo.clases.flatMap((clase) => clase.atributos).find((actual) => actual.id === comando.atributoId)
        if (!atributo) throw new ErrorPlanCambiosUML(`No existe el atributo ${comando.atributoId}.`)
        if (comando.nuevoNombre !== null) atributo.nombre = comando.nuevoNombre
        if (comando.nuevoTipo !== null) atributo.tipo = comando.nuevoTipo
        if (comando.nuevaVisibilidad !== null) atributo.visibilidad = comando.nuevaVisibilidad
        break
      }
      case "eliminar_atributo": {
        const clase = modelo.clases.find((actual) => actual.atributos.some((atributo) => atributo.id === comando.atributoId))
        if (!clase) throw new ErrorPlanCambiosUML(`No existe el atributo ${comando.atributoId}.`)
        clase.atributos = clase.atributos.filter((atributo) => atributo.id !== comando.atributoId)
        break
      }
      case "crear_relacion": {
        const id = generarId("relacion")
        registrarTemporal(comando.refTemporal, id)
        modelo.relaciones.push({
          id,
          tipo: comando.tipoRelacion,
          claseOrigenId: obtenerClase(comando.claseOrigenRef).id,
          claseDestinoId: obtenerClase(comando.claseDestinoRef).id,
          multiplicidadOrigen: comando.multiplicidadOrigen,
          multiplicidadDestino: comando.multiplicidadDestino,
          ...(comando.rolOrigen ? { rolOrigen: comando.rolOrigen } : {}),
          ...(comando.rolDestino ? { rolDestino: comando.rolDestino } : {}),
        })
        break
      }
      case "eliminar_relacion":
        obtenerRelacion(comando.relacionId)
        modelo.relaciones = modelo.relaciones.filter((relacion) => relacion.id !== comando.relacionId)
        break
      case "cambiar_multiplicidad": {
        const relacion = obtenerRelacion(comando.relacionId)
        relacion.multiplicidadOrigen = comando.multiplicidadOrigen
        relacion.multiplicidadDestino = comando.multiplicidadDestino
        break
      }
    }
  }
  return modelo
}
