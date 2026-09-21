import { expect, test } from "@playwright/test"
import { abrirProyectoE2E, crearClaseNombradaE2E, crearProyectoE2E } from "./ayudas/proyectos"
import { abrirDiagnosticoTecnico } from "./ayudas/interfaz"

test("dos diseñadores colaboran, convergen y aíslan salas", async ({ browser }) => {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const contextoC = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  const paginaC = await contextoC.newPage()

  try {
    const proyecto = await crearProyectoE2E(paginaA, `Colaboración ${sufijo}`)
    await crearClaseNombradaE2E(paginaA, "Cliente")

    await abrirProyectoE2E(paginaB, proyecto)
    await expect(paginaB.getByText("Cliente", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(paginaA.getByTestId("cantidad-participantes")).toContainText("2")
    await expect(paginaB.getByTestId("cantidad-participantes")).toContainText("2")
    await expect(paginaA.getByRole("list", { name: "Participantes conectados" })).toContainText("Diseñador")

    const nombreClase = paginaA.getByTestId("inspector-propiedades").getByLabel("Nombre de la clase seleccionada")
    await nombreClase.fill("ClienteCompartido")
    await nombreClase.press("Enter")
    await expect(paginaB.getByText("ClienteCompartido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    const inspectorA = paginaA.getByTestId("inspector-propiedades")
    await inspectorA.getByRole("button", { name: "+ Agregar método" }).click()
    const nuevoMetodo = inspectorA.getByRole("group", { name: "Nuevo método" })
    await nuevoMetodo.getByLabel("Nombre").fill("calcularTotal")
    await nuevoMetodo.getByLabel("Tipo de retorno").selectOption("Double")
    await nuevoMetodo.getByRole("button", { name: "Confirmar método" }).click()
    await expect(paginaB.locator(".react-flow__node").filter({ hasText: "calcularTotal(): Double" })).toBeVisible({ timeout: 15_000 })

    await paginaB.locator(".react-flow__node").filter({ hasText: "ClienteCompartido" }).click()
    const metodoB = paginaB.getByTestId("inspector-propiedades").getByRole("group", { name: "Método calcularTotal" })
    await metodoB.getByLabel("Tipo de retorno calcularTotal").selectOption("Boolean")
    await expect(paginaA.locator(".react-flow__node").filter({ hasText: "calcularTotal(): Boolean" })).toBeVisible({ timeout: 15_000 })
    await metodoB.getByRole("button", { name: "Eliminar método calcularTotal" }).click()
    await expect(paginaA.getByText("calcularTotal(): Boolean", { exact: true })).toHaveCount(0, { timeout: 15_000 })

    await crearClaseNombradaE2E(paginaB, "Pedido", 180)
    await expect(paginaA.getByText("Pedido", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    await inspectorA.getByRole("button", { name: "+ Nueva relación" }).click()
    const nuevaRelacion = inspectorA.getByRole("group", { name: "Nueva relación" })
    await nuevaRelacion.getByLabel("Clase A", { exact: true }).selectOption({ label: "ClienteCompartido" })
    await nuevaRelacion.getByLabel("Clase B", { exact: true }).selectOption({ label: "Pedido" })
    await nuevaRelacion.getByLabel("Para una ClienteCompartido, ¿cuántos Pedido puede haber?").selectOption("0..*")
    await nuevaRelacion.getByLabel("Para un Pedido, ¿cuántas ClienteCompartido puede haber?").selectOption("1")
    await nuevaRelacion.getByRole("button", { name: "Crear relación" }).click()
    await expect(paginaB.locator(".react-flow__edge")).toHaveCount(1, { timeout: 15_000 })
    await abrirDiagnosticoTecnico(paginaB)
    await paginaB.getByText("Modelo UML canónico (JSON)").click()
    await expect(paginaB.locator(".canonical-json pre")).toContainText('"multiplicidadOrigen": "1"')
    await expect(paginaB.locator(".canonical-json pre")).toContainText('"multiplicidadDestino": "0..*"')

    for (const pagina of [paginaA, paginaB]) {
      await expect(pagina.getByText("ClienteCompartido", { exact: true }).first()).toBeVisible()
      await expect(pagina.getByText("Pedido", { exact: true }).first()).toBeVisible()
      await expect(pagina.getByTestId("resumen-canonico")).toContainText("2")
    }

    await crearProyectoE2E(paginaC, `Otra colaboración ${sufijo}`)
    await expect(paginaC.getByTestId("resumen-canonico")).toContainText("Clases0")
    await expect(paginaC.getByText("ClienteCompartido", { exact: true })).toHaveCount(0)
    await expect(paginaC.getByText("Pedido", { exact: true })).toHaveCount(0)
  } finally {
    await contextoA.close()
    await contextoB.close()
    await contextoC.close()
  }
})
