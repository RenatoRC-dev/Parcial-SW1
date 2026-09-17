import { describe, expect, it } from "vitest"
import { MODELO_VISION_PREDETERMINADO, mapearErrorGroqVision } from "./ProveedorVisionGroq.js"

describe("configuración de Groq Vision", () => {
  it("usa el modelo accesible confirmado para esta cuenta", () => {
    expect(MODELO_VISION_PREDETERMINADO).toBe("qwen/qwen3.8-27b")
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
})
