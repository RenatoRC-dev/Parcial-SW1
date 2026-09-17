import { expect, test } from "@playwright/test"
import { abrirProyectoE2E, crearClaseNombradaE2E, crearProyectoE2E } from "./ayudas/proyectos"

test("crea, edita, guarda y recupera Cliente después de recargar", async ({ page }) => {
  const nombre = await crearProyectoE2E(page, "Persistencia")
  await crearClaseNombradaE2E(page, "Cliente")
  await expect(page.getByTestId("estado-guardado")).toHaveText("Cambios sin guardar")
  await page.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText("Proyecto guardado correctamente.")).toBeVisible()
  await page.reload()
  await abrirProyectoE2E(page, nombre)
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId("resumen-canonico")).toContainText("Clases1")
})

test("dos proyectos persistidos conservan contenido aislado", async ({ page }) => {
  const proyectoA = await crearProyectoE2E(page, "Aislado A")
  await crearClaseNombradaE2E(page, "Cliente")
  await page.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText("Proyecto guardado correctamente.")).toBeVisible()
  await page.getByRole("button", { name: "Mis proyectos" }).click()

  const proyectoB = await crearProyectoE2E(page, "Aislado B")
  await crearClaseNombradaE2E(page, "Factura")
  await page.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText("Proyecto guardado correctamente.")).toBeVisible()
  await page.getByRole("button", { name: "Mis proyectos" }).click()

  await abrirProyectoE2E(page, proyectoA)
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Factura", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Mis proyectos" }).click()
  await abrirProyectoE2E(page, proyectoB)
  await expect(page.getByText("Factura", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Cliente", { exact: true })).toHaveCount(0)
})

test("estado Yjs en vivo del mismo proyecto se guarda explícitamente y se recupera", async ({ browser }) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  const proyecto = await crearProyectoE2E(paginaA, "Colaboración durable")
  await abrirProyectoE2E(paginaB, proyecto)
  await expect(paginaA.getByTestId("cantidad-participantes")).toContainText("2")
  await crearClaseNombradaE2E(paginaA, "Pedido")
  await expect(paginaB.getByText("Pedido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  await expect(paginaB.getByTestId("estado-guardado")).toHaveText("Cambios sin guardar")
  await paginaB.getByRole("button", { name: "Guardar" }).click()
  await expect(paginaB.getByText("Proyecto guardado correctamente.")).toBeVisible()
  await contextoA.close(); await contextoB.close()

  const contextoNuevo = await browser.newContext()
  const paginaNueva = await contextoNuevo.newPage()
  await abrirProyectoE2E(paginaNueva, proyecto)
  await expect(paginaNueva.getByText("Pedido", { exact: true }).first()).toBeVisible()
  await contextoNuevo.close()
})

test("protege cambios sin guardar al volver a Mis proyectos", async ({ page }) => {
  await crearProyectoE2E(page, "Cambios pendientes")
  await crearClaseNombradaE2E(page, "Temporal")
  page.once("dialog", (dialog) => dialog.dismiss())
  await page.getByRole("button", { name: "Mis proyectos" }).click()
  await expect(page.getByText("Temporal", { exact: true }).first()).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Mis proyectos" }).click()
  await expect(page.getByRole("heading", { name: "Proyectos de modelado" })).toBeVisible()
})
