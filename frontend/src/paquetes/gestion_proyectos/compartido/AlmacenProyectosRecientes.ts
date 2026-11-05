export const CLAVE_PROYECTOS_RECIENTES = "nexocase.proyectosRecientes.v1"

export interface ProyectoReciente {
  projectId: string
  projectName: string
  participantId: string
  displayName: string
  credential: string
  lastOpenedAt: string
}

interface EsquemaProyectosRecientesV1 {
  version: 1
  proyectos: ProyectoReciente[]
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0
}

function esProyectoReciente(valor: unknown): valor is ProyectoReciente {
  if (typeof valor !== "object" || valor === null) return false
  const proyecto = valor as Record<string, unknown>
  return esTexto(proyecto.projectId) && esTexto(proyecto.projectName)
    && esTexto(proyecto.participantId) && esTexto(proyecto.displayName)
    && esTexto(proyecto.credential) && esTexto(proyecto.lastOpenedAt)
    && !Number.isNaN(Date.parse(proyecto.lastOpenedAt))
    && !("codigoAcceso" in proyecto)
}

function almacenamientoPredeterminado(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage
}

export function listarProyectosRecientes(almacenamiento: Storage | null = almacenamientoPredeterminado()): ProyectoReciente[] {
  if (!almacenamiento) return []
  try {
    const texto = almacenamiento.getItem(CLAVE_PROYECTOS_RECIENTES)
    if (!texto) return []
    const valor: unknown = JSON.parse(texto)
    if (typeof valor !== "object" || valor === null) return []
    const esquema = valor as Partial<EsquemaProyectosRecientesV1>
    if (esquema.version !== 1 || !Array.isArray(esquema.proyectos)) return []
    return esquema.proyectos.filter(esProyectoReciente)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
  } catch {
    return []
  }
}

export function guardarProyectoReciente(
  entrada: ProyectoReciente,
  almacenamiento: Storage | null = almacenamientoPredeterminado(),
): ProyectoReciente[] {
  if (!almacenamiento || !esProyectoReciente(entrada)) return listarProyectosRecientes(almacenamiento)
  // La credencial opaca se conserva en localStorage por alcance académico; una XSS podría extraerla.
  const proyectos = [entrada, ...listarProyectosRecientes(almacenamiento).filter((actual) => actual.projectId !== entrada.projectId)]
  const esquema: EsquemaProyectosRecientesV1 = { version: 1, proyectos }
  almacenamiento.setItem(CLAVE_PROYECTOS_RECIENTES, JSON.stringify(esquema))
  return proyectos
}

export function quitarProyectoReciente(
  projectId: string,
  almacenamiento: Storage | null = almacenamientoPredeterminado(),
): ProyectoReciente[] {
  if (!almacenamiento) return []
  const proyectos = listarProyectosRecientes(almacenamiento).filter((proyecto) => proyecto.projectId !== projectId)
  almacenamiento.setItem(CLAVE_PROYECTOS_RECIENTES, JSON.stringify({ version: 1, proyectos } satisfies EsquemaProyectosRecientesV1))
  return proyectos
}
