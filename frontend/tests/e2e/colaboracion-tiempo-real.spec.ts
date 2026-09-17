import { expect, test, type Page } from "@playwright/test"
import { abrirProyectoE2E, crearProyectoE2E } from "./ayudas/proyectos"

async function crearClase(page: Page, nombre: string, desplazamientoX = 0) {
  const herramienta = page.getByText("Class", { exact: true }).first()
  const lienzo = page.locator(".react-flow__pane")
  const caja = await lienzo.boundingBox()
  if (!caja) throw new Error("No se pudo calcular el área del lienzo")
  await herramienta.dragTo(lienzo, {
    targetPosition: {
      x: Math.round(caja.width / 2 + desplazamientoX),
      y: Math.round(caja.height / 2),
    },
  })
  await page.locator(".react-flow__node").last().click()
  await page.getByRole("button", { name: /Edit element|Editar elemento/i }).click()
  await page.getByRole("textbox", { name: "Name" }).first().fill(nombre)
  await expect(page.getByText(nombre, { exact: true }).first()).toBeVisible()
}

test("dos diseñadores colaboran, convergen y aíslan salas", async ({ browser }) => {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const contextoC = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  const paginaC = await contextoC.newPage()

  try {
    const proyecto = await crearProyectoE2E(paginaA, `Colaboración ${sufijo}`)
    await crearClase(paginaA, "Cliente")

    await abrirProyectoE2E(paginaB, proyecto)
    await expect(paginaB.getByText("Cliente", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(paginaA.getByTestId("cantidad-participantes")).toContainText("2")
    await expect(paginaB.getByTestId("cantidad-participantes")).toContainText("2")
    await expect(paginaA.getByRole("list", { name: "Participantes conectados" })).toContainText("Diseñador")

    await paginaA.getByRole("textbox", { name: "Name" }).first().fill("ClienteCompartido")
    await expect(paginaB.getByText("ClienteCompartido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    await crearClase(paginaB, "Pedido", 180)
    await expect(paginaA.getByText("Pedido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    for (const pagina of [paginaA, paginaB]) {
      await expect(pagina.getByText("ClienteCompartido", { exact: true }).first()).toBeVisible()
      await expect(pagina.getByText("Pedido", { exact: true }).first()).toBeVisible()
      await expect(pagina.getByTestId("resumen-canonico")).toContainText("2")
    }

    await crearProyectoE2E(paginaC, `Otra colaboración ${sufijo}`)
    await expect(paginaC.getByTestId("resumen-canonico")).toContainText("Clases0")
    await expect(paginaC.getByText("ClienteCompartido", { exact: true })).toHaveCount(0)
    await expect(paginaC.getByText("Pedido", { exact: true })).toHaveCount(0)
  } finally {
    await contextoA.close()
    await contextoB.close()
    await contextoC.close()
  }
})
