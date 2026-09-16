import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import JSZip from "jszip"

test("genera y descarga un backend desde una clase editada en Apollon", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".react-flow")).toBeVisible()

  const herramientaClase = page.getByText("Class", { exact: true }).first()
  const lienzo = page.locator(".react-flow__pane")
  const cajaLienzo = await lienzo.boundingBox()
  if (!cajaLienzo) throw new Error("No se pudo calcular el área del lienzo")
  await herramientaClase.dragTo(lienzo, {
    targetPosition: {
      x: Math.round(cajaLienzo.width / 2),
      y: Math.round(cajaLienzo.height / 2),
    },
  })

  await page.locator(".react-flow__node").last().click()
  await page.getByRole("button", { name: /Edit element|Editar elemento/i }).click()
  const camposNombre = page.getByRole("textbox", { name: "Name" })
  await camposNombre.nth(0).fill("Cliente")
  await camposNombre.nth(1).fill("+ nombre: String")

  await expect(page.getByTestId("resumen-validacion")).toContainText("Válido")
  await expect(page.getByTestId("panel-generacion")).toContainText("GeneradorApto")

  const descargaPendiente = page.waitForEvent("download")
  await page.getByRole("button", { name: "Generar backend Spring Boot" }).click()
  const descarga = await descargaPendiente
  expect(descarga.suggestedFilename()).toBe("backend-generado.zip")
  const ruta = await descarga.path()
  if (!ruta) throw new Error("Playwright no conservó el archivo descargado")

  const zip = await JSZip.loadAsync(await readFile(ruta))
  const archivos = Object.keys(zip.files)
  expect(archivos).toContain("backend-generado/pom.xml")
  expect(archivos).toContain(
    "backend-generado/src/main/java/com/sw1/generated/modelo/Cliente.java"
  )
  await expect(page.getByText("Backend generado y descargado.")).toBeVisible()
})
