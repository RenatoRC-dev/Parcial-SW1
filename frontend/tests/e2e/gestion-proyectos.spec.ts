import { expect, test } from "@playwright/test"
import { abrirProyectoE2E, crearClaseNombradaE2E, crearProyectoE2E, obtenerCodigoProyectoE2E } from "./ayudas/proyectos"

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
  await page.getByRole("button", { name: "Volver" }).click()

  const proyectoB = await crearProyectoE2E(page, "Aislado B")
  await crearClaseNombradaE2E(page, "Factura")
  await page.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText("Proyecto guardado correctamente.")).toBeVisible()
  await page.getByRole("button", { name: "Volver" }).click()

  await abrirProyectoE2E(page, proyectoA)
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Factura", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Volver" }).click()
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

test("protege cambios sin guardar al volver a Proyectos recientes", async ({ page }) => {
  await crearProyectoE2E(page, "Cambios pendientes")
  await crearClaseNombradaE2E(page, "Temporal")
  page.once("dialog", (dialog) => dialog.dismiss())
  await page.getByRole("button", { name: "Volver" }).click()
  await expect(page.getByText("Temporal", { exact: true }).first()).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Volver" }).click()
  await expect(page.getByRole("heading", { name: "Proyectos de modelado" })).toBeVisible()
})

test("un navegador limpio no descubre el proyecto y se une mediante código", async ({ browser }) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  const nombre = await crearProyectoE2E(paginaA, "Acceso seguro", "Renato")

  await paginaB.goto("/")
  await expect(paginaB.getByText(nombre)).toHaveCount(0)
  await expect(paginaB.getByText("No hay proyectos recientes en este dispositivo.")).toBeVisible()
  await abrirProyectoE2E(paginaB, nombre, "Carlos")
  await expect(paginaB.locator(".project-toolbar")).toContainText("Carlos")
  await contextoA.close(); await contextoB.close()
})

test("reabre un proyecto reciente sin volver a pedir código", async ({ page }) => {
  const nombre = await crearProyectoE2E(page, "Reciente", "Renato")
  await page.getByRole("button", { name: "Volver" }).click()
  const tarjeta = page.locator(".project-list li").filter({ hasText: nombre })
  await expect(tarjeta).toContainText("Renato")
  await tarjeta.getByRole("button", { name: "Abrir" }).click()
  await expect(page.locator(".react-flow")).toBeVisible()
})

test("rechaza un código inválido con mensaje controlado", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Unirse con código" }).click()
  await page.getByLabel("Código del proyecto").fill("NX-2222-2222-2222")
  await page.getByLabel("Tu nombre o apodo").fill("Carlos")
  await page.getByRole("button", { name: "Entrar al proyecto" }).click()
  await expect(page.getByRole("alert")).toHaveText("El código del proyecto no es válido.")
  await expect(page.locator(".react-flow")).toHaveCount(0)
})

test("elimina un acceso local inválido sin borrar el proyecto", async ({ page }) => {
  const nombre = await crearProyectoE2E(page, "Credencial inválida", "Renato")
  await page.getByRole("button", { name: "Volver" }).click()
  await page.evaluate((nombreProyecto) => {
    const clave = "nexocase.proyectosRecientes.v1"
    const esquema = JSON.parse(localStorage.getItem(clave) ?? "{}") as { proyectos?: Array<Record<string, string>> }
    if (esquema.proyectos?.[0]) esquema.proyectos[0].credential = "A".repeat(43)
    localStorage.setItem(clave, JSON.stringify(esquema))
  }, nombre)
  await page.reload()
  await page.locator(".project-list li").filter({ hasText: nombre }).getByRole("button", { name: "Abrir" }).click()
  await expect(page.getByRole("alert")).toContainText("El acceso guardado ya no es válido")
  await expect(page.getByRole("heading", { name: "Unirse con código" })).toBeVisible()
  await expect(page.getByText(nombre)).toHaveCount(0)
  expect(obtenerCodigoProyectoE2E(nombre)).toMatch(/^NX-/)
})
