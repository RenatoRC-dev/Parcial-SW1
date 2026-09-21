import { expect, test } from "@playwright/test"
import { abrirHerramienta } from "./ayudas/interfaz"
import { crearProyectoE2E } from "./ayudas/proyectos"

async function preguntar(page: import("@playwright/test").Page, pregunta: string) {
  const panel = page.getByTestId("panel-asistente-contextual")
  await panel.getByLabel("Pregunta sobre tu modelo o sobre SW1").fill(pregunta)
  await panel.getByRole("button", { name: "Preguntar", exact: true }).click()
  return panel
}

test("CU12 ofrece ayuda factual de voz y XMI sin depender de Groq", async ({ page }) => {
  await crearProyectoE2E(page, "CU12 producto")
  await abrirHerramienta(page, "Asistente IA")

  const panel = await preguntar(page, "¿Cómo funciona la voz?")
  await expect(panel).toContainText("transcribe el audio y envía automáticamente")
  await expect(panel).toContainText("No debes pulsar Enviar después")

  await preguntar(page, "¿Cómo importo o exporto XMI?")
  await expect(panel).toContainText("reemplazará el diagrama actual")
  await expect(panel).toContainText("modelo.xmi")
  await expect(panel).not.toContainText("modelo candidato")
})

test("CU12 no confunde validez técnica con completitud del negocio", async ({ page }) => {
  await crearProyectoE2E(page, "CU12 alcance")
  await abrirHerramienta(page, "Asistente IA")
  const panel = await preguntar(page, "¿Qué podría faltar en mi dominio?")
  await expect(panel).toContainText("completitud del negocio no puede demostrarse")
  await expect(panel).toContainText("requisitos del negocio o casos de uso")
  await expect(panel).not.toContainText(/Dirección|EstadoFactura|teléfono/)
})
