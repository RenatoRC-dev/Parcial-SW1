import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ResultadoAptitudGeneracion } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/EvaluadorAptitudGeneracionSpring"
import type { ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"

export const ACCIONES_ASISTENTE_CONTEXTUAL = ["NINGUNA", "ENFOCAR_ELEMENTO", "IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI", "MOSTRAR_IMAGEN_CANDIDATA"] as const
export type AccionAsistenteContextual = typeof ACCIONES_ASISTENTE_CONTEXTUAL[number]

export interface ClaseContextual {
  id: string
  nombre: string
  tipoClase: "normal" | "asociativa"
  abstracta: boolean
  atributos: Array<{ nombre: string; tipo: string | null; visibilidad: string | null }>
  operaciones: Array<{ nombre: string; tipoRetorno: string; parametros: Array<{ nombre: string; tipo: string }> }>
}

export interface RelacionContextual {
  id: string
  nombre: string | null
  tipoRelacion: string
  origen: { id: string; nombre: string; multiplicidad: string | null; rol: string | null }
  destino: { id: string; nombre: string; multiplicidad: string | null; rol: string | null }
}

export type ElementoSeleccionadoContextual =
  | ({ tipo: "clase"; relacionesConectadas: string[] } & ClaseContextual)
  | ({ tipo: "relacion" } & RelacionContextual)

export interface ContextoAsistente {
  proyecto: { id: string; nombre: string } | null
  area: "modelado_uml"
  idioma: "es" | "en"
  revisionModelo: number
  modeloActual: { id: string; nombre: string; version: string; clases: ClaseContextual[]; relaciones: RelacionContextual[]; truncado: boolean }
  elementoSeleccionado: ElementoSeleccionadoContextual | null
  elementosRelevantes: Array<{ id: string; tipo: "clase" | "relacion"; nombre: string }>
  resumenModelo: { clases: number; relaciones: number }
  estadoUml: { estado: "valido" | "invalido" | "incompleto"; problemas: string[]; errores: string[]; advertencias: string[] }
  generacion: { estado: "apto" | "no_apto"; bloqueos: string[]; advertencias: string[] }
  cambiosSinGuardar: boolean
  candidatoImagenPendiente: boolean
  accionesDisponibles: AccionAsistenteContextual[]
}

export interface RespuestaAsistenteContextual {
  respuesta: string
  accionSugerida: AccionAsistenteContextual
  elementoRelacionadoId: string | null
  nivel: "informacion" | "sugerencia" | "advertencia"
  categoriaRecomendacion: "INFORMATIVO" | "OBLIGATORIO" | "RECOMENDADO" | "OPCIONAL"
  origen?: "determinista" | "groq"
}

export interface MensajeConversacionContextual { rol: "usuario" | "asistente"; contenido: string }

function nombreSemanticoPorId(modelo: ModeloUMLCanonico): Map<string, string> {
  const nombres = new Map<string, string>()
  for (const clase of modelo.clases) {
    nombres.set(clase.id, clase.nombre)
    for (const atributo of clase.atributos) nombres.set(atributo.id, `${clase.nombre}.${atributo.nombre}`)
  }
  for (const relacion of modelo.relaciones) {
    const origen = modelo.clases.find((clase) => clase.id === relacion.claseOrigenId)?.nombre ?? "origen"
    const destino = modelo.clases.find((clase) => clase.id === relacion.claseDestinoId)?.nombre ?? "destino"
    nombres.set(relacion.id, relacion.nombre?.trim() ? `«${relacion.nombre.trim()}» entre ${origen} y ${destino}` : `${origen} — ${destino}`)
  }
  return nombres
}

export function construirContextoAsistente(entrada: {
  proyectoId: string
  proyectoNombre?: string
  modelo: ModeloUMLCanonico
  validacion: ResultadoValidacion
  aptitud: ResultadoAptitudGeneracion
  cambiosSinGuardar: boolean
  candidatoImagenPendiente: boolean
  seleccionIds?: string[]
  revisionModelo?: number
  idioma?: "es" | "en"
}): ContextoAsistente {
  const nombres = nombreSemanticoPorId(entrada.modelo)
  const incompleto = entrada.modelo.clases.some((clase) => clase.atributos.some((atributo) => !atributo.tipo?.trim()))
  const describirDiagnostico = (diagnostico: ResultadoValidacion["diagnosticos"][number]) => {
    const semantico = diagnostico.elementoId ? nombres.get(diagnostico.elementoId) : undefined
    return semantico && diagnostico.mensaje.includes(diagnostico.elementoId!)
      ? diagnostico.mensaje.replaceAll(diagnostico.elementoId!, semantico)
      : semantico ? `${semantico}: ${diagnostico.mensaje}` : diagnostico.mensaje
  }
  const errores = entrada.validacion.diagnosticos.filter((item) => item.severidad === "error").slice(0, 8).map(describirDiagnostico)
  const advertencias = entrada.validacion.diagnosticos.filter((item) => item.severidad === "advertencia").slice(0, 8).map(describirDiagnostico)
  const problemas = [...errores, ...advertencias].slice(0, 8)
  const clases = entrada.modelo.clases.slice(0, 50).map((clase): ClaseContextual => ({
    id: clase.id,
    nombre: clase.nombre,
    tipoClase: clase.tipoClase === "asociativa" ? "asociativa" : "normal",
    abstracta: clase.abstracta,
    atributos: clase.atributos.slice(0, 30).map((atributo) => ({ nombre: atributo.nombre, tipo: atributo.tipo, visibilidad: atributo.visibilidad ?? null })),
    operaciones: (clase.metodos ?? []).slice(0, 20).map((metodo) => ({ nombre: metodo.nombre, tipoRetorno: metodo.tipoRetorno, parametros: metodo.parametros.slice(0, 12).map((parametro) => ({ nombre: parametro.nombre, tipo: parametro.tipo })) })),
  }))
  const relaciones = entrada.modelo.relaciones.slice(0, 80).map((relacion): RelacionContextual => ({
    id: relacion.id,
    nombre: relacion.nombre?.trim() || null,
    tipoRelacion: relacion.tipo,
    origen: { id: relacion.claseOrigenId, nombre: nombres.get(relacion.claseOrigenId) ?? "origen", multiplicidad: relacion.multiplicidadOrigen, rol: relacion.rolOrigen ?? null },
    destino: { id: relacion.claseDestinoId, nombre: nombres.get(relacion.claseDestinoId) ?? "destino", multiplicidad: relacion.multiplicidadDestino, rol: relacion.rolDestino ?? null },
  }))
  const seleccionId = entrada.seleccionIds?.find((id) => entrada.modelo.clases.some((clase) => clase.id === id) || entrada.modelo.relaciones.some((relacion) => relacion.id === id))
  const claseSeleccionada = clases.find((clase) => clase.id === seleccionId)
  const relacionSeleccionada = relaciones.find((relacion) => relacion.id === seleccionId)
  const elementoSeleccionado: ElementoSeleccionadoContextual | null = claseSeleccionada
    ? { ...claseSeleccionada, tipo: "clase", relacionesConectadas: relaciones.filter((relacion) => relacion.origen.id === claseSeleccionada.id || relacion.destino.id === claseSeleccionada.id).map((relacion) => nombres.get(relacion.id) ?? relacion.id) }
    : relacionSeleccionada ? { ...relacionSeleccionada, tipo: "relacion" } : null
  const truncado = clases.length < entrada.modelo.clases.length || relaciones.length < entrada.modelo.relaciones.length
  const elementosRelevantes = [
    ...(elementoSeleccionado ? [{ id: elementoSeleccionado.id, tipo: elementoSeleccionado.tipo, nombre: elementoSeleccionado.tipo === "clase" ? elementoSeleccionado.nombre : nombres.get(elementoSeleccionado.id) ?? "Relación UML" }] : []),
    ...clases.map((clase) => ({ id: clase.id, tipo: "clase" as const, nombre: clase.nombre })),
    ...relaciones.map((relacion) => ({ id: relacion.id, tipo: "relacion" as const, nombre: nombres.get(relacion.id) ?? "Relación UML" })),
  ].filter((elemento, indice, todos) => todos.findIndex((actual) => actual.id === elemento.id) === indice).slice(0, 8)
  return {
    proyecto: { id: entrada.proyectoId, nombre: entrada.proyectoNombre?.trim() || entrada.modelo.nombre },
    area: "modelado_uml",
    idioma: entrada.idioma ?? "es",
    revisionModelo: entrada.revisionModelo ?? 0,
    modeloActual: { id: entrada.modelo.id, nombre: entrada.modelo.nombre, version: entrada.modelo.version, clases, relaciones, truncado },
    elementoSeleccionado,
    elementosRelevantes,
    resumenModelo: { clases: entrada.modelo.clases.length, relaciones: entrada.modelo.relaciones.length },
    estadoUml: { estado: !entrada.validacion.valido ? "invalido" : incompleto ? "incompleto" : "valido", problemas, errores, advertencias },
    generacion: {
      estado: entrada.aptitud.apto ? "apto" : "no_apto",
      bloqueos: entrada.aptitud.motivos.slice(0, 8),
      advertencias: entrada.aptitud.advertencias.slice(0, 8).map((advertencia) => advertencia.relacion),
    },
    cambiosSinGuardar: entrada.cambiosSinGuardar,
    candidatoImagenPendiente: entrada.candidatoImagenPendiente,
    accionesDisponibles: [
      "NINGUNA",
      ...(elementoSeleccionado ? ["ENFOCAR_ELEMENTO" as const] : []),
      "IR_A_VALIDACION",
      "IR_A_GENERACION",
      "IR_A_XMI",
      ...(entrada.candidatoImagenPendiente ? ["MOSTRAR_IMAGEN_CANDIDATA" as const] : []),
    ],
  }
}

export type GrupoPreguntasRapidas = "MODELO_INVALIDO" | "CLASE_SELECCIONADA" | "RELACION_SELECCIONADA" | "MODELO_VALIDO"

export function obtenerGrupoPreguntasRapidas(contexto: ContextoAsistente): GrupoPreguntasRapidas {
  if (contexto.estadoUml.estado === "invalido") return "MODELO_INVALIDO"
  if (contexto.elementoSeleccionado?.tipo === "clase") return "CLASE_SELECCIONADA"
  if (contexto.elementoSeleccionado?.tipo === "relacion") return "RELACION_SELECCIONADA"
  return "MODELO_VALIDO"
}

export type OrientacionDeterminista = "SIN_CLASES" | "UML_INVALIDO" | "IMAGEN_PENDIENTE" | "NM_DIRECTO" | "LISTO_GENERAR" | "REVISAR_GENERACION"

export function obtenerOrientacionDeterminista(contexto: ContextoAsistente): OrientacionDeterminista {
  if (contexto.resumenModelo.clases === 0) return "SIN_CLASES"
  if (contexto.estadoUml.estado === "invalido") return "UML_INVALIDO"
  if (contexto.candidatoImagenPendiente) return "IMAGEN_PENDIENTE"
  if (contexto.generacion.bloqueos.some((motivo) => motivo.includes("N:M directo"))) return "NM_DIRECTO"
  if (contexto.generacion.estado === "apto") return "LISTO_GENERAR"
  return "REVISAR_GENERACION"
}
