import { expect, test, type Page } from "@playwright/test"

async function unirSala(page: Page, nombre: string, sala: string) {
  await page.goto(`/?room=${sala}`)
  await expect(page.locator(".react-flow")).toBeVisible()
  const panel = page.getByTestId("panel-colaboracion")
  await panel.getByLabel("Nombre").fill(nombre)
  await panel.getByRole("button", { name: "Conectar" }).click()
  await expect(panel.getByRole("status")).toContainText("conectado")
}

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
  const sala = `sw1-e2e-${sufijo}`
  const otraSala = `otra-${sufijo}`
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const contextoC = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  const paginaC = await contextoC.newPage()

  try {
    await unirSala(paginaA, "Ana", sala)
    await crearClase(paginaA, "Cliente")

    await unirSala(paginaB, "Bruno", sala)
    await expect(paginaB.getByText("Cliente", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(paginaA.getByTestId("cantidad-participantes")).toContainText("2")
    await expect(paginaB.getByTestId("cantidad-participantes")).toContainText("2")
    await expect(paginaA.getByRole("list", { name: "Participantes conectados" })).toContainText("Ana")
    await expect(paginaA.getByRole("list", { name: "Participantes conectados" })).toContainText("Bruno")

    await paginaA.getByRole("textbox", { name: "Name" }).first().fill("ClienteCompartido")
    await expect(paginaB.getByText("ClienteCompartido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    await crearClase(paginaB, "Pedido", 180)
    await expect(paginaA.getByText("Pedido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    for (const pagina of [paginaA, paginaB]) {
      await expect(pagina.getByText("ClienteCompartido", { exact: true }).first()).toBeVisible()
      await expect(pagina.getByText("Pedido", { exact: true }).first()).toBeVisible()
      await expect(pagina.getByTestId("resumen-canonico")).toContainText("2")
    }

    await unirSala(paginaC, "Carla", otraSala)
    await expect(paginaC.getByTestId("resumen-canonico")).toContainText("Clases0")
    await expect(paginaC.getByText("ClienteCompartido", { exact: true })).toHaveCount(0)
    await expect(paginaC.getByText("Pedido", { exact: true })).toHaveCount(0)
  } finally {
    await contextoA.close()
    await contextoB.close()
    await contextoC.close()
  }
})
