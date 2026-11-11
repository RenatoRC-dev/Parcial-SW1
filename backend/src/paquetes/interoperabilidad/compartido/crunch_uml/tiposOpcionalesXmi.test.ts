import { describe, expect, it } from "vitest"
import { exportarModeloXmi } from "../../casos_uso/cu07_exportar_modelo_xmi/exportarModeloXmi.js"
import { importarModeloXmi } from "../../casos_uso/cu06_importar_modelo_xmi/importarModeloXmi.js"
import { fixtureTiposOpcionales } from "../../pruebas_runtime/fixtureTiposOpcionales.js"

describe("CU06/CU07 reales: atributo sin tipo no se transforma en tipo implícito", () => {
  it("preserva el modelo mixto, clase vacía e identidad en exportar→importar→exportar→importar", async () => {
    let actual = structuredClone(fixtureTiposOpcionales)
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      const xml = (await exportarModeloXmi(actual)).toString("utf8")
      for (const id of ["EAID_NOMBRE", "EAID_TELEFONO"]) {
        const atributo = xml.match(new RegExp(`<ownedAttribute\\b[^>]*xmi:id="${id}"[^>]*(?:/>|>[\\s\\S]*?</ownedAttribute>)`))
        expect(atributo, `Atributo XML ${id}`).not.toBeNull()
        expect(atributo![0]).not.toMatch(/<type\b|EAJava_(String|Object|void)|type="(String|Object|void)"/)
      }
      const importado = await importarModeloXmi(xml)
      const clases = importado.modelo.clases
      for (const original of fixtureTiposOpcionales.clases) {
        const clase = clases.find((c) => c.id === original.id)
        expect(clase).toMatchObject({ id: original.id, nombre: original.nombre })
        expect(clase!.atributos).toHaveLength(original.atributos.length)
        expect(clase!.atributos).toEqual(expect.arrayContaining(original.atributos))
      }
      expect(importado.modelo.relaciones).toEqual(fixtureTiposOpcionales.relaciones)
      expect(importado.advertencias.filter((a) => a.codigo === "ATRIBUTOS_SIN_TIPO")).toHaveLength(1)
      actual = importado.modelo
    }
  }, 60000)
})
