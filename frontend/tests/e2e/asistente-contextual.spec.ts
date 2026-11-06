import { expect, test, type Browser, type Page } from "@playwright/test"
import { abrirHerramienta } from "./ayudas/interfaz"
import { abrirProyectoE2E, crearClaseNombradaE2E, crearProyectoE2E } from "./ayudas/proyectos"

interface AccesoLocal { projectId: string; participantId: string; displayName: string; credential: string }

test.describe.configure({ timeout: 60_000 })

async function accesoActual(page: Page): Promise<AccesoLocal> {
  return page.evaluate(() => {
    const datos = JSON.parse(localStorage.getItem("nexocase.proyectosRecientes.v1") ?? "{}") as { proyectos?: AccesoLocal[] }
    if (!datos.proyectos?.[0]) throw new Error("Acceso E2E ausente")
    return datos.proyectos[0]
  })
}

async function abrirPanel(page: Page) {
  const panel = page.getByTestId("panel-asistente-colaborativo")
  if (!await panel.isVisible().catch(() => false)) await abrirHerramienta(page, "Asistente IA")
  await expect(panel.getByRole("heading", { name: "Asistente colaborativo" })).toBeVisible()
  return panel
}

async function preguntar(page: Page, pregunta: string) {
  const panel = await abrirPanel(page)
  await panel.getByLabel("Pregunta al asistente colaborativo").fill(pregunta)
  await panel.getByRole("button", { name: "Enviar", exact: true }).click()
  await expect(panel).toContainText(pregunta)
  return panel
}

async function dosParticipantes(browser: Browser, prefijo: string) {
  const contextoRenato = await browser.newContext(); const contextoCarlos = await browser.newContext()
  const renato = await contextoRenato.newPage(); const carlos = await contextoCarlos.newPage()
  const nombre = await crearProyectoE2E(renato, prefijo, "Renato")
  await abrirProyectoE2E(carlos, nombre, "Carlos")
  return { contextoRenato, contextoCarlos, renato, carlos, nombre }
}

test("P5-01 conversación compartida entre Renato y Carlos", async ({ browser }) => {
  const equipo = await dosParticipantes(browser, "P5-01")
  try {
    await abrirPanel(equipo.carlos)
    const panelRenato = await preguntar(equipo.renato, "¿Cómo exporto XMI?")
    await expect(panelRenato).toContainText("modelo.xmi")
    const panelCarlos = equipo.carlos.getByTestId("panel-asistente-colaborativo")
    await expect(panelCarlos).toContainText("Renato:")
    await expect(panelCarlos).toContainText("modelo.xmi")
  } finally { await equipo.contextoRenato.close(); await equipo.contextoCarlos.close() }
})

test("P5-02 Carlos pregunta y ambos ven autor y respuesta correlacionada", async ({ browser }) => {
  const equipo = await dosParticipantes(browser, "P5-02")
  try {
    await abrirPanel(equipo.renato)
    const panelCarlos = await preguntar(equipo.carlos, "Analiza el contexto compartido")
    await expect(panelCarlos).toContainText("Carlos:")
    await expect(panelCarlos).toContainText("Carlos, revisé el modelo")
    await expect(equipo.renato.getByTestId("panel-asistente-colaborativo")).toContainText("Carlos, revisé el modelo")
  } finally { await equipo.contextoRenato.close(); await equipo.contextoCarlos.close() }
})

test("P5-03 recarga restaura la conversación desde persistencia", async ({ browser }) => {
  const equipo = await dosParticipantes(browser, "P5-03")
  try {
    await preguntar(equipo.renato, "¿Cómo exporto XMI?")
    await equipo.renato.reload(); await equipo.carlos.reload()
    await abrirProyectoE2E(equipo.renato, equipo.nombre, "Renato")
    await abrirProyectoE2E(equipo.carlos, equipo.nombre, "Carlos")
    await expect(await abrirPanel(equipo.renato)).toContainText("¿Cómo exporto XMI?")
    await expect(await abrirPanel(equipo.carlos)).toContainText("modelo.xmi")
  } finally { await equipo.contextoRenato.close(); await equipo.contextoCarlos.close() }
})

test("P5-04 participante tardía recupera conversación sin anfitrión", async ({ browser }) => {
  const creador = await browser.newContext(); const renato = await creador.newPage()
  const nombre = await crearProyectoE2E(renato, "P5-04", "Renato")
  await preguntar(renato, "¿Cómo exporto XMI?")
  await creador.close()
  const contextoAna = await browser.newContext(); const ana = await contextoAna.newPage()
  try {
    await abrirProyectoE2E(ana, nombre, "Ana")
    const panel = await abrirPanel(ana)
    await expect(panel).toContainText("Renato:")
    await expect(panel).toContainText("modelo.xmi")
  } finally { await contextoAna.close() }
})

