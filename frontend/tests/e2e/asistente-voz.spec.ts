import { expect, test, type Page } from "@playwright/test"

async function usarVoz(page: Page) {
  const panel = page.getByTestId("panel-asistente-ia")
  await panel.getByRole("button", { name: /Hablar/ }).click()
  await expect(panel.getByText("Escuchando...")).toBeVisible()
  await panel.getByRole("button", { name: /Detener/ }).click()
  await expect(panel.getByText(/Voz reconocida:/).locator("..")).toContainText("Crea una clase Factura", { timeout: 20_000 })
  await expect(panel.getByRole("status")).toContainText("Listo", { timeout: 20_000 })
  return panel
}

async function unirSala(page: Page, nombre: string, sala: string) {
  await page.goto(`/?room=${sala}`)
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = page.getByTestId("panel-colaboracion")
  await panel.getByLabel("Nombre").fill(nombre)
  await panel.getByRole("button", { name: "Conectar" }).click()
  await expect(panel.getByRole("status")).toContainText("conectado")
}

test("la voz se transcribe y aplica automáticamente mediante el CU04 existente", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = await usarVoz(page)
  await expect(panel.getByLabel("Instrucción UML")).toHaveValue("Crea una clase Factura")
  await expect(panel.getByRole("button", { name: /confirmar|aplicar|aceptar/i })).toHaveCount(0)
  await expect(page.getByText("Factura", { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId("resumen-canonico")).toContainText("Clases1")
})

test("la clase creada por voz se propaga al colaborador por Apollon/Yjs", async ({ browser }) => {
  const sala = `voz-collab-${Date.now()}`
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const ana = await contextoA.newPage()
  const bruno = await contextoB.newPage()
  try {
    await unirSala(ana, "Ana", sala)
    await unirSala(bruno, "Bruno", sala)
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
