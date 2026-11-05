import { expect, test, type Page } from "@playwright/test"
import { abrirProyectoE2E, crearClaseNombradaE2E, crearProyectoE2E } from "./ayudas/proyectos"

interface AccesoLocal { projectId: string; participantId: string; displayName: string; credential: string }
interface EventoActividad {
  tipo: string
  solicitadoPorParticipantId: string
  nombreParticipanteSnapshot: string
  revisionModeloObservada: number
  elemento: { id: string; tipo: string; nombreSnapshot: string } | null
}

async function accesoActual(page: Page): Promise<AccesoLocal> {
  return page.evaluate(() => {
    const esquema = JSON.parse(localStorage.getItem("nexocase.proyectosRecientes.v1") ?? "{}") as { proyectos?: AccesoLocal[] }
    const acceso = esquema.proyectos?.[0]
    if (!acceso) throw new Error("No existe acceso reciente E2E")
    return acceso
  })
}

async function consultar(page: Page, acceso: AccesoLocal): Promise<{ estado: number; items: EventoActividad[] }> {
  return page.evaluate(async ({ projectId, credential }) => {
    const respuesta = await fetch(`/api/proyectos/${projectId}/actividad?limite=100`, { headers: { Authorization: `Bearer ${credential}` } })
    const cuerpo = await respuesta.json().catch(() => ({ items: [] })) as { items?: EventoActividad[] }
    return { estado: respuesta.status, items: cuerpo.items ?? [] }
  }, acceso)
}

test("F1/F3: autoría local sin duplicar propagación Yjs y guardado con nueva revisión", async ({ browser }) => {
  const contextoRenato = await browser.newContext()
  const contextoCarlos = await browser.newContext()
  const renato = await contextoRenato.newPage()
  const carlos = await contextoCarlos.newPage()
  try {
    const nombre = await crearProyectoE2E(renato, "Trazabilidad", "Renato")
    await abrirProyectoE2E(carlos, nombre, "Carlos")
    const accesoRenato = await accesoActual(renato)
    const accesoCarlos = await accesoActual(carlos)

    await crearClaseNombradaE2E(renato, "Venta")
    await expect(carlos.getByText("Venta", { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await carlos.locator(".react-flow__node").filter({ hasText: "Venta" }).click()
    const nombreClase = carlos.getByTestId("inspector-propiedades").getByLabel("Nombre de la clase seleccionada")
    await nombreClase.fill("VentaActualizada")
    await nombreClase.press("Enter")
    await expect(renato.getByText("VentaActualizada", { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    await expect.poll(async () => (await consultar(renato, accesoRenato)).items.filter((evento) => evento.tipo.startsWith("UML_ELEMENT_"))).toHaveLength(2)
    const manuales = (await consultar(renato, accesoRenato)).items.filter((evento) => evento.tipo.startsWith("UML_ELEMENT_"))
    expect(manuales.filter((evento) => evento.tipo === "UML_ELEMENT_CREATED")).toEqual([
      expect.objectContaining({ solicitadoPorParticipantId: accesoRenato.participantId, nombreParticipanteSnapshot: "Renato", elemento: expect.objectContaining({ tipo: "class", nombreSnapshot: "Venta" }) }),
    ])
    expect(manuales.filter((evento) => evento.tipo === "UML_ELEMENT_UPDATED")).toEqual([
      expect.objectContaining({ solicitadoPorParticipantId: accesoCarlos.participantId, nombreParticipanteSnapshot: "Carlos", elemento: expect.objectContaining({ tipo: "class", nombreSnapshot: "VentaActualizada" }) }),
    ])

    await renato.getByRole("button", { name: "Guardar" }).click()
    await expect(renato.getByText("Proyecto guardado correctamente.")).toBeVisible()
    await expect.poll(async () => (await consultar(renato, accesoRenato)).items.filter((evento) => evento.tipo === "MODEL_SAVED")).toHaveLength(1)
    expect((await consultar(renato, accesoRenato)).items.find((evento) => evento.tipo === "MODEL_SAVED")).toMatchObject({
      solicitadoPorParticipantId: accesoRenato.participantId, revisionModeloObservada: 1,
    })
  } finally {
    await contextoRenato.close(); await contextoCarlos.close()
  }
})

test("F2: una credencial de otro proyecto no puede consultar actividad", async ({ browser }) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()
  try {
    await crearProyectoE2E(paginaA, "Proyecto actividad A", "Renato")
    const accesoA = await accesoActual(paginaA)
    await crearClaseNombradaE2E(paginaA, "Venta")
    await crearProyectoE2E(paginaB, "Proyecto actividad B", "Ana")
    const accesoB = await accesoActual(paginaB)
    const intento = await paginaB.evaluate(async ({ projectId, credential }) => {
      const respuesta = await fetch(`/api/proyectos/${projectId}/actividad`, { headers: { Authorization: `Bearer ${credential}` } })
      return respuesta.status
    }, { projectId: accesoA.projectId, credential: accesoB.credential })
    expect(intento).toBe(403)
    expect((await consultar(paginaB, accesoB)).items.every((evento) => evento.elemento?.nombreSnapshot !== "Venta")).toBe(true)
  } finally {
    await contextoA.close(); await contextoB.close()
  }
})
