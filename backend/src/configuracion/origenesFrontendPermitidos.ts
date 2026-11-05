const ORIGENES_DESARROLLO = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]

export function obtenerOrigenesFrontendPermitidos(entorno: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  const origenProduccion = entorno.FRONTEND_ORIGIN?.trim()
  return new Set([
    ...ORIGENES_DESARROLLO,
    ...(origenProduccion ? [origenProduccion] : []),
  ])
}
