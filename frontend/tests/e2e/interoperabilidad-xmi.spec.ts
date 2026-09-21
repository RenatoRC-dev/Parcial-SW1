import { expect, test } from "@playwright/test"
import { crearProyectoE2E } from "./ayudas/proyectos"
import { abrirHerramienta, cerrarHerramienta } from "./ayudas/interfaz"

const fixture = {
  id: "EAPK_SW1_E2E",
  nombre: "Modelo XMI E2E",
  version: "4.2.0",
  clases: [
    {
      id: "EAID_CLIENTE_E2E",
      nombre: "Cliente",
      abstracta: false,
      posicion: { x: 100, y: 100 },
      atributos: [{ id: "EAID_NOMBRE_E2E", nombre: "nombre", tipo: "String" }],
    },
    {
      id: "EAID_PEDIDO_E2E",
      nombre: "Pedido",
      abstracta: false,
      posicion: { x: 450, y: 100 },
      atributos: [{ id: "EAID_FECHA_E2E", nombre: "fecha", tipo: "LocalDate" }],
    },
  ],
  relaciones: [{
    id: "EAID_REL_E2E",
    tipo: "asociacion",
    claseOrigenId: "EAID_CLIENTE_E2E",
    claseDestinoId: "EAID_PEDIDO_E2E",
    multiplicidadOrigen: "1",
    multiplicidadDestino: "0..*",
    rolOrigen: "cliente",
    rolDestino: "pedidos",
  }],
}

test("importa XMI al editor y exporta modelo.xmi", async ({ page, request }) => {
  test.setTimeout(90_000)

  const xmi = await request.post("http://127.0.0.1:3001/api/interoperabilidad/xmi/exportar", { data: fixture })
  expect(xmi.ok()).toBeTruthy()

  await crearProyectoE2E(page, "XMI")
  await expect(page.locator(".react-flow")).toBeVisible()
  await abrirHerramienta(page, "XMI")
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByTestId("selector-xmi").setInputFiles({
    name: "cliente-pedido.xmi",
    mimeType: "application/xml",
    buffer: await xmi.body(),
  })

  await expect(page.locator(".interoperability-panel").getByRole("status")).toHaveText(
    "Importado correctamente",
    { timeout: 60_000 },
  )
  await expect(page.getByTestId("resumen-canonico")).toContainText("2")
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Pedido", { exact: true }).first()).toBeVisible()

  await cerrarHerramienta(page)
  await page.locator(".react-flow__node").filter({ hasText: "Cliente" }).click()
  const inspector = page.getByTestId("inspector-propiedades")
  const nombreClase = inspector.getByLabel("Nombre de la clase seleccionada")
  await nombreClase.fill("ClienteImportado")
  await nombreClase.press("Enter")
  await expect(page.getByText("ClienteImportado", { exact: true }).first()).toBeVisible()

  await abrirHerramienta(page, "XMI")
  const [archivo] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar XMI" }).click(),
  ])
  expect(archivo.suggestedFilename()).toBe("modelo.xmi")
  const ruta = await archivo.path()
  expect(ruta).not.toBeNull()

  const reimportado = await request.post("http://127.0.0.1:3001/api/interoperabilidad/xmi/importar", {
    headers: { "Content-Type": "application/xml" },
    data: ruta ? await import("node:fs/promises").then((fs) => fs.readFile(ruta, "utf8")) : "",
  })
  expect(reimportado.ok()).toBeTruthy()
  const cuerpo = await reimportado.json()
  expect(cuerpo.modelo.clases).toHaveLength(2)
  expect(cuerpo.modelo.relaciones).toHaveLength(1)
})
