import { TIPOS_GENERACION_SOPORTADOS } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import type { AtributoCandidatoImagen } from "./CandidatoModeloUMLImagen"

const tiposSoportados = new Set<string>(TIPOS_GENERACION_SOPORTADOS)

export type ImportabilidadAtributo =
  | { importable: true; tipo: string }
  | { importable: false; motivo: "tipo_no_visible" | "tipo_no_soportado" }

export function evaluarAtributoCandidato(atributo: AtributoCandidatoImagen): ImportabilidadAtributo {
  const tipo = atributo.tipoDato?.trim() ?? ""
  if (tipo === "") return { importable: false, motivo: "tipo_no_visible" }
  if (!tiposSoportados.has(tipo)) return { importable: false, motivo: "tipo_no_soportado" }
  return { importable: true, tipo }
}
