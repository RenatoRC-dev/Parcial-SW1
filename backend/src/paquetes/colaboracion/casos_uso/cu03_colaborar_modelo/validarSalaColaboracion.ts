const PATRON_SALA = /^[A-Za-z0-9_-]{1,64}$/

export function normalizarSalaColaboracion(candidata: string | null | undefined): string | null {
  const sala = candidata?.trim()
  return sala && PATRON_SALA.test(sala) ? sala : null
}
