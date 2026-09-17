import type { ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import type { SolicitudInterpretacionUML } from "../../compartido/contrato/PlanCambiosUML.js"

const relaciones = new Set(["asociacion", "agregacion", "composicion", "generalizacion"])
const multiplicidades = new Set(["0..1", "1", "0..*", "1..*"])

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function esModelo(valor: unknown): valor is ModeloUMLCanonicoIA {
  if (!objeto(valor) || typeof valor.id !== "string" || typeof valor.nombre !== "string" || typeof valor.version !== "string" || !Array.isArray(valor.clases) || !Array.isArray(valor.relaciones)) return false
  const clasesValidas = valor.clases.every((candidata) => {
    if (!objeto(candidata) || typeof candidata.id !== "string" || typeof candidata.nombre !== "string" || typeof candidata.abstracta !== "boolean" || !objeto(candidata.posicion) || typeof candidata.posicion.x !== "number" || typeof candidata.posicion.y !== "number" || !Array.isArray(candidata.atributos)) return false
    return candidata.atributos.every((atributo) => objeto(atributo) && typeof atributo.id === "string" && typeof atributo.nombre === "string" && (typeof atributo.tipo === "string" || atributo.tipo === null) && (atributo.visibilidad === undefined || atributo.visibilidad === "publica" || atributo.visibilidad === "privada"))
  })
  const relacionesValidas = valor.relaciones.every((relacion) => objeto(relacion) && typeof relacion.id === "string" && typeof relacion.tipo === "string" && relaciones.has(relacion.tipo) && typeof relacion.claseOrigenId === "string" && typeof relacion.claseDestinoId === "string" && (relacion.multiplicidadOrigen === null || (typeof relacion.multiplicidadOrigen === "string" && multiplicidades.has(relacion.multiplicidadOrigen))) && (relacion.multiplicidadDestino === null || (typeof relacion.multiplicidadDestino === "string" && multiplicidades.has(relacion.multiplicidadDestino))) && (relacion.rolOrigen === undefined || typeof relacion.rolOrigen === "string") && (relacion.rolDestino === undefined || typeof relacion.rolDestino === "string"))
  return clasesValidas && relacionesValidas
}

export function validarSolicitudInterpretacion(valor: unknown): SolicitudInterpretacionUML | null {
  if (!objeto(valor) || typeof valor.instruccion !== "string" || !Number.isInteger(valor.revision) || Number(valor.revision) < 0 || !esModelo(valor.modelo)) return null
  const instruccion = valor.instruccion.trim()
  if (instruccion.length < 1 || instruccion.length > 2000) return null
  return { instruccion, modelo: valor.modelo, revision: Number(valor.revision) }
}
