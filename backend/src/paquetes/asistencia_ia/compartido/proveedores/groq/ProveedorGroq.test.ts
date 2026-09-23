import { describe, expect, it } from "vitest"
import { clasificarErrorProveedorGroq, CU04_AI_TIMEOUT_MS } from "./ProveedorGroq.js"

describe("diagnóstico de errores Groq CU04", () => {
  it("configura exactamente 60 segundos para CU04", () => {
    expect(CU04_AI_TIMEOUT_MS).toBe(60_000)
  })

  it.each([
    [{ status: 429 }, "limite"],
    [{ status: 401 }, "autenticacion"],
    [{ status: 408 }, "timeout"],
    [Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" }), "timeout"],
    [{ status: 400, error: { code: "json_validate_failed", message: "JSON inválido" } }, "respuesta_invalida"],
    [{ status: 400, error: { code: "invalid_request_error", message: "Esquema inválido" } }, "configuracion"],
    [{ status: 503 }, "no_disponible"],
  ] as const)("clasifica %j como %s", (error, esperado) => {
    expect(clasificarErrorProveedorGroq(error).tipo).toBe(esperado)
  })

  it("limita el detalle diagnóstico y no depende del mensaje para clasificar", () => {
    const resultado = clasificarErrorProveedorGroq({ status: 400, error: { code: "json_validate_failed", message: "x".repeat(800) } })
    expect(resultado.motivo).toHaveLength(500)
    expect(resultado.tipo).toBe("respuesta_invalida")
  })
})
