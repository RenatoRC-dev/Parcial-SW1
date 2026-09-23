const multiplicidad = { type: "string", enum: ["0..1", "1", "0..*", "1..*"] } as const
const multiplicidadNullable = { anyOf: [multiplicidad, { type: "null" }] } as const
const visibilidadAtributoNullable = { anyOf: [{ type: "string", enum: ["publica", "privada", "protegida", "paquete"] }, { type: "null" }] } as const
const visibilidadNullable = { anyOf: [{ type: "string", enum: ["publica", "privada"] }, { type: "null" }] } as const
const cadenaNullable = { type: ["string", "null"] } as const
const visibilidad = { type: "string", enum: ["publica", "privada"] } as const

const comando = (propiedades: Record<string, unknown>, requeridas: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties: propiedades,
  required: requeridas,
})

const parametroNuevo = comando(
  { refTemporal: { type: "string" }, nombre: { type: "string" }, tipo: { type: "string" } },
  ["refTemporal", "nombre", "tipo"],
)

export const ESQUEMA_RESPUESTA_GROQ = {
  type: "object",
  additionalProperties: false,
  properties: {
    resultado: { type: "string", enum: ["aplicar", "aclarar", "rechazar"] },
    mensaje: { type: "string" },
    comandos: {
      type: "array",
      items: {
        anyOf: [
          comando({ tipo: { const: "crear_clase" }, refTemporal: { type: "string" }, nombre: { type: "string" }, abstracta: { type: "boolean" } }, ["tipo", "refTemporal", "nombre", "abstracta"]),
          comando({ tipo: { const: "crear_clase_asociativa" }, refTemporal: { type: "string" }, nombre: { type: "string" }, claseARef: { type: "string" }, claseBRef: { type: "string" } }, ["tipo", "refTemporal", "nombre", "claseARef", "claseBRef"]),
          comando({ tipo: { const: "convertir_relacion_en_clase_asociativa" }, refTemporal: { type: "string" }, nombre: { type: "string" }, relacionId: { type: "string" } }, ["tipo", "refTemporal", "nombre", "relacionId"]),
          comando({ tipo: { const: "renombrar_clase" }, claseId: { type: "string" }, nuevoNombre: { type: "string" } }, ["tipo", "claseId", "nuevoNombre"]),
          comando({ tipo: { const: "eliminar_clase" }, claseId: { type: "string" } }, ["tipo", "claseId"]),
          comando({ tipo: { const: "agregar_atributo" }, claseRef: { type: "string" }, refTemporal: { type: "string" }, nombre: { type: "string" }, tipoDato: { type: "string" }, visibilidad: visibilidadAtributoNullable }, ["tipo", "claseRef", "refTemporal", "nombre", "tipoDato", "visibilidad"]),
          comando({ tipo: { const: "modificar_atributo" }, atributoId: { type: "string" }, nuevoNombre: cadenaNullable, nuevoTipo: cadenaNullable, nuevaVisibilidad: visibilidadAtributoNullable }, ["tipo", "atributoId", "nuevoNombre", "nuevoTipo", "nuevaVisibilidad"]),
          comando({ tipo: { const: "eliminar_atributo" }, atributoId: { type: "string" } }, ["tipo", "atributoId"]),
          comando({ tipo: { const: "crear_metodo" }, claseRef: { type: "string" }, refTemporal: { type: "string" }, nombre: { type: "string" }, tipoRetorno: { type: "string" }, visibilidad, parametros: { type: "array", items: parametroNuevo } }, ["tipo", "claseRef", "refTemporal", "nombre", "tipoRetorno", "visibilidad", "parametros"]),
          comando({ tipo: { const: "modificar_metodo" }, metodoId: { type: "string" }, nuevoNombre: cadenaNullable, nuevoTipoRetorno: cadenaNullable, nuevaVisibilidad: visibilidadNullable }, ["tipo", "metodoId", "nuevoNombre", "nuevoTipoRetorno", "nuevaVisibilidad"]),
          comando({ tipo: { const: "eliminar_metodo" }, metodoId: { type: "string" } }, ["tipo", "metodoId"]),
          comando({ tipo: { const: "agregar_parametro" }, metodoId: { type: "string" }, refTemporal: { type: "string" }, nombre: { type: "string" }, tipoDato: { type: "string" } }, ["tipo", "metodoId", "refTemporal", "nombre", "tipoDato"]),
          comando({ tipo: { const: "modificar_parametro" }, parametroId: { type: "string" }, nuevoNombre: cadenaNullable, nuevoTipo: cadenaNullable }, ["tipo", "parametroId", "nuevoNombre", "nuevoTipo"]),
          comando({ tipo: { const: "eliminar_parametro" }, parametroId: { type: "string" } }, ["tipo", "parametroId"]),
          comando({ tipo: { const: "crear_asociacion" }, refTemporal: { type: "string" }, claseOrigenRef: { type: "string" }, claseDestinoRef: { type: "string" }, cantidadDestinoPorOrigen: multiplicidadNullable, cantidadOrigenPorDestino: multiplicidadNullable, rolOrigen: cadenaNullable, rolDestino: cadenaNullable }, ["tipo", "refTemporal", "claseOrigenRef", "claseDestinoRef", "cantidadDestinoPorOrigen", "cantidadOrigenPorDestino", "rolOrigen", "rolDestino"]),
          comando({ tipo: { const: "crear_agregacion" }, refTemporal: { type: "string" }, parteRef: { type: "string" }, todoRef: { type: "string" }, cantidadPartesPorTodo: multiplicidadNullable, cantidadTodosPorParte: multiplicidadNullable, rolParte: cadenaNullable, rolTodo: cadenaNullable }, ["tipo", "refTemporal", "parteRef", "todoRef", "cantidadPartesPorTodo", "cantidadTodosPorParte", "rolParte", "rolTodo"]),
          comando({ tipo: { const: "crear_composicion" }, refTemporal: { type: "string" }, parteRef: { type: "string" }, todoRef: { type: "string" }, cantidadPartesPorTodo: multiplicidadNullable, cantidadTodosPorParte: multiplicidadNullable, rolParte: cadenaNullable, rolTodo: cadenaNullable }, ["tipo", "refTemporal", "parteRef", "todoRef", "cantidadPartesPorTodo", "cantidadTodosPorParte", "rolParte", "rolTodo"]),
          comando({ tipo: { const: "crear_generalizacion" }, refTemporal: { type: "string" }, subclaseRef: { type: "string" }, superclaseRef: { type: "string" } }, ["tipo", "refTemporal", "subclaseRef", "superclaseRef"]),
          comando({ tipo: { const: "eliminar_relacion" }, relacionId: { type: "string" } }, ["tipo", "relacionId"]),
          comando({ tipo: { const: "cambiar_multiplicidad" }, relacionId: { type: "string" }, cantidadDestinoPorOrigen: multiplicidad, cantidadOrigenPorDestino: multiplicidad }, ["tipo", "relacionId", "cantidadDestinoPorOrigen", "cantidadOrigenPorDestino"]),
        ],
      },
    },
  },
  required: ["resultado", "mensaje", "comandos"],
} as const

/** Adapta los discriminadores exclusivos de Groq al contrato interno estable. */
export function normalizarRespuestaGroq(valor: unknown): unknown {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return valor
  const respuesta = valor as Record<string, unknown>
  if (!Array.isArray(respuesta.comandos)) return valor
  return {
    ...respuesta,
    comandos: respuesta.comandos.map((desconocido) => {
      if (typeof desconocido !== "object" || desconocido === null || Array.isArray(desconocido)) return desconocido
      const comando = desconocido as Record<string, unknown>
      const tipos: Record<string, string> = {
        crear_asociacion: "asociacion",
        crear_agregacion: "agregacion",
        crear_composicion: "composicion",
        crear_generalizacion: "generalizacion",
      }
      const tipoRelacion = typeof comando.tipo === "string" ? tipos[comando.tipo] : undefined
      return tipoRelacion ? { ...comando, tipo: "crear_relacion", tipoRelacion } : desconocido
    }),
  }
}
