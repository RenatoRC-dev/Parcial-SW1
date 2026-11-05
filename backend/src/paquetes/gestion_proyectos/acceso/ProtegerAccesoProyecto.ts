import { createHmac, randomBytes, randomInt } from "node:crypto"

const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
const PATRON_CODIGO_NORMALIZADO = new RegExp(`^NX[${ALFABETO_CODIGO}]{12}$`)
const PATRON_CREDENCIAL = /^[A-Za-z0-9_-]{43}$/

export class ErrorConfiguracionAccesoProyecto extends Error {}
export class ErrorFormatoCodigoAcceso extends Error {}

export function obtenerPepperAccesoProyecto(entorno: NodeJS.ProcessEnv = process.env): string {
  const pepper = entorno.PROJECT_ACCESS_PEPPER?.trim()
  if (!pepper) throw new ErrorConfiguracionAccesoProyecto("PROJECT_ACCESS_PEPPER es obligatorio para iniciar el backend.")
  return pepper
}

export function normalizarCodigoAcceso(valor: string): string {
  const compacto = valor.trim().replace(/[\s-]+/g, "").toUpperCase()
  if (!PATRON_CODIGO_NORMALIZADO.test(compacto)) {
    throw new ErrorFormatoCodigoAcceso("El código de proyecto no tiene un formato válido.")
  }
  return `NX-${compacto.slice(2, 6)}-${compacto.slice(6, 10)}-${compacto.slice(10, 14)}`
}

export class ProtegerAccesoProyecto {
  constructor(private readonly pepper: string) {
    if (!pepper.trim()) throw new ErrorConfiguracionAccesoProyecto("El pepper de acceso no puede estar vacío.")
  }

  generarCodigoAcceso(): string {
    let simbolos = ""
    for (let indice = 0; indice < 12; indice += 1) simbolos += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
    return `NX-${simbolos.slice(0, 4)}-${simbolos.slice(4, 8)}-${simbolos.slice(8, 12)}`
  }

  normalizarCodigoAcceso(valor: string): string {
    return normalizarCodigoAcceso(valor)
  }

  obtenerDigestCodigo(codigo: string): string {
    const normalizado = normalizarCodigoAcceso(codigo)
    return this.hmac(`project-code:v1:${normalizado}`)
  }

  generarCredencialParticipante(): string {
    return randomBytes(32).toString("base64url")
  }

  obtenerDigestCredencial(credencial: string): string {
    if (!PATRON_CREDENCIAL.test(credencial)) throw new ErrorFormatoCodigoAcceso("La credencial no tiene un formato válido.")
    return this.hmac(`participant-token:v1:${credencial}`)
  }

  esCredencialConFormatoValido(credencial: string): boolean {
    return PATRON_CREDENCIAL.test(credencial)
  }

  private hmac(contenido: string): string {
    return createHmac("sha256", this.pepper).update(contenido, "utf8").digest("hex")
  }
}
