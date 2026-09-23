import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"

export class ErrorPlanCambiosUML extends Error {}

export function ejecutarComandosUML(
  original: ModeloUMLCanonicoIA,
  comandos: ComandoModeloUML[],
  generarId: (categoria: "clase" | "atributo" | "metodo" | "parametro" | "relacion") => string,
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
  const obtenerMetodo = (id: string) => {
    const metodo = modelo.clases.flatMap((clase) => clase.metodos ?? []).find((actual) => actual.id === id)
    if (!metodo) throw new ErrorPlanCambiosUML(`No existe el método ${id}.`)
    return metodo
  }
  const obtenerParametro = (id: string) => {
    const parametro = modelo.clases.flatMap((clase) => clase.metodos ?? []).flatMap((metodo) => metodo.parametros).find((actual) => actual.id === id)
    if (!parametro) throw new ErrorPlanCambiosUML(`No existe el parámetro ${id}.`)
    return parametro
  }
  const crearClaseAsociativa = (nombreSolicitado: string, claseARef: string, claseBRef: string, refTemporal: string, relacionReemplazadaId?: string) => {
    const nombre = nombreSolicitado.trim()
    if (!/^[A-Z][A-Za-z0-9]*$/.test(nombre) || modelo.clases.some((clase) => clase.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
      throw new ErrorPlanCambiosUML(`El nombre de clase asociativa ${nombreSolicitado} no es válido o ya existe.`)
    }
    const claseA = obtenerClase(claseARef)
    const claseB = obtenerClase(claseBRef)
    if (claseA.id === claseB.id) throw new ErrorPlanCambiosUML("La clase asociativa requiere dos clases distintas.")
    if (relacionReemplazadaId) {
      const existente = obtenerRelacion(relacionReemplazadaId)
      const mismosExtremos = [existente.claseOrigenId, existente.claseDestinoId].every((id) => id === claseA.id || id === claseB.id)
      if (existente.tipo !== "asociacion" || existente.multiplicidadOrigen !== "0..*" || existente.multiplicidadDestino !== "0..*" || !mismosExtremos) {
        throw new ErrorPlanCambiosUML("La relación seleccionada no es una asociación N:M convertible.")
      }
    }
    const claseId = generarId("clase")
    const relacionAId = generarId("relacion")
    const relacionBId = generarId("relacion")
    registrarTemporal(refTemporal, claseId)
    const ids = new Set([
      ...modelo.clases.flatMap((clase) => [clase.id, ...clase.atributos.map((atributo) => atributo.id)]),
      ...modelo.relaciones.map((relacion) => relacion.id),
    ])
    if ([claseId, relacionAId, relacionBId].some((id) => ids.has(id)) || new Set([claseId, relacionAId, relacionBId]).size !== 3) {
      throw new ErrorPlanCambiosUML("Los ids generados para la clase asociativa no son únicos.")
    }
    modelo.clases.push({
      id: claseId, nombre, tipoClase: "asociativa", abstracta: false, atributos: [], metodos: [],
      posicion: { x: (claseA.posicion.x + claseB.posicion.x) / 2, y: (claseA.posicion.y + claseB.posicion.y) / 2 + 140 },
    })
    if (relacionReemplazadaId) modelo.relaciones = modelo.relaciones.filter((relacion) => relacion.id !== relacionReemplazadaId)
    modelo.relaciones.push(
      { id: relacionAId, tipo: "asociacion", claseOrigenId: claseA.id, claseDestinoId: claseId, multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
      { id: relacionBId, tipo: "asociacion", claseOrigenId: claseId, claseDestinoId: claseB.id, multiplicidadOrigen: "0..*", multiplicidadDestino: "1" },
    )
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
          tipoClase: "normal",
          atributos: [],
          metodos: [],
          posicion: { x: 100 + (indice % 3) * 350, y: 100 + Math.floor(indice / 3) * 250 },
        })
        break
      }
      case "crear_clase_asociativa":
        crearClaseAsociativa(comando.nombre, comando.claseARef, comando.claseBRef, comando.refTemporal)
        break
      case "convertir_relacion_en_clase_asociativa": {
        const relacion = obtenerRelacion(comando.relacionId)
        crearClaseAsociativa(comando.nombre, relacion.claseOrigenId, relacion.claseDestinoId, comando.refTemporal, relacion.id)
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
      case "crear_metodo": {
        const clase = obtenerClase(comando.claseRef)
        const id = generarId("metodo")
        registrarTemporal(comando.refTemporal, id)
        const parametros = comando.parametros.map((candidato) => {
          const parametroId = generarId("parametro")
          registrarTemporal(candidato.refTemporal, parametroId)
          return { id: parametroId, nombre: candidato.nombre, tipo: candidato.tipo }
        })
        clase.metodos = [...(clase.metodos ?? []), { id, nombre: comando.nombre, tipoRetorno: comando.tipoRetorno, visibilidad: comando.visibilidad, parametros }]
        break
      }
      case "modificar_metodo": {
        const metodo = obtenerMetodo(comando.metodoId)
        if (comando.nuevoNombre !== null) metodo.nombre = comando.nuevoNombre
        if (comando.nuevoTipoRetorno !== null) metodo.tipoRetorno = comando.nuevoTipoRetorno
        if (comando.nuevaVisibilidad !== null) metodo.visibilidad = comando.nuevaVisibilidad
        break
      }
      case "eliminar_metodo": {
        const clase = modelo.clases.find((actual) => (actual.metodos ?? []).some((metodo) => metodo.id === comando.metodoId))
        if (!clase) throw new ErrorPlanCambiosUML(`No existe el método ${comando.metodoId}.`)
        clase.metodos = (clase.metodos ?? []).filter((metodo) => metodo.id !== comando.metodoId)
        break
      }
      case "agregar_parametro": {
        const metodo = obtenerMetodo(comando.metodoId)
        const id = generarId("parametro")
        registrarTemporal(comando.refTemporal, id)
        metodo.parametros.push({ id, nombre: comando.nombre, tipo: comando.tipoDato })
        break
      }
      case "modificar_parametro": {
        const parametro = obtenerParametro(comando.parametroId)
        if (comando.nuevoNombre !== null) parametro.nombre = comando.nuevoNombre
        if (comando.nuevoTipo !== null) parametro.tipo = comando.nuevoTipo
        break
      }
      case "eliminar_parametro": {
        const metodo = modelo.clases.flatMap((clase) => clase.metodos ?? []).find((actual) => actual.parametros.some((parametro) => parametro.id === comando.parametroId))
        if (!metodo) throw new ErrorPlanCambiosUML(`No existe el parámetro ${comando.parametroId}.`)
        metodo.parametros = metodo.parametros.filter((parametro) => parametro.id !== comando.parametroId)
        break
      }
      case "crear_relacion": {
        const id = generarId("relacion")
        registrarTemporal(comando.refTemporal, id)
        if ("subclaseRef" in comando) {
          modelo.relaciones.push({
            id,
            tipo: "generalizacion",
            claseOrigenId: obtenerClase(comando.subclaseRef).id,
            claseDestinoId: obtenerClase(comando.superclaseRef).id,
            multiplicidadOrigen: null,
            multiplicidadDestino: null,
          })
          break
        }
        if ("parteRef" in comando) {
          modelo.relaciones.push({
            id,
            tipo: comando.tipoRelacion,
            claseOrigenId: obtenerClase(comando.parteRef).id,
            claseDestinoId: obtenerClase(comando.todoRef).id,
            multiplicidadOrigen: comando.cantidadPartesPorTodo,
            multiplicidadDestino: comando.cantidadTodosPorParte,
            ...(comando.rolParte ? { rolOrigen: comando.rolParte } : {}),
            ...(comando.rolTodo ? { rolDestino: comando.rolTodo } : {}),
          })
          break
        }
        modelo.relaciones.push({
          id,
          tipo: "asociacion",
          claseOrigenId: obtenerClase(comando.claseOrigenRef).id,
          claseDestinoId: obtenerClase(comando.claseDestinoRef).id,
          // La cantidad de destinos por un origen se anota en el extremo destino UML.
          multiplicidadOrigen: comando.cantidadOrigenPorDestino,
          multiplicidadDestino: comando.cantidadDestinoPorOrigen,
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
        if (relacion.tipo === "generalizacion") throw new ErrorPlanCambiosUML("La generalización no admite multiplicidades.")
        relacion.multiplicidadOrigen = comando.cantidadOrigenPorDestino
        relacion.multiplicidadDestino = comando.cantidadDestinoPorOrigen
        break
      }
    }
  }
  return modelo
}
