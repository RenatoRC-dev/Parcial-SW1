import { expect, type Page } from "@playwright/test"

export async function crearProyectoE2E(page: Page, prefijo = "Proyecto E2E"): Promise<string> {
  const nombre = `${prefijo} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`
  await page.goto("/")
  await page.getByLabel("Nombre del proyecto").fill(nombre)
  await page.getByRole("button", { name: "Crear proyecto" }).click()
  await expect(page.locator(".react-flow")).toBeVisible()
  return nombre
}

export async function abrirProyectoE2E(page: Page, nombre: string): Promise<void> {
  await page.goto("/")
  const elemento = page.locator(".project-list li").filter({ hasText: nombre })
  await elemento.getByRole("button", { name: "Abrir" }).click()
  await expect(page.locator(".react-flow")).toBeVisible()
}

export async function crearClaseNombradaE2E(page: Page, nombre: string, desplazamientoX = 0): Promise<void> {
  const lienzo = page.locator(".react-flow__pane")
  const caja = await lienzo.boundingBox()
  if (!caja) throw new Error("No se pudo calcular el lienzo")
  await page.getByText("Class", { exact: true }).first().dragTo(lienzo, {
    targetPosition: { x: Math.round(caja.width / 2 + desplazamientoX), y: Math.round(caja.height / 2) },
  })
  await page.locator(".react-flow__node").last().click()
  await page.getByRole("button", { name: /Edit element|Editar elemento/i }).click()
  await page.getByRole("textbox", { name: "Name" }).first().fill(nombre)
  await expect(page.getByText(nombre, { exact: true }).first()).toBeVisible()
}
