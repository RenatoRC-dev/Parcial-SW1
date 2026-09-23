import type {
  CandidatoModeloUMLImagen,
  MultiplicidadCandidata,
  ResultadoVisionUML,
} from "../../compartido/contrato/CandidatoModeloUMLImagen.js"

const MAX_CLASES = 30
const MAX_ATRIBUTOS = 50
const MAX_RELACIONES = 60
const MAX_TEXTO = 200
const MULTIPLICIDADES = new Set<Multiplicity>(["0..1", "1", "0..*", "1..*"])
type Multiplicity = MultiplicidadCandidata

function registro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown, maximo = MAX_TEXTO): valor is string {
  return typeof valor === "string" && valor.trim().length > 0 && valor.length <= maximo
}

function textoOpcional(valor: unknown): valor is string | null {
  return valor === null || (typeof valor === "string" && valor.length <= MAX_TEXTO)
}

export function esCandidatoModeloUMLImagen(valor: unknown): valor is CandidatoModeloUMLImagen {
  if (!registro(valor) || !Array.isArray(valor.clases) || !Array.isArray(valor.relaciones) || !Array.isArray(valor.advertencias)) return false
  if (valor.clases.length === 0 || valor.clases.length > MAX_CLASES || valor.relaciones.length > MAX_RELACIONES) return false
  if (!valor.advertencias.every((advertencia) => typeof advertencia === "string" && advertencia.length <= 500)) return false

  const refsClases = new Set<string>()
  const nombresClases = new Set<string>()
  const refsAtributos = new Set<string>()
  for (const clase of valor.clases) {
    if (!registro(clase) || !texto(clase.refTemporal) || !texto(clase.nombre) || !Array.isArray(clase.atributos) || clase.atributos.length > MAX_ATRIBUTOS) return false
    const claveNombre = clase.nombre.trim().toLowerCase()
    if (refsClases.has(clase.refTemporal) || nombresClases.has(claveNombre)) return false
    refsClases.add(clase.refTemporal)
    nombresClases.add(claveNombre)
    const nombresAtributos = new Set<string>()
    for (const atributo of clase.atributos) {
      if (!registro(atributo) || !texto(atributo.refTemporal) || !texto(atributo.nombre) || !textoOpcional(atributo.tipoDato)
        || !(atributo.visibilidad === undefined || atributo.visibilidad === "publica" || atributo.visibilidad === "privada" || atributo.visibilidad === "protegida" || atributo.visibilidad === "paquete")) return false
      const claveAtributo = atributo.nombre.trim().toLowerCase()
      if (refsAtributos.has(atributo.refTemporal) || nombresAtributos.has(claveAtributo)) return false
      refsAtributos.add(atributo.refTemporal)
      nombresAtributos.add(claveAtributo)
    }
  }

  const refsRelaciones = new Set<string>()
  for (const relacion of valor.relaciones) {
    if (!registro(relacion) || !texto(relacion.refTemporal) || relacion.tipo !== "asociacion") return false
    if (!texto(relacion.origenRef) || !texto(relacion.destinoRef) || !refsClases.has(relacion.origenRef) || !refsClases.has(relacion.destinoRef)) return false
    if (!MULTIPLICIDADES.has(relacion.multiplicidadOrigen as Multiplicity) || !MULTIPLICIDADES.has(relacion.multiplicidadDestino as Multiplicity)) return false
    if (!textoOpcional(relacion.rolOrigen) || !textoOpcional(relacion.rolDestino) || refsRelaciones.has(relacion.refTemporal)) return false
    refsRelaciones.add(relacion.refTemporal)
  }
  return true
}

export function esResultadoVisionUML(valor: unknown): valor is ResultadoVisionUML {
  if (!registro(valor) || !texto(valor.mensaje, 500) || !texto(valor.modelo)) return false
  if (valor.resultado === "sin_modelo") return valor.candidato === null
  return valor.resultado === "candidato" && esCandidatoModeloUMLImagen(valor.candidato)
}
