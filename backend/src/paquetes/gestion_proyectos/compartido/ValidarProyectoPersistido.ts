import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"

const tiposRelacion = new Set(["asociacion", "agregacion", "composicion", "generalizacion"])
const multiplicidades = new Set([null, "0..1", "1", "0..*", "1..*"])

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0
}

export function esModeloUMLPersistible(valor: unknown): valor is ModeloUMLCanonicoIntercambio {
  if (!objeto(valor) || !texto(valor.id) || !texto(valor.nombre) || !texto(valor.version)
    || !Array.isArray(valor.clases) || !Array.isArray(valor.relaciones)) return false

  const idsClases = new Set<string>()
  const idsElementos = new Set<string>()
  for (const clase of valor.clases) {
    if (!objeto(clase) || !texto(clase.id) || !texto(clase.nombre) || typeof clase.abstracta !== "boolean"
      || !(clase.tipoClase === undefined || clase.tipoClase === "normal" || clase.tipoClase === "asociativa")
      || !objeto(clase.posicion) || typeof clase.posicion.x !== "number" || !Number.isFinite(clase.posicion.x)
      || typeof clase.posicion.y !== "number" || !Number.isFinite(clase.posicion.y) || !Array.isArray(clase.atributos)
      || idsClases.has(clase.id) || idsElementos.has(clase.id)) return false
    idsClases.add(clase.id)
    idsElementos.add(clase.id)
    for (const atributo of clase.atributos) {
      if (!objeto(atributo) || !texto(atributo.id) || !texto(atributo.nombre)
        || !(atributo.tipo === null || typeof atributo.tipo === "string")
        || !(atributo.visibilidad === undefined || atributo.visibilidad === "publica" || atributo.visibilidad === "privada" || atributo.visibilidad === "protegida" || atributo.visibilidad === "paquete")
        || idsElementos.has(atributo.id)) return false
      idsElementos.add(atributo.id)
    }
    if (!(clase.metodos === undefined || Array.isArray(clase.metodos))) return false
    for (const metodo of clase.metodos ?? []) {
      if (!objeto(metodo) || !texto(metodo.id) || !texto(metodo.nombre)
        || !(metodo.visibilidad === "publica" || metodo.visibilidad === "privada")
        || !texto(metodo.tipoRetorno) || !Array.isArray(metodo.parametros)
        || idsElementos.has(metodo.id)) return false
      idsElementos.add(metodo.id)
      const idsParametros = new Set<string>()
      for (const parametro of metodo.parametros) {
        if (!objeto(parametro) || !texto(parametro.id) || !texto(parametro.nombre) || !texto(parametro.tipo)
          || idsParametros.has(parametro.id)) return false
        idsParametros.add(parametro.id)
      }
    }
  }

  for (const relacion of valor.relaciones) {
    if (!objeto(relacion) || !texto(relacion.id) || !tiposRelacion.has(relacion.tipo as string)
      || !texto(relacion.claseOrigenId) || !texto(relacion.claseDestinoId)
      || !idsClases.has(relacion.claseOrigenId) || !idsClases.has(relacion.claseDestinoId)
      || !multiplicidades.has(relacion.multiplicidadOrigen as string | null)
      || !multiplicidades.has(relacion.multiplicidadDestino as string | null)
      || !(relacion.rolOrigen === undefined || typeof relacion.rolOrigen === "string")
      || !(relacion.rolDestino === undefined || typeof relacion.rolDestino === "string")
      || (relacion.tipo === "generalizacion" && (relacion.multiplicidadOrigen !== null || relacion.multiplicidadDestino !== null || relacion.rolOrigen !== undefined || relacion.rolDestino !== undefined))
      || idsElementos.has(relacion.id)) return false
    idsElementos.add(relacion.id)
  }
  return true
}
