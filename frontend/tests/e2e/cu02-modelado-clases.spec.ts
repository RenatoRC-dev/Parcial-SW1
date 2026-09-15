import { expect, test } from "@playwright/test"

test("el diseñador crea una clase y CU02 recibe el modelo estructurado", async ({
  page,
}) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Modelado manual de diagramas de clases" })
  ).toBeVisible()
  await expect(page.locator(".react-flow")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Inspector de Modelo — Desarrollo" })
  ).toBeVisible()
  await expect(page.locator(".model-facts")).toContainText("ClassDiagram")

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

  const filaClases = page.locator(".model-facts div").filter({ hasText: "Clases" })
  await expect(filaClases).toContainText("1")

  await page.getByText("Modelo UML estructurado (JSON)").click()
  await expect(page.locator(".model-json pre")).toContainText('"type": "class"')
})

