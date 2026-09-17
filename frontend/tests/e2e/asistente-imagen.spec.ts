import { expect, test, type Page } from "@playwright/test"
import { abrirProyectoE2E, crearProyectoE2E } from "./ayudas/proyectos"

const imagenPng = {
  name: "diagrama.png",
  mimeType: "image/png",
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]),
}

async function analizar(page: Page) {
  const panel = page.getByTestId("panel-modelado-imagen")
  await panel.getByLabel("Seleccionar imagen").setInputFiles(imagenPng)
  await panel.getByRole("button", { name: "Analizar imagen" }).click()
  await expect(panel.getByRole("region", { name: "Modelo UML candidato" })).toBeVisible()
  return panel
}

test("CU05 muestra candidato sin mutar y Cancelar conserva el modelo", async ({ page }) => {
  await crearProyectoE2E(page, "Imagen cancelar")
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = await analizar(page)
  await expect(panel.getByText("Factura", { exact: true })).toBeVisible()
  await expect(page.locator(".react-flow__node").filter({ hasText: "Factura" })).toHaveCount(0)
  await expect(page.getByTestId("resumen-canonico")).toContainText("Clases0")
  await panel.getByRole("button", { name: "Cancelar" }).click()
  await expect(panel.getByRole("region", { name: "Modelo UML candidato" })).toHaveCount(0)
  await expect(page.getByTestId("resumen-canonico")).toContainText("Clases0")
})

test("CU05 confirma y aplica el candidato en Apollon", async ({ page }) => {
  await crearProyectoE2E(page, "Imagen confirmar")
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = await analizar(page)
  await panel.getByRole("button", { name: "Agregar al diagrama" }).click()
  await expect(page.locator(".react-flow__node").filter({ hasText: "Factura" })).toContainText("numero")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Factura" })).toContainText("total")
  await expect(page.getByTestId("resumen-canonico")).toContainText("Clases2")
  await expect(page.getByTestId("resumen-canonico")).toContainText("Relaciones1")
})

test("CU05 solo propaga el modelo confirmado al colaborador", async ({ browser }) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const ana = await contextoA.newPage()
  const bruno = await contextoB.newPage()
  try {
    const proyecto = await crearProyectoE2E(ana, "Imagen colaboración")
    await abrirProyectoE2E(bruno, proyecto)
    await expect(ana.getByTestId("cantidad-participantes")).toContainText("2")
    const panelAna = await analizar(ana)
    await expect(bruno.locator(".react-flow__node").filter({ hasText: "Factura" })).toHaveCount(0)
    await expect(bruno.getByTestId("panel-modelado-imagen").getByRole("region", { name: "Modelo UML candidato" })).toHaveCount(0)
    await panelAna.getByRole("button", { name: "Agregar al diagrama" }).click()
    await expect(ana.locator(".react-flow__node").filter({ hasText: "Factura" })).toBeVisible()
    await expect(bruno.locator(".react-flow__node").filter({ hasText: "Factura" })).toBeVisible({ timeout: 20_000 })
    await expect(bruno.getByTestId("resumen-canonico")).toContainText("Clases2")
  } finally {
    await contextoA.close()
    await contextoB.close()
  }
})
