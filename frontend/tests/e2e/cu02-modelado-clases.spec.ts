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

  const herramientaClase = page.getByText("Class", { exact: true }).first()
  const lienzo = page.locator(".react-flow__pane")

  await expect(herramientaClase).toBeVisible()
  await expect(lienzo).toBeVisible()

  const cajaLienzo = await lienzo.boundingBox()
  if (!cajaLienzo) throw new Error("No se pudo calcular el área del lienzo")

  await herramientaClase.dragTo(lienzo, {
    targetPosition: {
      x: Math.round(cajaLienzo.width / 2),
      y: Math.round(cajaLienzo.height / 2),
    },
  })

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
  await expect(page.getByTestId("resumen-validacion")).toContainText("Inválido")
  await expect(page.getByTestId("resumen-validacion")).toContainText(
    "ATRIBUTO_TIPO_NO_SOPORTADO"
  )

  await page.getByText("Modelo UML canónico (JSON)").click()
  await expect(page.locator(".canonical-json pre")).toContainText(
    '"nombre": "Class"'
  )
})
