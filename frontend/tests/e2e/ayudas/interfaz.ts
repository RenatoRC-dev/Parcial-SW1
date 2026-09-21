import type { Page } from "@playwright/test"

export async function abrirHerramienta(page: Page, nombre: "Asistente IA" | "Desde imagen" | "XMI" | "Generar") {
  const boton = page.getByRole("button", { name: nombre, exact: true })
  if (await boton.getAttribute("aria-pressed") !== "true") await boton.click()
}

export async function cerrarHerramienta(page: Page) {
  const cerrar = page.getByRole("button", { name: "Cerrar panel", exact: true })
  if (await cerrar.isVisible()) await cerrar.click()
}

export async function abrirDiagnosticoTecnico(page: Page) {
  const detalle = page.locator("details.technical-diagnostics")
  if (await detalle.getAttribute("open") === null) {
    await detalle.locator(":scope > summary").click()
  }
}
