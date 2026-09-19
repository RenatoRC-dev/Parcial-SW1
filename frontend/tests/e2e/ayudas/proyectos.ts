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
  const inspector = page.getByTestId("inspector-propiedades")
  const nuevaClase = inspector.getByRole("group", { name: "Nueva clase" })
  void desplazamientoX
  await nuevaClase.getByLabel("Nombre de clase").fill(nombre)
  await nuevaClase.getByRole("button", { name: "Crear clase" }).click()
  const nodo = page.locator(".react-flow__node").filter({ hasText: nombre })
  await expect(nodo).toBeVisible()
  await nodo.click()
}
