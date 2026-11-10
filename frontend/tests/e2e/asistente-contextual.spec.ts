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

test("P6-12 pregunta histórica permanece consultiva y atribuye Venta a Carlos", async ({ browser }) => {
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

test("P6-01 solicitud explícita aplica una vez sin avanzar revisión durable", async ({ page }) => {
  await crearProyectoE2E(page, "P5-09", "Renato")
  await crearClaseNombradaE2E(page, "Venta")
  const acceso = await accesoActual(page)
  const revisionAntes = await page.evaluate(async ({ projectId, credential }) => (await (await fetch(`/api/proyectos/${projectId}`, { headers: { Authorization: `Bearer ${credential}` } })).json()).revisionModelo, acceso)
  const panel = await preguntar(page, "Agrega total Double a Venta")
  await expect(panel).toContainText("Se agregó total")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Venta" })).toContainText("total")
  const revisionDespues = await page.evaluate(async ({ projectId, credential }) => (await (await fetch(`/api/proyectos/${projectId}`, { headers: { Authorization: `Bearer ${credential}` } })).json()).revisionModelo, acceso)
  expect(revisionDespues).toBe(revisionAntes)
})

test("P6-13 acción y conversación permanecen aisladas por proyecto", async ({ browser }) => {
  const contextoA = await browser.newContext(); const contextoB = await browser.newContext()
  const a = await contextoA.newPage(); const b = await contextoB.newPage()
  try {
    await crearProyectoE2E(a, "P5-10-A", "Renato"); await preguntar(a, "¿Cómo exporto XMI?")
    const accesoA = await accesoActual(a)
    await crearProyectoE2E(b, "P5-10-B", "Ana"); const accesoB = await accesoActual(b)
    const estados = await b.evaluate(async ({ projectId, credential }) => {
      const headers = { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }
      const get = await fetch(`/api/proyectos/${projectId}/mensajes`, { headers })
      const post = await fetch(`/api/proyectos/${projectId}/asistente-colaborativo/interactuar`, { method: "POST", headers,
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

test("P6-02 accion contextual resuelve la recomendacion del mismo participante", async ({ page }) => {
  await crearProyectoE2E(page, "P6-02", "Renato")
  await crearClaseNombradaE2E(page, "Venta")
  const panel = await preguntar(page, "¿Qué problema tiene Venta?")
  await expect(panel).toContainText("recomiendo agregar el atributo total")
  await preguntar(page, "Corrígelo.")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Venta" })).toContainText("total")
  await expect(panel).toContainText("Se agregó total")
})

test("P6-03 accion contextual ambigua aclara y no modifica", async ({ page }) => {
  await crearProyectoE2E(page, "P6-03", "Renato")
  await crearClaseNombradaE2E(page, "Venta")
  const elementos = page.locator(".react-flow__node, .react-flow__edge")
  const umlAntes = await elementos.allTextContents()
  const peticionesCU04: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/modelado-ia/")) peticionesCU04.push(request.url())
  })
  const respuestaPendiente = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith("/asistente-colaborativo/interactuar"))
  const panel = await preguntar(page, "Corrígelo.")
  const respuesta = await respuestaPendiente
  expect(respuesta.ok()).toBeTruthy()
  expect(await respuesta.json()).toMatchObject({ kind: "clarification" })
  await expect(panel.locator(".assistant-action-status[role='status']")).toBeVisible()
  await expect(elementos).toHaveText(umlAntes)
  expect(peticionesCU04).toEqual([])
})

test("P6-04 borrado contextual ambiguo no elimina", async ({ page }) => {
  await crearProyectoE2E(page, "P6-04", "Renato")
  await crearClaseNombradaE2E(page, "Venta"); await crearClaseNombradaE2E(page, "Cliente")
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } })
  const panel = await preguntar(page, "Bórralo.")
  await expect(panel).toContainText("No puedo determinar de forma inequivoca")
  await expect(page.getByText("Venta", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()
})

test("P6-05 borrado explicito elimina solo el elemento nombrado", async ({ page }) => {
  await crearProyectoE2E(page, "P6-05", "Renato")
  await crearClaseNombradaE2E(page, "Venta"); await crearClaseNombradaE2E(page, "Cliente")
  await preguntar(page, "Elimina la clase Venta.")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Venta" })).toHaveCount(0)
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible()
})

test("P6-06 solo Renato ejecuta y Carlos observa el resultado por Yjs", async ({ browser }) => {
  const equipo = await dosParticipantes(browser, "P6-06")
  try {
    await crearClaseNombradaE2E(equipo.renato, "Venta")
    await expect(equipo.carlos.getByText("Venta", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await abrirPanel(equipo.carlos)
    await preguntar(equipo.renato, "Agrega total Double a Venta.")
    await expect(equipo.renato.locator(".react-flow__node").filter({ hasText: "Venta" })).toContainText("total")
    await expect(equipo.carlos.locator(".react-flow__node").filter({ hasText: "Venta" })).toContainText("total", { timeout: 15_000 })
    await expect(equipo.carlos.getByTestId("panel-asistente-colaborativo")).toContainText("Se agregó total")
  } finally { await equipo.contextoRenato.close(); await equipo.contextoCarlos.close() }
})

test("P6-07 reintento y confirmacion duplicada conservan una sola accion durable", async ({ page }) => {
  await crearProyectoE2E(page, "P6-07", "Renato"); const acceso = await accesoActual(page)
  const resultado = await page.evaluate(async ({ projectId, credential }) => {
    const requestId = crypto.randomUUID(); const headers = { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }
    const modelo = { id: "m", nombre: "Ventas", version: "1", clases: [{ id: "venta", nombre: "Venta", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }], relaciones: [] }
    const cuerpo = { requestId, instruccion: "Agrega total Double a Venta", modelo, revision: 1 }
    const backend = "http://127.0.0.1:3001"
    const primero = await (await fetch(`${backend}/api/proyectos/${projectId}/modelado-ia/interpretar`, { method: "POST", headers, body: JSON.stringify(cuerpo) })).json()
    const segundo = await (await fetch(`${backend}/api/proyectos/${projectId}/modelado-ia/interpretar`, { method: "POST", headers, body: JSON.stringify(cuerpo) })).json()
    const cambio = { commandIndex: 0, tipo: "UML_ELEMENT_CREATED", elemento: { id: "total-e2e", tipo: "attribute", nombreSnapshot: "total" } }
    const ruta = `${backend}/api/proyectos/${projectId}/modelado-ia/acciones/${primero.actionId}/completar`
    const cierre1 = await (await fetch(ruta, { method: "POST", headers, body: JSON.stringify({ resultado: "applied", cambios: [cambio] }) })).json()
    const cierre2 = await (await fetch(ruta, { method: "POST", headers, body: JSON.stringify({ resultado: "applied", cambios: [cambio] }) })).json()
    const eventos = await (await fetch(`${backend}/api/proyectos/${projectId}/actividad?limite=100`, { headers })).json()
    return { primero: primero.actionId, segundo: segundo.actionId, cierre1: cierre1.kind, cierre2: cierre2.kind,
      cantidad: eventos.items.filter((evento: { mecanismo: string; detalle: { actionId?: string } }) => evento.mecanismo === "ai_cu04" && evento.detalle.actionId === primero.actionId).length }
  }, acceso)
  expect(resultado).toEqual(expect.objectContaining({ primero: resultado.segundo, cierre1: "action_applied", cierre2: "action_already_applied", cantidad: 1 }))
})

test("P6-08 un plan obsoleto no se aplica ciegamente", async ({ page }) => {
  await crearProyectoE2E(page, "P6-08", "Renato"); await crearClaseNombradaE2E(page, "Venta")
  let liberar!: () => void; const espera = new Promise<void>((resolver) => { liberar = resolver }); let primera = true
  await page.route("**/asistente-colaborativo/interactuar", async (route) => {
    const respuesta = await route.fetch()
    if (primera) { primera = false; await espera }
    await route.fulfill({ response: respuesta })
  })
  const panel = await abrirPanel(page)
  await panel.getByLabel("Pregunta al asistente colaborativo").fill("Agrega total Double a Venta.")
  await panel.getByRole("button", { name: "Enviar", exact: true }).click()
  const nuevaClase = page.getByTestId("inspector-propiedades").getByRole("group", { name: "Nueva clase" })
  await nuevaClase.getByLabel("Nombre de clase").fill("CambioConcurrente")
  await nuevaClase.getByRole("button", { name: "Crear clase" }).click()
  await expect(page.locator(".react-flow__node").filter({ hasText: "CambioConcurrente" })).toBeVisible()
  liberar()
  await expect(panel.getByRole("alert")).toContainText("modelo cambio", { timeout: 15_000 })
  await expect(page.locator(".react-flow__node").filter({ hasText: "Venta" })).not.toContainText("total")
  await page.unroute("**/asistente-colaborativo/interactuar")
})

test("P6-09 mensajes intercalados conservan el foco de Renato", async ({ browser }) => {
  const equipo = await dosParticipantes(browser, "P6-09")
  try {
    await crearClaseNombradaE2E(equipo.renato, "Venta"); await crearClaseNombradaE2E(equipo.renato, "Cliente")
    const panelRenato = await preguntar(equipo.renato, "Revisa Venta."); await expect(panelRenato).toContainText("total: Double a Venta")
    const panelCarlos = await preguntar(equipo.carlos, "Revisa Cliente."); await expect(panelCarlos).toContainText("total: Double a Cliente")
    await preguntar(equipo.renato, "Hazlo.")
    await expect(equipo.renato.locator(".react-flow__node").filter({ hasText: "Venta" })).toContainText("total")
    await expect(equipo.renato.locator(".react-flow__node").filter({ hasText: "Cliente" })).not.toContainText("total")
  } finally { await equipo.contextoRenato.close(); await equipo.contextoCarlos.close() }
})

test("P6-11 revisar recomienda pero nunca actua sin segunda solicitud humana", async ({ page }) => {
  await crearProyectoE2E(page, "P6-11", "Renato"); await crearClaseNombradaE2E(page, "Venta")
  const panel = await preguntar(page, "Revisa Venta.")
  await expect(panel).toContainText("recomiendo agregar")
  await expect(page.locator(".react-flow__node").filter({ hasText: "Venta" })).not.toContainText("total")
})
