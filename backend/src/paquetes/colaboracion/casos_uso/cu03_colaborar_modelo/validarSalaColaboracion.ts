/** La sala nunca procede del cliente: se deriva del proyecto ya autorizado. */
export function obtenerSalaColaboracionProyecto(projectId: string): string {
  return `proyecto-${projectId}`
}
