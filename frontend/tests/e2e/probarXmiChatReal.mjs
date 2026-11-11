import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile } from "node:fs/promises"
import { basename, join, resolve, win32 } from "node:path"
import { lookup } from "node:dns/promises"
import { chromium, request, expect } from "@playwright/test"

// Aceptación focalizada contra la app real, sin el runner que prepara/limpia datos E2E.
// Crea SOLO un proyecto nuevo, contextos aislados y un directorio nuevo de descarga.
// No borra evidencia, no guarda credenciales en archivos, no invoca IA.
if (!process.env.CHROME_CDP_URL || !process.env.F8_HOST_WORKSPACE) throw new Error("Se requieren CHROME_CDP_URL y F8_HOST_WORKSPACE para el navegador Windows existente.")
const cdp = new URL(process.env.CHROME_CDP_URL)
cdp.hostname = (await lookup(cdp.hostname)).address
const browser = await chromium.connectOverCDP(cdp.toString())
const api = await request.newContext({ baseURL: "http://backend:3001" })
const contextos = []
const paginas = []
let fase = "crear proyecto aislado"
const nombre = `S2.1 XMI ${Date.now()}`
try {
  const creado = await api.post("/api/proyectos", { data: { nombre, nombreParticipante: "Diseñador S21 A" } })
  assert.equal(creado.status(), 201)
  const a = await creado.json()
  const fixture = { id: "EAPK_S21_BROWSER", nombre: "Prueba XMI navegador", version: "4.2.0", clases: [
    { id: "EAID_S21_CLIENTE", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [{ id: "EAID_S21_NOMBRE", nombre: "nombre", tipo: "String" }] },
    { id: "EAID_S21_PEDIDO", nombre: "Pedido", abstracta: false, posicion: { x: 450, y: 100 }, atributos: [{ id: "EAID_S21_FECHA", nombre: "fecha", tipo: "LocalDate" }] },
  ], relaciones: [{ id: "EAID_S21_REL", tipo: "asociacion", claseOrigenId: "EAID_S21_CLIENTE", claseDestinoId: "EAID_S21_PEDIDO", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "cliente", rolDestino: "pedidos" }] }
  const authA = { Authorization: `Bearer ${a.credencial}` }
  // Guardado explícito solo de la semilla en el proyecto recién creado.
  assert.equal((await api.put(`/api/proyectos/${a.proyecto.id}/modelo`, { headers: authA, data: { modelo: fixture, revisionBase: 0 } })).status(), 200)
  const unido = await api.post("/api/proyectos/unirse", { data: { codigoAcceso: a.codigoAcceso, nombreParticipante: "Diseñador S21 B" } })
  assert.equal(unido.status(), 200)
  const b = await unido.json()
  async function abrir(acceso) {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    contextos.push(contexto)
    await contexto.addInitScript((datos) => {
      localStorage.setItem("sw1.idioma", "es")
      localStorage.setItem("nexocase.proyectosRecientes.v1", JSON.stringify({ version: 1, proyectos: [{ projectId: datos.proyecto.id, projectName: datos.proyecto.nombre,
        participantId: datos.participante.id, displayName: datos.participante.nombreVisible, credential: datos.credencial, lastOpenedAt: new Date().toISOString() }] }))
    }, acceso)
    const page = await contexto.newPage()
    paginas.push(page)
    await page.goto("http://127.0.0.1:5173")
    await page.getByRole("button", { name: "Abrir", exact: true }).click()
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeVisible({ timeout: 30_000 })
    return page
  }
  fase = "abrir los dos participantes"
  const pA = await abrir(a); const pB = await abrir(b)
  await expect(pA.getByRole("list", { name: "Participantes conectados" })).toContainText("Diseñador S21 B", { timeout: 20_000 })
  await expect(pB.getByRole("list", { name: "Participantes conectados" })).toContainText("Diseñador S21 A")
  const chatA = pA.getByTestId("panel-asistente-colaborativo")
  const chatB = pB.getByTestId("panel-asistente-colaborativo")
  async function mostrarChat(page, chat) {
    if (!await chat.isVisible()) await page.getByRole("button", { name: "Asistente", exact: true }).click()
    await expect(chat).toBeVisible()
  }
  await mostrarChat(pA, chatA); await mostrarChat(pB, chatB)
  fase = "exportar desde el asistente"
  await chatA.getByRole("textbox").fill("Exporta mi modelo a XMI")
  await chatA.getByRole("button", { name: "Enviar", exact: true }).click()
  const descargar = chatA.getByRole("button", { name: "↓ modelo.xmi", exact: true })
  await expect(descargar).toBeVisible({ timeout: 60_000 })
  await expect(chatA.locator(".assistant-workflow-card").last().locator(".mapping-warnings")).toContainText("no garantiza interoperabilidad universal")
  await expect(chatB.getByRole("button", { name: "↓ modelo.xmi", exact: true })).toHaveCount(0)
  fase = "descarga real en Chrome"
  const padre = resolve("test-results")
  await mkdir(padre, { recursive: true })
  const carpeta = await mkdtemp(join(padre, "xmi-s21-"))
  const carpetaWindows = win32.join(process.env.F8_HOST_WORKSPACE, "frontend", "test-results", basename(carpeta))
  const sesion = await pA.context().newCDPSession(pA)
  const { targetInfo } = await sesion.send("Target.getTargetInfo")
  await sesion.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: carpetaWindows, browserContextId: targetInfo.browserContextId, eventsEnabled: true })
  const evento = pA.waitForEvent("download")
  await descargar.click()
  assert.equal((await evento).suggestedFilename(), "modelo.xmi")
  const archivo = join(carpeta, "modelo.xmi")
  await expect.poll(async () => readFile(archivo, "utf8").then((x) => x.includes("</xmi:XMI>"), () => false), { timeout: 30_000 }).toBe(true)
  const xml = await readFile(archivo, "utf8")
  const parseado = await api.post("/api/interoperabilidad/xmi/importar", { headers: { "Content-Type": "application/xml" }, data: xml })
  assert.equal(parseado.status(), 200)
  const datos = await parseado.json()
  assert.deepEqual(datos.modelo.clases.map((c) => c.nombre).sort(), ["Cliente", "Pedido"])
  assert.equal(datos.modelo.relaciones.length, 1)
  assert.equal(datos.modelo.relaciones[0].multiplicidadDestino, "0..*")
  fase = "revisión y cancelación del reemplazo"
  const cambiado = xml.replaceAll('name="Cliente"', 'name="ClienteS21"').replace("</packagedElement>", '<ownedOperation xmi:type="uml:Operation" xmi:id="OP_S21_BROWSER" name="fueraDelPerfil"/></packagedElement>')
  async function adjuntar() {
    await chatA.locator('input[type="file"]').setInputFiles({ name: "roundtrip.xmi", mimeType: "application/xml", buffer: Buffer.from(cambiado) })
    await chatA.getByRole("textbox").fill("Importa este XMI")
    await chatA.getByRole("button", { name: "Enviar", exact: true }).click()
    const tarjeta = chatA.locator(".assistant-workflow-card").last()
    await expect(tarjeta.getByRole("button", { name: "Confirmar reemplazo del modelo" })).toBeVisible({ timeout: 60_000 })
    await expect(tarjeta.locator(".mapping-warnings")).toContainText("métodos UML fueron omitidos")
    return tarjeta
  }
  const cancelada = await adjuntar()
  await cancelada.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(cancelada.getByRole("status")).toContainText("descartada")
  await expect(pA.getByTestId("inspector-propiedades").getByText("ClienteS21", { exact: true })).toHaveCount(0)
  fase = "confirmación y convergencia Yjs"
  const confirmada = await adjuntar()
  await confirmada.getByRole("button", { name: "Confirmar reemplazo del modelo" }).click()
  await expect(confirmada.getByRole("status")).toContainText("aplicada", { timeout: 30_000 })
  // Diagnóstico del modelo vivo en ambas páginas, sin recargar ni reabrir.
  async function canonico(page) {
    const diagnostico = page.locator("details.technical-diagnostics")
    if (!await diagnostico.evaluate((n) => n.open)) await diagnostico.locator("summary").first().click()
    const json = page.locator(".canonical-json")
    if (!await json.locator("pre").isVisible()) await json.locator("summary").click()
    return json.locator("pre")
  }
  for (const page of [pA, pB]) {
    await expect(await canonico(page)).toContainText('"nombre": "ClienteS21"', { timeout: 20_000 })
    await expect(await canonico(page)).toContainText('"multiplicidadDestino": "0..*"')
  }
  const durable = await api.get(`/api/proyectos/${a.proyecto.id}`, { headers: authA })
  const snapshot = await durable.json()
  assert.equal(snapshot.revisionModelo, 1)
  assert.ok(snapshot.modelo.clases.some((c) => c.nombre === "Cliente"))
  assert.ok(!snapshot.modelo.clases.some((c) => c.nombre === "ClienteS21"))
  console.log(JSON.stringify({ estado: "verificado", proyecto: nombre, navegador: browser.version(), descargaReal: true, archivo: `frontend/test-results/${basename(carpeta)}/modelo.xmi`, reimportacionDescarga: true, advertenciasVisibles: true, confirmacionRechazada: true, confirmacionAplicada: true, dosParticipantesYjsSinRecargar: true, sinGuardadoAutomatico: true, eaVerificado: false }))
} catch (error) {
  console.error(JSON.stringify({ estado: "fallido", fase, motivo: error.message, controles: paginas[0] ? await paginas[0].getByRole("button").allTextContents() : [] }))
  process.exitCode = 1
} finally {
  for (const contexto of contextos) await contexto.close()
  await api.dispose(); await browser.close()
}
