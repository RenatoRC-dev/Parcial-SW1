const multiplicidad = { type: "string", enum: ["0..1", "1", "0..*", "1..*"] } as const
const visibilidadNullable = { anyOf: [{ type: "string", enum: ["publica", "privada"] }, { type: "null" }] } as const
const cadenaNullable = { type: ["string", "null"] } as const

const comando = (propiedades: Record<string, unknown>, requeridas: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties: propiedades,
  required: requeridas,
})

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
          comando({ tipo: { const: "renombrar_clase" }, claseId: { type: "string" }, nuevoNombre: { type: "string" } }, ["tipo", "claseId", "nuevoNombre"]),
          comando({ tipo: { const: "eliminar_clase" }, claseId: { type: "string" } }, ["tipo", "claseId"]),
          comando({ tipo: { const: "agregar_atributo" }, claseRef: { type: "string" }, refTemporal: { type: "string" }, nombre: { type: "string" }, tipoDato: { type: "string" }, visibilidad: visibilidadNullable }, ["tipo", "claseRef", "refTemporal", "nombre", "tipoDato", "visibilidad"]),
          comando({ tipo: { const: "modificar_atributo" }, atributoId: { type: "string" }, nuevoNombre: cadenaNullable, nuevoTipo: cadenaNullable, nuevaVisibilidad: visibilidadNullable }, ["tipo", "atributoId", "nuevoNombre", "nuevoTipo", "nuevaVisibilidad"]),
          comando({ tipo: { const: "eliminar_atributo" }, atributoId: { type: "string" } }, ["tipo", "atributoId"]),
          comando({ tipo: { const: "crear_relacion" }, refTemporal: { type: "string" }, claseOrigenRef: { type: "string" }, claseDestinoRef: { type: "string" }, tipoRelacion: { const: "asociacion" }, multiplicidadOrigen: multiplicidad, multiplicidadDestino: multiplicidad, rolOrigen: cadenaNullable, rolDestino: cadenaNullable }, ["tipo", "refTemporal", "claseOrigenRef", "claseDestinoRef", "tipoRelacion", "multiplicidadOrigen", "multiplicidadDestino", "rolOrigen", "rolDestino"]),
          comando({ tipo: { const: "eliminar_relacion" }, relacionId: { type: "string" } }, ["tipo", "relacionId"]),
          comando({ tipo: { const: "cambiar_multiplicidad" }, relacionId: { type: "string" }, multiplicidadOrigen: multiplicidad, multiplicidadDestino: multiplicidad }, ["tipo", "relacionId", "multiplicidadOrigen", "multiplicidadDestino"]),
        ],
      },
    },
  },
  required: ["resultado", "mensaje", "comandos"],
} as const
