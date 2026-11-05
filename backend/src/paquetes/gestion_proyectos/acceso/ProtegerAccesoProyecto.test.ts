import { describe, expect, it } from "vitest"
import {
  ErrorConfiguracionAccesoProyecto,
  normalizarCodigoAcceso,
  obtenerPepperAccesoProyecto,
  ProtegerAccesoProyecto,
} from "./ProtegerAccesoProyecto.js"

describe("protección criptográfica de acceso al proyecto", () => {
  const protector = new ProtegerAccesoProyecto("pepper-determinista-de-prueba")

  it("genera códigos canónicos con 12 símbolos no ambiguos", () => {
    const codigos = Array.from({ length: 100 }, () => protector.generarCodigoAcceso())
    for (const codigo of codigos) expect(codigo).toMatch(/^NX-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/)
    expect(new Set(codigos).size).toBe(100)
  })

  it("normaliza espacios, guiones y minúsculas a la forma canónica", () => {
    expect(normalizarCodigoAcceso(" nx 2345-6789 abcd ")).toBe("NX-2345-6789-ABCD")
  })

  it("produce el mismo digest para códigos equivalentes y otro para códigos diferentes", () => {
    expect(protector.obtenerDigestCodigo("NX-2345-6789-ABCD"))
      .toBe(protector.obtenerDigestCodigo("nx 2345 6789 abcd"))
    expect(protector.obtenerDigestCodigo("NX-2345-6789-ABCD"))
      .not.toBe(protector.obtenerDigestCodigo("NX-2345-6789-ABCE"))
  })

  it("separa dominios HMAC de código y credencial", () => {
    const valorCompatible = "A".repeat(43)
    expect(protector.obtenerDigestCredencial(valorCompatible))
      .not.toBe(protector.obtenerDigestCodigo("NX-2345-6789-ABCD"))
  })

  it("genera credenciales Base64URL de exactamente 32 bytes", () => {
    const credencial = protector.generarCredencialParticipante()
    expect(credencial).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(credencial, "base64url")).toHaveLength(32)
  })

  it("requiere pepper de entorno sin revelar valores", () => {
    expect(() => obtenerPepperAccesoProyecto({})).toThrow(ErrorConfiguracionAccesoProyecto)
    expect(obtenerPepperAccesoProyecto({ PROJECT_ACCESS_PEPPER: "secreto-prueba" })).toBe("secreto-prueba")
  })
})
