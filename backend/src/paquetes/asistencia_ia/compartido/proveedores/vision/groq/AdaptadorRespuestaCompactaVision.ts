import type { ResultadoVisionUML } from "../../../contrato/CandidatoModeloUMLImagen.js"
import { esResultadoVisionUML } from "../../../../casos_uso/cu05_modelar_desde_imagen/validarCandidatoModeloUML.js"
import { ErrorProveedorVision } from "../ProveedorVisionUML.js"

const MULTIPLICIDADES = new Set(["0..1", "1", "0..*", "1..*"])
const VISIBILIDADES: Readonly<Record<string, "publica" | "privada" | "protegida" | "paquete">> = {
  "+": "publica", "-": "privada", "#": "protegida", "~": "paquete",
  publica: "publica", privada: "privada", protegida: "protegida", paquete: "paquete",
}
const ADVERTENCIAS: Readonly<Record<string, string>> = {
  agregacion: "Se detectó una agregación, semántica no soportada por el perfil visual actual.",
  composicion: "Se detectó una composición, semántica no soportada por el perfil visual actual.",
  generalizacion: "Se detectó una generalización, semántica no soportada por el perfil visual actual.",
  multiplicidad_ilegible: "Se omitió una relación cuya multiplicidad no era legible.",
  texto_ilegible: "Parte del texto del diagrama no era legible.",
  diagrama_parcial: "El análisis visual puede ser parcial.",
}

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0
}

function invalida(): never {
  throw new ErrorProveedorVision("respuesta_invalida", "La respuesta visual compacta no cumple el contrato del proveedor.")
}

export function adaptarRespuestaCompactaVision(valor: unknown, modelo: string): ResultadoVisionUML {
  if (!esRegistro(valor)) return invalida()
  if (valor.n === true && Object.keys(valor).every((clave) => clave === "n")) {
    return { resultado: "sin_modelo", mensaje: "No se detectó un diagrama de clases UML reconocible.", candidato: null, modelo }
  }
  if (!Array.isArray(valor.c) || !Array.isArray(valor.r) || !Array.isArray(valor.w)) return invalida()

  const referenciasClase = new Map<string, string>()
  const clases = valor.c.map((clase, indiceClase) => {
    if (!Array.isArray(clase) || clase.length !== 2 || !esTexto(clase[0]) || !Array.isArray(clase[1])) return invalida()
    const nombre = clase[0].trim()
    const clave = nombre.toLowerCase()
    if (referenciasClase.has(clave)) return invalida()
    const refTemporal = `tmp_clase_${indiceClase + 1}`
    referenciasClase.set(clave, refTemporal)
    const atributos = clase[1].map((atributo, indiceAtributo) => {
      if (!Array.isArray(atributo) || (atributo.length !== 2 && atributo.length !== 3) || !esTexto(atributo[0])) return invalida()
      if (atributo[1] !== null && typeof atributo[1] !== "string") return invalida()
      const visibilidad = atributo[2] === null || atributo[2] === undefined ? undefined : VISIBILIDADES[String(atributo[2]).toLowerCase()]
      if (atributo.length === 3 && atributo[2] !== null && !visibilidad) return invalida()
      return {
        refTemporal: `tmp_atributo_${indiceClase + 1}_${indiceAtributo + 1}`,
        nombre: atributo[0].trim(),
        tipoDato: typeof atributo[1] === "string" && atributo[1].trim() !== "" ? atributo[1].trim() : null,
        ...(visibilidad ? { visibilidad } : {}),
      }
    })
    return { refTemporal, nombre, atributos }
  })

  const relaciones = valor.r.map((relacion, indice) => {
    if (!Array.isArray(relacion) || relacion.length !== 6) return invalida()
    const [origen, destino, multiplicidadOrigen, multiplicidadDestino, rolOrigen, rolDestino] = relacion
    if (!esTexto(origen) || !esTexto(destino)
      || !MULTIPLICIDADES.has(String(multiplicidadOrigen)) || !MULTIPLICIDADES.has(String(multiplicidadDestino))
      || (rolOrigen !== null && typeof rolOrigen !== "string") || (rolDestino !== null && typeof rolDestino !== "string")) return invalida()
    const origenRef = referenciasClase.get(origen.trim().toLowerCase())
    const destinoRef = referenciasClase.get(destino.trim().toLowerCase())
    if (!origenRef || !destinoRef) return invalida()
    return {
      refTemporal: `tmp_relacion_${indice + 1}`,
      tipo: "asociacion" as const,
      origenRef,
      destinoRef,
      multiplicidadOrigen: multiplicidadOrigen as "0..1" | "1" | "0..*" | "1..*",
      multiplicidadDestino: multiplicidadDestino as "0..1" | "1" | "0..*" | "1..*",
      rolOrigen: typeof rolOrigen === "string" && rolOrigen.trim() !== "" ? rolOrigen.trim() : null,
      rolDestino: typeof rolDestino === "string" && rolDestino.trim() !== "" ? rolDestino.trim() : null,
    }
  })

  const advertencias = valor.w.map((codigo) => {
    if (typeof codigo !== "string" || !ADVERTENCIAS[codigo]) return invalida()
    return ADVERTENCIAS[codigo]
  })
  const resultado: ResultadoVisionUML = {
    resultado: "candidato",
    mensaje: "Candidato visual detectado.",
    candidato: { clases, relaciones, advertencias },
    modelo,
  }
  if (!esResultadoVisionUML(resultado)) return invalida()
  return resultado
}
