import type { ModeloUMLCanonicoIntercambio as ModeloUMLCanonico } from "../../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import { TIPOS_GENERACION_SOPORTADOS, validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"
import type { CandidatoModeloUMLImagen, AtributoCandidatoImagen } from "../../compartido/contrato/CandidatoModeloUMLImagen.js"

export class ErrorIntegracionCandidato extends Error {}
export type ImportabilidadAtributo = { importable: true; tipo: string } | { importable: false; motivo: "tipo_no_visible" | "tipo_no_soportado" }
const tipos = new Set<string>(TIPOS_GENERACION_SOPORTADOS)
export function evaluarAtributoCandidato(atributo: AtributoCandidatoImagen): ImportabilidadAtributo {
  const tipo = atributo.tipoDato?.trim() ?? ""
  if (!tipo) return { importable: false, motivo: "tipo_no_visible" }
  return tipos.has(tipo) ? { importable: true, tipo } : { importable: false, motivo: "tipo_no_soportado" }
}

/** Misma fusión CU05 para pantalla manual y chat: exclusivamente aditiva. */
export function aplicarCandidatoImagen(actual: ModeloUMLCanonico, candidato: CandidatoModeloUMLImagen,
  generarId: (categoria: "clase" | "atributo" | "relacion") => string = (categoria) => `${categoria}-${crypto.randomUUID()}`): ModeloUMLCanonico {
  const nombres = new Set(actual.clases.map((clase) => clase.nombre.trim().toLowerCase()))
  const colision = candidato.clases.find((clase) => nombres.has(clase.nombre.trim().toLowerCase()))
  if (colision) throw new ErrorIntegracionCandidato(`No se puede agregar el candidato porque ya existe la clase ${colision.nombre}.`)
  for (const clase of candidato.clases) {
    if (clase.atributos.some((a) => a.nombre.trim().toLowerCase() === "id" && a.tipoDato?.trim() && a.tipoDato.trim() !== "Long")) throw new ErrorIntegracionCandidato(`El atributo "id" de la clase ${clase.nombre} debe utilizar el tipo Long.`)
  }
  const referencias = new Map<string, string>()
  const inicioX = (actual.clases.length ? Math.max(...actual.clases.map((c) => c.posicion.x)) : -250) + 350
  const clases = candidato.clases.map((clase, indice) => {
    const id = generarId("clase"); referencias.set(clase.refTemporal, id)
    return { id, nombre: clase.nombre.trim(), abstracta: false, posicion: { x: inicioX + (indice % 2) * 350, y: 100 + Math.floor(indice / 2) * 250 }, metodos: [],
      atributos: clase.atributos.flatMap((atributo) => { const evaluacion = evaluarAtributoCandidato(atributo)
        return evaluacion.importable ? [{ id: generarId("atributo"), nombre: atributo.nombre.trim(), tipo: evaluacion.tipo, visibilidad: atributo.visibilidad ?? "privada" }] : [] }) }
  })
  const relaciones = candidato.relaciones.map((r) => {
    const claseOrigenId = referencias.get(r.origenRef); const claseDestinoId = referencias.get(r.destinoRef)
    if (!claseOrigenId || !claseDestinoId) throw new ErrorIntegracionCandidato("El candidato contiene una relación con extremos inválidos.")
    return { id: generarId("relacion"), tipo: r.tipo, claseOrigenId, claseDestinoId, multiplicidadOrigen: r.multiplicidadOrigen, multiplicidadDestino: r.multiplicidadDestino,
      ...(r.rolOrigen ? { rolOrigen: r.rolOrigen } : {}), ...(r.rolDestino ? { rolDestino: r.rolDestino } : {}) }
  })
  const fusionado = { ...actual, clases: [...actual.clases, ...clases], relaciones: [...actual.relaciones, ...relaciones] }
  const validacion = validarModelo(fusionado)
  if (!validacion.valido) throw new ErrorIntegracionCandidato(validacion.diagnosticos.filter((d) => d.severidad === "error").map((d) => d.mensaje).join(" "))
  return fusionado
}
