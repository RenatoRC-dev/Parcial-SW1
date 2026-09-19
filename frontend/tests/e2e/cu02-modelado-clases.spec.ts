import { expect, test } from "@playwright/test"
import { crearProyectoE2E } from "./ayudas/proyectos"

test("el diseñador crea una clase y CU02 recibe el modelo estructurado", async ({
  page,
}) => {
  await crearProyectoE2E(page, "CU02")

  await expect(
    page.getByRole("heading", { name: "Modelado manual de diagramas de clases" })
  ).toBeVisible()
  await expect(page.locator(".react-flow")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Inspector de Modelo — Desarrollo" })
  ).toBeVisible()
  await expect(page.getByTestId("resumen-apollon")).toContainText("ClassDiagram")

  await expect(page.locator('[data-apollon-control="apollon:palette"]')).toHaveCount(0)
  const inspector = page.getByTestId("inspector-propiedades")
  await inspector.getByLabel("Nombre de clase").fill("Cliente")
  await inspector.getByRole("button", { name: "Crear clase" }).click()

  const clasesApollon = page
    .getByTestId("resumen-apollon")
    .locator("div")
    .filter({ hasText: "Clases" })
  const clasesCanonicas = page
    .getByTestId("resumen-canonico")
    .locator("div")
    .filter({ hasText: "Clases" })
  await expect(clasesApollon).toContainText("1")
  await expect(clasesCanonicas).toContainText("1")
  await expect(page.getByTestId("resumen-validacion")).toBeVisible()
  await expect(page.getByTestId("resumen-validacion")).toContainText("Válido")

  await page.getByText("Modelo UML canónico (JSON)").click()
  await expect(page.locator(".canonical-json pre")).toContainText(
    '"nombre": "Cliente"'
  )
  await expect(page.locator(".canonical-json pre")).toContainText('"atributos": []')
  await expect(page.locator(".canonical-json pre")).toContainText('"metodos": []')
})
