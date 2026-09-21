import { expect, test, type Page } from "@playwright/test"
import { abrirProyectoE2E, crearProyectoE2E } from "./ayudas/proyectos"
import { abrirHerramienta } from "./ayudas/interfaz"

async function usarVoz(page: Page) {
  await abrirHerramienta(page, "Asistente IA")
  const panel = page.getByTestId("panel-asistente-ia")
  await panel.getByRole("button", { name: /Hablar/ }).click()
  await expect(panel.getByText("Escuchando...")).toBeVisible()
  await panel.getByRole("button", { name: /Detener/ }).click()
  await expect(panel.getByText(/Voz reconocida:/).locator("..")).toContainText("Crea una clase factura", { timeout: 20_000 })
  await expect(panel.getByRole("status")).toContainText("Listo", { timeout: 20_000 })
  return panel
}

test("la voz se transcribe y aplica automáticamente mediante el CU04 existente", async ({ page }) => {
  await crearProyectoE2E(page, "Voz")
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = await usarVoz(page)
  await expect(panel.getByLabel("Instrucción UML")).toHaveValue("Crea una clase factura")
  await expect(panel.getByRole("button", { name: /confirmar|aplicar|aceptar/i })).toHaveCount(0)
  await expect(page.getByText("Factura", { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId("resumen-canonico")).toContainText("Clases1")
})

test("la clase creada por voz se propaga al colaborador por Apollon/Yjs", async ({ browser }) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const ana = await contextoA.newPage()
  const bruno = await contextoB.newPage()
  try {
    const proyecto = await crearProyectoE2E(ana, "Voz colaboración")
    await abrirProyectoE2E(bruno, proyecto)
    await expect(ana.getByTestId("cantidad-participantes")).toContainText("2")
    await usarVoz(ana)
    await expect(ana.getByText("Factura", { exact: true }).first()).toBeVisible()
    await expect(bruno.getByText("Factura", { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(bruno.getByTestId("resumen-canonico")).toContainText("Clases1")
  } finally {
    await contextoA.close()
    await contextoB.close()
  }
})