test("P5-05 mentor de producto responde XMI sin Groq", async ({ page }) => {
  await crearProyectoE2E(page, "P5-05", "Renato")
  const panel = await preguntar(page, "¿Cómo exporto XMI?")
  await expect(panel).toContainText("modelo.xmi")
  await expect(panel).toContainText("XMI no es necesario para generar Spring")
})

test("P5-06 consulta actividad y atribuye Venta a Carlos", async ({ browser }) => {
  const equipo = await dosParticipantes(browser, "P5-06")
  try {
    await crearClaseNombradaE2E(equipo.carlos, "Venta")
    await expect(equipo.renato.getByText("Venta", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    const panel = await preguntar(equipo.renato, "¿Quién creó Venta?")
    await expect(panel).toContainText("Carlos creó Venta")
  } finally { await equipo.contextoRenato.close(); await equipo.contextoCarlos.close() }
})

test("P5-07 no inventa autor cuando no existe evidencia", async ({ page }) => {
  await crearProyectoE2E(page, "P5-07", "Renato")
  const panel = await preguntar(page, "¿Quién creó Fantasma?")
  await expect(panel).toContainText("No tengo evidencia registrada suficiente")
  await expect(panel).not.toContainText("Renato creó Fantasma")
})

test("P5-08 conserva continuidad en una pregunta de seguimiento", async ({ page }) => {
  await crearProyectoE2E(page, "P5-08", "Renato")
  await crearClaseNombradaE2E(page, "Venta")
  await preguntar(page, "Explícame Venta")
  const panel = await preguntar(page, "¿Y sus métodos?")
  await expect(panel).toContainText("Venta tiene 0 métodos")
  await expect(panel).toContainText("Explícame Venta")
})

test("P5-09 CU12 no modifica el modelo ni la revisión", async ({ page }) => {
  await crearProyectoE2E(page, "P5-09", "Renato")
  await crearClaseNombradaE2E(page, "Venta")
  const acceso = await accesoActual(page)
  const revisionAntes = await page.evaluate(async ({ projectId, credential }) => (await (await fetch(`/api/proyectos/${projectId}`, { headers: { Authorization: `Bearer ${credential}` } })).json()).revisionModelo, acceso)
  const panel = await preguntar(page, "Agrega total Double a Venta")
  await expect(panel).toContainText("no modifica el UML")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Venta" })).not.toContainText("total")
  const revisionDespues = await page.evaluate(async ({ projectId, credential }) => (await (await fetch(`/api/proyectos/${projectId}`, { headers: { Authorization: `Bearer ${credential}` } })).json()).revisionModelo, acceso)
  expect(revisionDespues).toBe(revisionAntes)
})

test("P5-10 conversación aislada por proyecto", async ({ browser }) => {
  const contextoA = await browser.newContext(); const contextoB = await browser.newContext()
  const a = await contextoA.newPage(); const b = await contextoB.newPage()
  try {
    await crearProyectoE2E(a, "P5-10-A", "Renato"); await preguntar(a, "¿Cómo exporto XMI?")
    const accesoA = await accesoActual(a)
    await crearProyectoE2E(b, "P5-10-B", "Ana"); const accesoB = await accesoActual(b)
    const estados = await b.evaluate(async ({ projectId, credential }) => {
      const headers = { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }
      const get = await fetch(`/api/proyectos/${projectId}/mensajes`, { headers })
      const post = await fetch(`/api/proyectos/${projectId}/asistente-colaborativo/preguntar`, { method: "POST", headers,
        body: JSON.stringify({ requestId: crypto.randomUUID(), contenido: "intrusión" }) })
      return [get.status, post.status]
    }, { projectId: accesoA.projectId, credential: accesoB.credential })
    expect(estados).toEqual([403, 403])
    await expect(await abrirPanel(b)).not.toContainText("¿Cómo exporto XMI?")
  } finally { await contextoA.close(); await contextoB.close() }
})

test("P5-11 conversación sobrevive a cero usuarios y reapertura", async ({ browser }) => {
  const primero = await browser.newContext(); const renato = await primero.newPage()
  const nombre = await crearProyectoE2E(renato, "P5-11", "Renato")
  await preguntar(renato, "¿Cómo exporto XMI?"); await primero.close()
  const segundo = await browser.newContext(); const reabierto = await segundo.newPage()
  try {
    await abrirProyectoE2E(reabierto, nombre, "Renato nuevo dispositivo")
    await expect(await abrirPanel(reabierto)).toContainText("modelo.xmi")
  } finally { await segundo.close() }
})
