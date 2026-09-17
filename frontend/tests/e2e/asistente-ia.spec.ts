import { expect, test, type Page } from "@playwright/test"
import { abrirProyectoE2E, crearProyectoE2E } from "./ayudas/proyectos"

async function instruir(page: Page, texto: string) {
  const panel = page.getByTestId("panel-asistente-ia")
  await panel.getByLabel("Instrucción UML").fill(texto)
  await panel.getByRole("button", { name: "Enviar" }).click()
  await expect(panel.getByRole("status")).toContainText(/Listo|Error/, { timeout: 15_000 })
  return panel
}

test("CU04 aplica clase y atributo automáticamente y aclara sin mutar", async ({ page }) => {
  await crearProyectoE2E(page, "IA")
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = page.getByTestId("panel-asistente-ia")
  await expect(panel.getByRole("button", { name: /confirmar|aplicar|aceptar/i })).toHaveCount(0)

  await instruir(page, "Crea una clase Cliente")
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()

  await instruir(page, "Agrega un atributo correo String a Cliente")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Cliente" })).toContainText("correo")
  await expect(page.getByTestId("resumen-canonico")).toContainText("Atributos1")

  await instruir(page, "Crea una clase ClienteEmpresa")
  await expect(page.getByText("ClienteEmpresa", { exact: true }).first()).toBeVisible()
  const cantidadAntes = await page.locator(".react-flow__node").count()
  await instruir(page, "Agrega correo String al cliente")
  await expect(panel.getByRole("status")).toContainText("¿Quieres agregar el atributo a Cliente o ClienteEmpresa?")
  await expect(page.locator(".react-flow__node")).toHaveCount(cantidadAntes)
})

test("un cambio automático de IA se propaga al colaborador por Apollon/Yjs", async ({ browser }) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  try {
    const proyecto = await crearProyectoE2E(paginaA, "IA colaboración")
    await abrirProyectoE2E(paginaB, proyecto)
    await expect(paginaA.getByTestId("cantidad-participantes")).toContainText("2")

    await instruir(paginaA, "Crea una clase Factura")
    await expect(paginaA.getByText("Factura", { exact: true }).first()).toBeVisible()
    await expect(paginaB.getByText("Factura", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(paginaB.getByTestId("resumen-canonico")).toContainText("Clases1")
  } finally {
    await contextoA.close()
    await contextoB.close()
  }
})
