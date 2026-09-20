import { describe, expect, it, vi } from "vitest"
import { ErrorProveedorVision } from "../ProveedorVisionUML.js"
import { ejecutarConUnReintentoVision, MAX_TOKENS_VISION, MODELO_VISION_PREDETERMINADO, mapearErrorGroqVision, procesarRespuestaGroqVision } from "./ProveedorVisionGroq.js"

describe("configuración de Groq Vision", () => {
  it("usa el modelo accesible confirmado para esta cuenta", () => {
    expect(MODELO_VISION_PREDETERMINADO).toBe("qwen/qwen3.8-27b")
    expect(MAX_TOKENS_VISION).toBe(900)
  })

  it("distingue 404 model_not_found de una indisponibilidad temporal", () => {
    const error = mapearErrorGroqVision({ status: 404, error: { code: "model_not_found" } })
    expect(error.tipo).toBe("modelo_no_disponible")
    expect(error.message).toContain("no existe o no está disponible para esta cuenta")
  })

  it("conserva el mapeo controlado para límite y otros fallos", () => {
    expect(mapearErrorGroqVision({ status: 429 }).tipo).toBe("limite")
    expect(mapearErrorGroqVision({ status: 503 }).tipo).toBe("no_disponible")
  })

  it("reintenta una sola vez un 503 transitorio", async () => {
    const operacion = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce("ok")
    await expect(ejecutarConUnReintentoVision(operacion)).resolves.toBe("ok")
    expect(operacion).toHaveBeenCalledTimes(2)
  })

  it("propaga el segundo 503 sin iniciar un bucle de reintentos", async () => {
    const operacion = vi.fn().mockRejectedValue({ status: 503 })
    await expect(ejecutarConUnReintentoVision(operacion)).rejects.toEqual({ status: 503 })
    expect(operacion).toHaveBeenCalledTimes(2)
  })

  it.each([404, 429, 400])("no reintenta el estado %s", async (status) => {
    const operacion = vi.fn().mockRejectedValue({ status })
    await expect(ejecutarConUnReintentoVision(operacion)).rejects.toEqual({ status })
    expect(operacion).toHaveBeenCalledOnce()
  })

  it("clasifica finish_reason length como respuesta incompleta con diagnóstico seguro", () => {
    expect.assertions(7)
    try {
      procesarRespuestaGroqVision({
        choices: [{ finish_reason: "length", message: { content: "{\"resultado\":\"candidato\"" } }],
        usage: { completion_tokens: 512, total_tokens: 734 },
      }, MODELO_VISION_PREDETERMINADO)
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorProveedorVision)
      const controlado = error as ErrorProveedorVision
      expect(controlado.tipo).toBe("respuesta_incompleta")
      expect(controlado.message).toContain("sección más pequeña")
      expect(controlado.diagnostico?.finishReason).toBe("length")
      expect(controlado.diagnostico?.completionTokens).toBe(512)
      expect(controlado.diagnostico?.totalTokens).toBe(734)
      expect(controlado.diagnostico?.contentLength).toBeGreaterThan(0)
    }
  })

  it("distingue JSON truncado sin finish_reason length de una caída del proveedor", () => {
    expect.assertions(3)
    try {
      procesarRespuestaGroqVision({ choices: [{ finish_reason: "stop", message: { content: "{" } }] }, MODELO_VISION_PREDETERMINADO)
    } catch (error) {
      const controlado = error as ErrorProveedorVision
      expect(controlado.tipo).toBe("respuesta_invalida")
      expect(controlado.diagnostico?.jsonParseFailed).toBe(true)
      expect(controlado.diagnostico?.schemaValidationFailed).toBe(false)
    }
  })

  it("distingue un JSON válido que incumple el contrato del candidato", () => {
    expect.assertions(3)
    try {
      procesarRespuestaGroqVision({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] }, MODELO_VISION_PREDETERMINADO)
    } catch (error) {
      const controlado = error as ErrorProveedorVision
      expect(controlado.tipo).toBe("respuesta_invalida")
      expect(controlado.diagnostico?.jsonParseFailed).toBe(false)
      expect(controlado.diagnostico?.schemaValidationFailed).toBe(true)
    }
  })
})
