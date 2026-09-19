import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import JSZip from "jszip"
import { crearClaseNombradaE2E, crearProyectoE2E } from "./ayudas/proyectos"

test("genera y descarga un backend desde una clase editada en Apollon", async ({ page }) => {
  await crearProyectoE2E(page, "CU09")
  await expect(page.locator(".react-flow")).toBeVisible()

  await crearClaseNombradaE2E(page, "Cliente")
  const inspector = page.getByTestId("inspector-propiedades")
  await inspector.getByRole("button", { name: "+ Agregar atributo" }).click()
  const nuevo = inspector.getByRole("group", { name: "Nuevo atributo" })
  await nuevo.getByLabel("Nombre").fill("nombre")
  await nuevo.getByLabel("Tipo").selectOption("String")
  await nuevo.getByLabel("Visibilidad").selectOption("privada")
  await nuevo.getByRole("button", { name: "Confirmar atributo" }).click()
  await inspector.getByRole("button", { name: "+ Agregar atributo" }).click()
  const identidad = inspector.getByRole("group", { name: "Nuevo atributo" })
  await identidad.getByLabel("Nombre").fill("id")
  await identidad.getByLabel("Tipo").selectOption("Long")
  await identidad.getByRole("button", { name: "Confirmar atributo" }).click()
  await inspector.getByRole("button", { name: "+ Agregar método" }).click()
  const operacion = inspector.getByRole("group", { name: "Nuevo método" })
  await operacion.getByLabel("Nombre").fill("cambiarNombre")
  await operacion.getByLabel("Tipo de retorno").selectOption("void")
  await operacion.getByRole("button", { name: "Confirmar método" }).click()

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
  const entidad = await zip.file("backend-generado/src/main/java/com/sw1/generated/modelo/Cliente.java")?.async("string")
  expect(entidad?.match(/@Id\b/g)).toHaveLength(1)
  expect(entidad?.match(/private Long id;/g)).toHaveLength(1)
  expect(entidad).toContain("private String nombre;")
  expect(entidad).not.toContain("cambiarNombre")
  await expect(page.getByText("Backend generado y descargado.")).toBeVisible()
})
