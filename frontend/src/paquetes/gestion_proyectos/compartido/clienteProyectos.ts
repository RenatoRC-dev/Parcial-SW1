import type { ModeloUMLCanonico } from "../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { ActividadModeladoManual, Proyecto, RespuestaCrearProyecto, RespuestaUnirseProyecto, ResumenProyecto } from "./Proyecto"
import { construirUrlBackend } from "../../../configuracion/BackendRemoto"

interface ErrorBackend { error?: string; codigo?: string }

export class ErrorApiProyecto extends Error {
  constructor(message: string, readonly estado: number, readonly codigo?: string) { super(message) }
}

const mensajesPorCodigo: Record<string, string> = {
  CODIGO_PROYECTO_INVALIDO: "El código del proyecto no es válido.",
  CREDENCIAL_REQUERIDA: "El acceso guardado ya no es válido. Vuelve a unirte con el código del proyecto.",
  CREDENCIAL_INVALIDA: "El acceso guardado ya no es válido. Vuelve a unirte con el código del proyecto.",
  ACCESO_PROYECTO_DENEGADO: "El acceso guardado ya no es válido para este proyecto. Vuelve a unirte con su código.",
  REVISION_CONFLICTIVA: "El proyecto fue guardado por otro participante desde que abriste esta versión. Tus cambios locales no se descartaron.",
  LIMITE_INTENTOS: "Demasiados intentos. Intenta nuevamente más tarde.",
  PERSISTENCIA_NO_DISPONIBLE: "El servicio de proyectos no está disponible temporalmente. Intenta nuevamente más tarde.",
}

async function leer<T>(respuesta: Response): Promise<T> {
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({})) as ErrorBackend
    const mensaje = cuerpo.codigo ? mensajesPorCodigo[cuerpo.codigo] : undefined
    throw new ErrorApiProyecto(mensaje ?? cuerpo.error ?? "No se pudo completar la operación de proyecto.", respuesta.status, cuerpo.codigo)
  }
  return respuesta.json() as Promise<T>
}

function encabezados(credencial?: string): HeadersInit {
  return { "Content-Type": "application/json", ...(credencial ? { Authorization: `Bearer ${credencial}` } : {}) }
}

export const crearProyecto = async (nombre: string, nombreParticipante: string) => leer<RespuestaCrearProyecto>(await fetch(
  construirUrlBackend("/api/proyectos"),
  { method: "POST", headers: encabezados(), body: JSON.stringify({ nombre, nombreParticipante }) },
))

export const unirseProyecto = async (codigoAcceso: string, nombreParticipante: string) => leer<RespuestaUnirseProyecto>(await fetch(
  construirUrlBackend("/api/proyectos/unirse"),
  { method: "POST", headers: encabezados(), body: JSON.stringify({ codigoAcceso, nombreParticipante }) },
))

export const abrirProyecto = async (id: string, credencial: string) => leer<Proyecto>(await fetch(
  construirUrlBackend(`/api/proyectos/${id}`),
  { headers: encabezados(credencial) },
))

export const guardarModeloProyecto = async (
  id: string,
  credencial: string,
  modelo: ModeloUMLCanonico,
  revisionBase: number,
) => leer<ResumenProyecto>(await fetch(construirUrlBackend(`/api/proyectos/${id}/modelo`), {
  method: "PUT", headers: encabezados(credencial), body: JSON.stringify({ modelo, revisionBase }),
}))

export const registrarActividadModelado = async (
  id: string, credencial: string, clientChangeId: string, actividad: ActividadModeladoManual,
) => leer<unknown>(await fetch(construirUrlBackend(`/api/proyectos/${id}/actividad/modelado`), {
  method: "POST", headers: encabezados(credencial), body: JSON.stringify({ clientChangeId, ...actividad }),
}))
