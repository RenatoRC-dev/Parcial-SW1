import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"

export interface ResultadoAptitudGeneracion {
  apto: boolean
  motivos: string[]
}

const nombresEnConflicto = new Set([
  "String", "Integer", "Long", "Double", "Float", "Boolean",
  "BigDecimal", "LocalDate", "LocalDateTime", "UUID",
])

export function evaluarAptitudGeneracionSpring(
  modelo: ModeloUMLCanonico,
  validacion: ResultadoValidacion
): ResultadoAptitudGeneracion {
  const motivos: string[] = []
  if (!validacion.valido) motivos.push("El modelo contiene errores de validación UML.")
  if (modelo.relaciones.length > 0) motivos.push("La generación de relaciones todavía no está soportada.")

  for (const clase of modelo.clases) {
    if (clase.abstracta) motivos.push(`La clase abstracta ${clase.nombre} no puede generarse todavía.`)
    if (nombresEnConflicto.has(clase.nombre.trim())) {
      motivos.push(`El nombre de entidad ${clase.nombre} entra en conflicto con un tipo Java.`)
    }
  }

  return { apto: motivos.length === 0, motivos }
}
