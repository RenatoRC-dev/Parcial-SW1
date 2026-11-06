import type { ContextoAccesoProyecto } from "../../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import { GestionarMensajesProyecto } from "../../../mensajeria_colaborativa/casos_uso/GestionarMensajesProyecto.js"
import type { MensajeProyecto } from "../../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import type { PublicadorMensajesProyecto } from "../../../mensajeria_colaborativa/compartido/PublicadorMensajesProyecto.js"
import type { ProveedorAsistenteContextual } from "../../compartido/ProveedorAsistenteContextual.js"
import type { PreguntaAsistenteColaborativo } from "../../compartido/ContratoPreguntaColaborativa.js"
import type { RespuestaAsistenteContextual, SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { asistirUsuario } from "./asistirUsuario.js"
import { responderAyudaProductoDeterminista } from "./responderAyudaProductoDeterminista.js"
import type { ConstruirContextoAsistenteColaborativo } from "./ConstruirContextoAsistenteColaborativo.js"

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function respuestaDeterminista(respuesta: string, elementoRelacionadoId: string | null = null): RespuestaAsistenteContextual {
  return { respuesta, accionSugerida: "NINGUNA", elementoRelacionadoId, nivel: "informacion", categoriaRecomendacion: "INFORMATIVO", origen: "determinista" }
}

function responderActividad(solicitud: SolicitudAsistenteContextual): RespuestaAsistenteContextual | null {
  const pregunta = normalizar(solicitud.pregunta)
  const eventos = solicitud.contexto.actividadReciente ?? []
  const pideCreacion = /quien (creo|creó|hizo|agrego|agregó)/.test(pregunta)
  if (pideCreacion) {
    const candidatos = solicitud.contexto.modeloActual.clases.filter((clase) => pregunta.includes(normalizar(clase.nombre)))
    const ids = new Set(candidatos.map((clase) => clase.id))
    const evento = eventos.find((item) => item.tipo === "UML_ELEMENT_CREATED" && item.elemento?.tipo === "class"
      && (ids.has(item.elemento.id) || pregunta.includes(normalizar(item.elemento.nombreSnapshot))))
    if (evento) return respuestaDeterminista(`${evento.nombreParticipanteSnapshot} creó ${evento.elemento?.nombreSnapshot}. La atribución proviene de la actividad registrada del proyecto.`, evento.elemento?.id ?? null)
    return respuestaDeterminista("No tengo evidencia registrada suficiente para determinar con certeza quién realizó esa creación. La trazabilidad no cubre todas las operaciones nativas del canvas.")
  }
  const consultaParticipante = /que (hizo|modifico|cambio|creo) ([\p{L}0-9_-]+)/u.exec(pregunta)
  if (consultaParticipante) {
    const nombre = consultaParticipante[2]
    const coincidencias = new Map<string, string>()
    for (const evento of eventos) if (normalizar(evento.nombreParticipanteSnapshot) === nombre) coincidencias.set(evento.solicitadoPorParticipantId, evento.nombreParticipanteSnapshot)
    if (coincidencias.size > 1) return respuestaDeterminista(`Hay más de un participante llamado ${[...coincidencias.values()][0]}. No puedo atribuir la consulta por nombre sin una referencia adicional.`)
    const participantId = [...coincidencias.keys()][0]
    if (!participantId) return respuestaDeterminista("No tengo actividad registrada suficiente para atribuir acciones a ese participante.")
    const hechos = eventos.filter((evento) => evento.solicitadoPorParticipantId === participantId).slice(0, 5)
      .map((evento) => evento.elemento ? `${evento.tipo}: ${evento.elemento.nombreSnapshot}` : evento.tipo)
    return respuestaDeterminista(`${[...coincidencias.values()][0]} tiene registrada esta actividad reciente: ${hechos.join("; ")}.`)
  }
  return null
}

function responderAccionNoEjecutable(solicitud: SolicitudAsistenteContextual): RespuestaAsistenteContextual | null {
  const pregunta = normalizar(solicitud.pregunta).trim()
  if (!/^(crea|agrega|anade|añade|elimina|borra|corrige|modifica|cambia|hazlo|aplicalo|aplícalo)\b/.test(pregunta)) return null
  return {
    respuesta: "Puedo revisar y proponer ese cambio, pero este asistente no modifica el UML. Para aplicarlo utiliza Asistente IA, el modelado asistido de NexoCASE.",
    accionSugerida: "NINGUNA", elementoRelacionadoId: solicitud.contexto.elementoSeleccionado?.id ?? null,
    nivel: "sugerencia", categoriaRecomendacion: "RECOMENDADO", origen: "determinista",
  }
}

export class AsistirColaborativamente {
  private readonly solicitudesEnCurso = new Map<string, Promise<{ mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }>>()

  constructor(
    private readonly mensajes: GestionarMensajesProyecto,
    private readonly construirContexto: ConstruirContextoAsistenteColaborativo,
    private readonly proveedor: ProveedorAsistenteContextual,
    private readonly publicador: PublicadorMensajesProyecto,
  ) {}

  async ejecutar(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): Promise<{ mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }> {
    const clave = `${acceso.projectId}:${pregunta.requestId}:${acceso.participantId}:${pregunta.contenido.trim()}`
    const enCurso = this.solicitudesEnCurso.get(clave)
    if (enCurso) return enCurso
    const ejecucion = this.ejecutarUnaVez(acceso, pregunta).finally(() => this.solicitudesEnCurso.delete(clave))
    this.solicitudesEnCurso.set(clave, ejecucion)
    return ejecucion
  }

  private async ejecutarUnaVez(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): Promise<{ mensajeHumano: MensajeProyecto; mensajeIA: MensajeProyecto }> {
    const existenteIA = await this.mensajes.obtenerPorRequestId(acceso.projectId, pregunta.requestId, "ai")
    const humano = await this.mensajes.registrarMensajeHumanoIdempotente(acceso, pregunta.contenido, pregunta.requestId, pregunta.foco ? [pregunta.foco.elementoId] : [])
    if (humano.creado) this.publicador.publicar(humano.mensaje)
    if (existenteIA) return { mensajeHumano: humano.mensaje, mensajeIA: existenteIA }

    const solicitud = await this.construirContexto.construir(acceso, pregunta)
    const respuesta = responderAyudaProductoDeterminista(solicitud)
      ?? responderActividad(solicitud)
      ?? responderAccionNoEjecutable(solicitud)
      ?? await asistirUsuario(solicitud, this.proveedor)
    const ids = respuesta.elementoRelacionadoId ? [respuesta.elementoRelacionadoId] : []
    const ia = await this.mensajes.registrarMensajeIAIdempotente(acceso.projectId, respuesta.respuesta, pregunta.requestId, humano.mensaje.id, ids, respuesta.recomendacion ?? null)
    if (ia.creado) this.publicador.publicar(ia.mensaje)
    return { mensajeHumano: humano.mensaje, mensajeIA: ia.mensaje }
  }
}
