import type { ModeloUMLCanonico } from "../../../nucleo/modelo_uml/ModeloUMLCanonico"
import type { Proyecto, ResumenProyecto } from "./Proyecto"

async function leer<T>(respuesta: Response): Promise<T> {
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({})) as { error?: string }
    throw new Error(cuerpo.error ?? "No se pudo completar la operación de proyecto.")
  }
  return respuesta.json() as Promise<T>
}

export const listarProyectos = async () => leer<ResumenProyecto[]>(await fetch("/api/proyectos"))
export const crearProyecto = async (nombre: string) => leer<Proyecto>(await fetch("/api/proyectos", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }),
}))
export const abrirProyecto = async (id: string) => leer<Proyecto>(await fetch(`/api/proyectos/${id}`))
export const guardarModeloProyecto = async (id: string, modelo: ModeloUMLCanonico) => leer<ResumenProyecto>(await fetch(`/api/proyectos/${id}/modelo`, {
  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelo }),
}))

