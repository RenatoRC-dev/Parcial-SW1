import { describe, expect, it } from "vitest"
import { CONTEXTO_PRODUCTO_SW1 } from "./ContextoProductoSW1.js"

describe("ContextoProductoSW1", () => {
  it("expone NexoCASE como nombre visible del producto", () => {
    expect(CONTEXTO_PRODUCTO_SW1.producto).toBe("NexoCASE")
  })
  it("documenta únicamente los flujos verificados de CU04, CU05 y CU12", () => {
    expect(CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.iaModelado).toContain("aplica automáticamente")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.requiereConfirmacion).toBe(false)
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.imagenUml.requiereConfirmacion).toBe(true)
    expect(CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.asistenteContextual).toContain("único ejecutor UML")
    expect(CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.iaModelado).toContain("aptitud Spring se evalúa aparte")
    expect(CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.asistenteContextual).toContain("CU08 determina validez UML y CU09 aptitud Spring")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.xmi.archivoExportado).toBe("modelo.xmi")
  })

  it("describe multimedia real con transcripción revisable y candidato local CU05", () => {
    const voz = CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.voz
    expect(voz).toContain("transcripción queda editable")
    expect(voz).toContain("Terminar de grabar nunca ejecuta cambios")
    expect(voz).toContain("no contexto visual de CU12")
    expect(voz).toContain("Desde imagen")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.acceso).toContain("Asistente de modelado")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.texto).toContain("único chat")
    expect(CONTEXTO_PRODUCTO_SW1.capacidades.imagenUml.acceso).toContain("PNG/JPEG, hasta 10 MB")
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
    expect(xmi.exportar).toContain("extensión propia")
    expect(xmi.exportar).toContain("otras herramientas pueden omitirla")
    expect(xmi.exportar).toContain("métodos UML siguen fuera del perfil XMI")
  })

  it("no expone implementación, secretos ni acciones internas como ayuda de producto", () => {
    expect(JSON.stringify(CONTEXTO_PRODUCTO_SW1)).not.toMatch(/Yjs|Apollon|GROQ_API_KEY|IR_A_|MOSTRAR_IMAGEN|ENFOCAR_ELEMENTO/i)
  })
})
