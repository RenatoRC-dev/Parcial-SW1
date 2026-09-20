import type { ModeloUMLCanonicoEntrada } from "../casos_uso/cu09_generar_backend_spring_boot/ContratoModeloUMLCanonico.js"

const tiposRelacion = new Set([
  "asociacion",
  "agregacion",
  "composicion",
  "generalizacion",
])
const multiplicidades = new Set(["0..1", "1", "0..*", "1..*"])

function esMultiplicidad(valor: unknown): boolean {
  return valor === null || (typeof valor === "string" && multiplicidades.has(valor))
}

function esRolOpcional(valor: unknown): boolean {
  return valor === undefined || typeof valor === "string"
}

function esTextoOpcional(valor: unknown): boolean {
  return valor === undefined || typeof valor === "string"
}

function esAtributoEntrada(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false
  const atributo = valor as Record<string, unknown>
  return typeof atributo.id === "string" &&
    typeof atributo.nombre === "string" &&
    (typeof atributo.tipo === "string" || atributo.tipo === null)
}

function esMetodoEntrada(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false
  const metodo = valor as Record<string, unknown>
  return typeof metodo.id === "string" && typeof metodo.nombre === "string" &&
    (metodo.visibilidad === "publica" || metodo.visibilidad === "privada") &&
    typeof metodo.tipoRetorno === "string" && Array.isArray(metodo.parametros) &&
    metodo.parametros.every((valorParametro) => {
      if (!valorParametro || typeof valorParametro !== "object") return false
      const parametro = valorParametro as Record<string, unknown>
      return typeof parametro.id === "string" && typeof parametro.nombre === "string" && typeof parametro.tipo === "string"
    })
}

function esRelacionEntrada(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false
  const relacion = valor as Record<string, unknown>
  return typeof relacion.id === "string" &&
    typeof relacion.tipo === "string" &&
    tiposRelacion.has(relacion.tipo) &&
    typeof relacion.claseOrigenId === "string" &&
    typeof relacion.claseDestinoId === "string" &&
    esTextoOpcional(relacion.nombre) &&
    esMultiplicidad(relacion.multiplicidadOrigen) &&
    esMultiplicidad(relacion.multiplicidadDestino) &&
    esRolOpcional(relacion.rolOrigen) &&
    esRolOpcional(relacion.rolDestino)
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
        (candidata.tipoClase === undefined || candidata.tipoClase === "normal" || candidata.tipoClase === "asociativa") &&
        Array.isArray(candidata.atributos) &&
        candidata.atributos.every(esAtributoEntrada) &&
        (candidata.metodos === undefined || (Array.isArray(candidata.metodos) && candidata.metodos.every(esMetodoEntrada)))
    }) &&
    modelo.relaciones.every(esRelacionEntrada)
}
