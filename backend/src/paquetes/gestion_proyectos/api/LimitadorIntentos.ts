export interface ConfiguracionLimitadorIntentos {
  maximosFallos: number
  ventanaMs: number
  maximasClaves: number
  ahora?: () => number
}

interface EstadoIntentos { fallos: number; expiraEn: number }

export class LimitadorIntentos {
  private readonly estados = new Map<string, EstadoIntentos>()
  private readonly ahora: () => number

  constructor(private readonly configuracion: ConfiguracionLimitadorIntentos) {
    this.ahora = configuracion.ahora ?? Date.now
  }

  estaBloqueado(clave: string): boolean {
    const estado = this.obtenerVigente(clave)
    return Boolean(estado && estado.fallos >= this.configuracion.maximosFallos)
  }

  registrarFallo(clave: string): boolean {
    this.limpiarSiNecesario()
    const vigente = this.obtenerVigente(clave)
    const estado = vigente ?? { fallos: 0, expiraEn: this.ahora() + this.configuracion.ventanaMs }
    estado.fallos += 1
    this.estados.delete(clave)
    this.estados.set(clave, estado)
    return estado.fallos >= this.configuracion.maximosFallos
  }

  limpiar(clave: string): void { this.estados.delete(clave) }

  private obtenerVigente(clave: string): EstadoIntentos | null {
    const estado = this.estados.get(clave)
    if (!estado) return null
    if (estado.expiraEn <= this.ahora()) { this.estados.delete(clave); return null }
    return estado
  }

  private limpiarSiNecesario(): void {
    const ahora = this.ahora()
    for (const [clave, estado] of this.estados) if (estado.expiraEn <= ahora) this.estados.delete(clave)
    while (this.estados.size >= this.configuracion.maximasClaves) {
      const primera = this.estados.keys().next().value as string | undefined
      if (!primera) break
      this.estados.delete(primera)
    }
  }
}

export const crearLimitadorUnionPredeterminado = () => new LimitadorIntentos({
  maximosFallos: 10,
  ventanaMs: 60_000,
  maximasClaves: 10_000,
})
