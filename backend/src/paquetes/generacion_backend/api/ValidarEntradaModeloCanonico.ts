import type { ModeloUMLCanonicoEntrada } from "../casos_uso/cu09_generar_backend_spring_boot/ContratoModeloUMLCanonico.js"

const tiposRelacion = new Set([
  "asociacion",
  "agregacion",
  "composicion",
  "generalizacion",
])

function esAtributoEntrada(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false
  const atributo = valor as Record<string, unknown>
  return typeof atributo.id === "string" &&
    typeof atributo.nombre === "string" &&
    (typeof atributo.tipo === "string" || atributo.tipo === null)
}

function esRelacionEntrada(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false
  const relacion = valor as Record<string, unknown>
  return typeof relacion.id === "string" &&
    typeof relacion.tipo === "string" &&
    tiposRelacion.has(relacion.tipo) &&
    typeof relacion.claseOrigenId === "string" &&
    typeof relacion.claseDestinoId === "string"
}

export function esModeloUMLCanonicoEntrada(valor: unknown): valor is ModeloUMLCanonicoEntrada {
  if (!valor || typeof valor !== "object") return false
  const modelo = valor as Record<string, unknown>
  return typeof modelo.id === "string" &&
    typeof modelo.nombre === "string" &&
    typeof modelo.version === "string" &&
    Array.isArray(modelo.clases) &&
    Array.isArray(modelo.relaciones) &&
    modelo.clases.every((clase) => {
      if (!clase || typeof clase !== "object") return false
      const candidata = clase as Record<string, unknown>
      return typeof candidata.id === "string" &&
        typeof candidata.nombre === "string" &&
        typeof candidata.abstracta === "boolean" &&
        Array.isArray(candidata.atributos) &&
        candidata.atributos.every(esAtributoEntrada)
    }) &&
    modelo.relaciones.every(esRelacionEntrada)
}
