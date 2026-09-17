import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import type { CandidatoModeloUMLImagen } from "./CandidatoModeloUMLImagen"
import { evaluarAtributoCandidato } from "./evaluarAtributoCandidato"

export class ErrorIntegracionCandidato extends Error {}

type CategoriaId = "clase" | "atributo" | "relacion"

export function aplicarCandidatoImagen(
  actual: ModeloUMLCanonico,
  candidato: CandidatoModeloUMLImagen,
  generarId: (categoria: CategoriaId) => string = (categoria) => `${categoria}-${crypto.randomUUID()}`,
): ModeloUMLCanonico {
  const nombresActuales = new Set(actual.clases.map((clase) => clase.nombre.trim().toLowerCase()))
  const colision = candidato.clases.find((clase) => nombresActuales.has(clase.nombre.trim().toLowerCase()))
  if (colision) throw new ErrorIntegracionCandidato(`No se puede agregar el candidato porque ya existe la clase ${colision.nombre}.`)

  const referencias = new Map<string, string>()
  const maximoX = actual.clases.length > 0 ? Math.max(...actual.clases.map((clase) => clase.posicion.x)) : -250
  const inicioX = maximoX + 350
  const clases = candidato.clases.map((clase, indice) => {
    const id = generarId("clase")
    referencias.set(clase.refTemporal, id)
    return {
      id,
      nombre: clase.nombre.trim(),
      abstracta: false,
      posicion: { x: inicioX + (indice % 2) * 350, y: 100 + Math.floor(indice / 2) * 250 },
      atributos: clase.atributos.flatMap((atributo) => {
        const importabilidad = evaluarAtributoCandidato(atributo)
        return importabilidad.importable ? [{
          id: generarId("atributo"),
          nombre: atributo.nombre.trim(),
          tipo: importabilidad.tipo,
        }] : []
      }),
    }
  })

  const relaciones = candidato.relaciones.map((relacion) => {
    const claseOrigenId = referencias.get(relacion.origenRef)
    const claseDestinoId = referencias.get(relacion.destinoRef)
    if (!claseOrigenId || !claseDestinoId) throw new ErrorIntegracionCandidato("El candidato contiene una relación con extremos inválidos.")
    return {
      id: generarId("relacion"),
      tipo: relacion.tipo,
      claseOrigenId,
      claseDestinoId,
      multiplicidadOrigen: relacion.multiplicidadOrigen,
      multiplicidadDestino: relacion.multiplicidadDestino,
      ...(relacion.rolOrigen ? { rolOrigen: relacion.rolOrigen } : {}),
      ...(relacion.rolDestino ? { rolDestino: relacion.rolDestino } : {}),
    }
  })

  const fusionado: ModeloUMLCanonico = {
    ...actual,
    clases: [...actual.clases, ...clases],
    relaciones: [...actual.relaciones, ...relaciones],
  }
  const validacion = validarModelo(fusionado)
  if (!validacion.valido) {
    throw new ErrorIntegracionCandidato(validacion.diagnosticos.filter((diagnostico) => diagnostico.severidad === "error").map((diagnostico) => diagnostico.mensaje).join(" "))
  }
  return fusionado
}
