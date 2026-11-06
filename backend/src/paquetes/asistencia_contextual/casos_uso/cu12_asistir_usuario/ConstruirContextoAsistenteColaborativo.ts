import type { ContextoAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { ErrorProyectoNoEncontrado, type RepositorioProyectos } from "../../../gestion_proyectos/compartido/RepositorioProyectos.js"
import type { ModeloUMLCanonicoIntercambio } from "../../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import type { RepositorioMensajes } from "../../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import type { RepositorioEventos } from "../../../trazabilidad/compartido/RepositorioEventos.js"
import type { ContextoAsistente, MensajeConversacionContextual, SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import type { PreguntaAsistenteColaborativo, VistaActualColaborativa } from "../../compartido/ContratoPreguntaColaborativa.js"
import { ErrorModeloNoGenerable, prepararProyectoSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"

const MAX_MENSAJES = 16
const MAX_EVENTOS = 25

function resumirModelo(modelo: ModeloUMLCanonicoIntercambio): ContextoAsistente["modeloActual"] {
  const nombres = new Map(modelo.clases.map((clase) => [clase.id, clase.nombre]))
  const clases = modelo.clases.slice(0, 50).map((clase) => ({
    id: clase.id, nombre: clase.nombre, tipoClase: clase.tipoClase === "asociativa" ? "asociativa" as const : "normal" as const,
    abstracta: clase.abstracta,
    atributos: clase.atributos.slice(0, 30).map((atributo) => ({ nombre: atributo.nombre, tipo: atributo.tipo, visibilidad: atributo.visibilidad ?? null })),
    operaciones: (clase.metodos ?? []).slice(0, 20).map((metodo) => ({
      nombre: metodo.nombre, tipoRetorno: metodo.tipoRetorno,
      parametros: metodo.parametros.slice(0, 12).map((parametro) => ({ nombre: parametro.nombre, tipo: parametro.tipo })),
    })),
  }))
  const relaciones = modelo.relaciones.slice(0, 80).map((relacion) => ({
    id: relacion.id, nombre: relacion.nombre?.trim() || null, tipoRelacion: relacion.tipo,
    origen: { id: relacion.claseOrigenId, nombre: nombres.get(relacion.claseOrigenId) ?? relacion.claseOrigenId, multiplicidad: relacion.multiplicidadOrigen, rol: relacion.rolOrigen ?? null },
    destino: { id: relacion.claseDestinoId, nombre: nombres.get(relacion.claseDestinoId) ?? relacion.claseDestinoId, multiplicidad: relacion.multiplicidadDestino, rol: relacion.rolDestino ?? null },
  }))
  return { id: modelo.id, nombre: modelo.nombre, version: modelo.version, clases, relaciones, truncado: clases.length < modelo.clases.length || relaciones.length < modelo.relaciones.length }
}

function evaluarDurable(modelo: ModeloUMLCanonicoIntercambio): Pick<VistaActualColaborativa, "estadoUml" | "generacion"> {
  const incompletos = modelo.clases.flatMap((clase) => clase.atributos.filter((atributo) => !atributo.tipo?.trim()).map((atributo) => `${clase.nombre}.${atributo.nombre} no tiene tipo.`)).slice(0, 8)
  let generacion: VistaActualColaborativa["generacion"]
  try {
    prepararProyectoSpring(modelo)
    generacion = { estado: "apto", bloqueos: [], advertencias: [] }
  } catch (error) {
    generacion = { estado: "no_apto", bloqueos: error instanceof ErrorModeloNoGenerable ? error.errores.slice(0, 8) : ["El snapshot durable no es apto para generación."], advertencias: [] }
  }
  return {
    estadoUml: { estado: incompletos.length ? "incompleto" : "valido", problemas: incompletos, errores: [], advertencias: incompletos },
    generacion,
  }
}

function resolverSeleccion(modelo: ContextoAsistente["modeloActual"], elementoId: string | undefined): ContextoAsistente["elementoSeleccionado"] {
  if (!elementoId) return null
  const clase = modelo.clases.find((item) => item.id === elementoId)
  if (clase) return { ...clase, tipo: "clase", relacionesConectadas: modelo.relaciones.filter((relacion) => relacion.origen.id === clase.id || relacion.destino.id === clase.id).map((relacion) => relacion.nombre ?? `${relacion.origen.nombre} — ${relacion.destino.nombre}`) }
  const relacion = modelo.relaciones.find((item) => item.id === elementoId)
  return relacion ? { ...relacion, tipo: "relacion" } : null
}

export class ConstruirContextoAsistenteColaborativo {
  constructor(
    private readonly proyectos: RepositorioProyectos,
    private readonly mensajes: RepositorioMensajes,
    private readonly eventos: RepositorioEventos,
  ) {}

  async construir(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): Promise<SolicitudAsistenteContextual> {
    const proyecto = await this.proyectos.obtenerPorId(acceso.projectId)
    if (!proyecto) throw new ErrorProyectoNoEncontrado("Proyecto no encontrado.")
    const [paginaMensajes, paginaEventos] = await Promise.all([
      this.mensajes.listarPorProyecto({ projectId: acceso.projectId, limite: MAX_MENSAJES }),
      this.eventos.listarPorProyecto({ projectId: acceso.projectId, limite: MAX_EVENTOS }),
    ])
    const durable = resumirModelo(proyecto.modelo)
    const evaluacionDurable = evaluarDurable(proyecto.modelo)
    const vista = pregunta.vistaActual
    const modeloActual = vista?.modeloActual ?? durable
    const seleccion = resolverSeleccion(modeloActual, pregunta.foco?.elementoId)
    const elementosRelevantes = [
      ...(seleccion ? [{ id: seleccion.id, tipo: seleccion.tipo, nombre: seleccion.tipo === "clase" ? seleccion.nombre : seleccion.nombre ?? `${seleccion.origen.nombre} — ${seleccion.destino.nombre}` }] : []),
      ...modeloActual.clases.map((clase) => ({ id: clase.id, tipo: "clase" as const, nombre: clase.nombre })),
      ...modeloActual.relaciones.map((relacion) => ({ id: relacion.id, tipo: "relacion" as const, nombre: relacion.nombre ?? `${relacion.origen.nombre} — ${relacion.destino.nombre}` })),
    ].filter((item, indice, todos) => todos.findIndex((otro) => otro.id === item.id) === indice).slice(0, 8)
    const mensajesCronologicos = [...paginaMensajes.items].reverse()
    const conversacion: MensajeConversacionContextual[] = mensajesCronologicos
      .filter((mensaje) => mensaje.tipoRemitente !== "system" && !(mensaje.tipoRemitente === "human" && mensaje.requestId === pregunta.requestId))
      .map((mensaje) => ({ rol: mensaje.tipoRemitente === "human" ? "usuario" as const : "asistente" as const, contenido: mensaje.contenido }))
    const contexto: ContextoAsistente = {
      proyecto: { id: proyecto.id, nombre: proyecto.nombre }, area: "modelado_uml", idioma: vista?.idioma ?? "es",
      revisionModelo: proyecto.revisionModelo, modeloActual, elementoSeleccionado: seleccion, elementosRelevantes,
      resumenModelo: { clases: modeloActual.clases.length, relaciones: modeloActual.relaciones.length },
      estadoUml: vista?.estadoUml ?? evaluacionDurable.estadoUml,
      generacion: vista?.generacion ?? evaluacionDurable.generacion,
      cambiosSinGuardar: vista?.cambiosSinGuardar ?? false,
      candidatoImagenPendiente: vista?.candidatoImagenPendiente ?? false,
      accionesDisponibles: ["NINGUNA", ...(seleccion ? ["ENFOCAR_ELEMENTO" as const] : []), "IR_A_VALIDACION", "IR_A_GENERACION", "IR_A_XMI"],
      participanteActual: { id: acceso.participantId, nombreVisible: acceso.displayName },
      modeloDurable: { revision: proyecto.revisionModelo, actualizadoEn: proyecto.actualizadoEn, resumen: durable },
      fuenteModeloActual: vista ? "vista_actual_validada" : "snapshot_durable",
      conversacionCompartida: mensajesCronologicos.map((mensaje) => ({
        id: mensaje.id, tipoRemitente: mensaje.tipoRemitente, participantId: mensaje.participantId,
        nombreVisibleSnapshot: mensaje.nombreVisibleSnapshot, contenido: mensaje.contenido, requestId: mensaje.requestId,
        replyToMessageId: mensaje.replyToMessageId, creadoEn: mensaje.creadoEn, recomendacion: mensaje.recomendacion ?? null,
      })),
      actividadReciente: paginaEventos.items.map((evento) => ({
        id: evento.id, tipo: evento.tipo, solicitadoPorParticipantId: evento.solicitadoPorParticipantId,
        nombreParticipanteSnapshot: evento.nombreParticipanteSnapshot, mecanismo: evento.mecanismo,
        elemento: evento.elemento, revisionModeloObservada: evento.revisionModeloObservada, creadoEn: evento.creadoEn,
      })),
    }
    return { pregunta: pregunta.contenido.trim(), contexto, conversacion }
  }
}
