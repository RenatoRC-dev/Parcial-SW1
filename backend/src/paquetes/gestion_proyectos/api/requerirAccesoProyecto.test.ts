import { describe, expect, it } from "vitest"
import { extraerCredencialBearer } from "./requerirAccesoProyecto.js"

describe("parsing Bearer", () => {
  const credencial = "A".repeat(43)
  it("acepta únicamente el esquema y longitud esperados", () => {
    expect(extraerCredencialBearer(`Bearer ${credencial}`)).toBe(credencial)
    expect(extraerCredencialBearer(`bearer ${credencial}`)).toBeNull()
    expect(extraerCredencialBearer(`Bearer corto`)).toBeNull()
    expect(extraerCredencialBearer(undefined)).toBeNull()
  })
})
