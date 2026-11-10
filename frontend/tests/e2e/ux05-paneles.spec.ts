import { expect, test } from "@playwright/test"

// Focused UI regression: persistent Save feedback must not cover panel controls.
// Run against explicitly deterministic local services; no live provider needed.
for (const width of [390, 768, 960]) {
  test(`UX05 Save feedback leaves panel controls usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/")
    await page.locator("button.primary-create").click()
    await page.getByLabel("Nombre del proyecto").fill(`UX05 panel QA ${width} ${Date.now()}`)
    await page.getByLabel("Tu nombre o apodo").fill("QA")
    await page.getByRole("button", { name: "Crear proyecto", exact: true }).click()
    await page.getByRole("button", { name: "Entrar al proyecto", exact: true }).click()
    const properties = page.getByRole("button", { name: "Propiedades UML", exact: true })
    if (await properties.getAttribute("aria-expanded") === "false") await properties.click()
    const group = page.getByTestId("inspector-propiedades").getByRole("group", { name: "Nueva clase" })
    await group.getByLabel("Nombre de clase").fill("Prestamo")
    await group.getByRole("button", { name: "Crear clase", exact: true }).click()
    await page.getByRole("button", { name: "Guardar", exact: true }).click()
    const feedback = page.locator(".topbar-message")
    await expect(feedback).toContainText("Proyecto guardado correctamente")
    await properties.scrollIntoViewIfNeeded()
    const messageBox = (await feedback.boundingBox())!
    const controlBox = (await properties.boundingBox())!
    expect(messageBox.y + messageBox.height).toBeLessThanOrEqual(controlBox.y)
    // Native clicks, without force: catches real interception by the notification.
    await properties.click()
    await expect(properties).toHaveAttribute("aria-expanded", "false")
    await properties.click()
    await expect(properties).toHaveAttribute("aria-expanded", "true")
    const assistant = page.getByRole("button", { name: "Asistente", exact: true })
    await assistant.focus()
    await assistant.press("Enter")
    await expect(assistant).toHaveAttribute("aria-expanded", width < 960 ? "true" : "false")
    await expect(properties).toHaveAttribute("aria-expanded", "true")
  })
}
