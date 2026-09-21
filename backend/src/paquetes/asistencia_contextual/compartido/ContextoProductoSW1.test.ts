import { describe, expect, it } from "vitest"
import { CONTEXTO_PRODUCTO_SW1 } from "./ContextoProductoSW1.js"

describe("ContextoProductoSW1", () => {
  it("documenta únicamente los flujos verificados de CU04, CU05 y CU12", () => {
    expect(CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.iaModelado).toContain("aplica automáticamente")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.requiereConfirmacion).toBe(false)
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.imagenUml.requiereConfirmacion).toBe(true)
    expect(CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.asistenteContextual).toContain("nunca modifica")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.xmi.archivoExportado).toBe("modelo.xmi")
  })

  it("describe voz como envío automático sin un segundo clic en Enviar", () => {
    const voz = CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.voz
    expect(voz).toContain("transcribe")
    expect(voz).toContain("envía automáticamente")
    expect(voz).toContain("sin pulsar Enviar después")
  })

  it("separa la sustitución XMI del candidato de imagen y de la generación Spring", () => {
    const xmi = CONTEXTO_PRODUCTO_SW1.capacidades.xmi
    expect(xmi.importar).toContain("Importar XMI")
    expect(xmi.importar).toContain("confirmación")
    expect(xmi.importar).toContain("reemplazará el diagrama actual")
    expect(xmi.produceCandidato).toBe(false)
    expect(xmi.exportar).toContain("modelo.xmi")
    expect(xmi.exportar).toContain("interoperabilidad")
    expect(xmi.exportar).toContain("no es un requisito ni el flujo de generación Spring")
  })

  it("no expone implementación, secretos ni acciones internas como ayuda de producto", () => {
    expect(JSON.stringify(CONTEXTO_PRODUCTO_SW1)).not.toMatch(/Yjs|Apollon|GROQ_API_KEY|IR_A_|MOSTRAR_IMAGEN|ENFOCAR_ELEMENTO/i)
  })
})
