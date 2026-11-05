import { expect, type Page } from "@playwright/test"

const codigosPorProyecto = new Map<string, string>()

export function obtenerCodigoProyectoE2E(nombre: string): string {
  const codigo = codigosPorProyecto.get(nombre)
  if (!codigo) throw new Error(`No se capturó el código E2E de ${nombre}.`)
  return codigo
}

export async function crearProyectoE2E(page: Page, prefijo = "Proyecto E2E", participante = "Renato E2E"): Promise<string> {
  const nombre = `${prefijo} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Proyectos recientes" })).toBeVisible()
  await page.getByRole("button", { name: "Crear proyecto" }).click()
  await page.getByLabel("Nombre del proyecto").fill(nombre)
  await page.getByLabel("Tu nombre o apodo").fill(participante)
  await page.getByRole("button", { name: "Crear proyecto" }).click()
  const salidaCodigo = page.locator(".project-access-code")
  await expect(salidaCodigo).toHaveText(/^NX-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/)
  const codigo = (await salidaCodigo.textContent())?.trim()
  if (!codigo) throw new Error("El backend no devolvió código de proyecto.")
  codigosPorProyecto.set(nombre, codigo)
  await page.getByRole("button", { name: "Copiar código" }).click()
  await expect(page.getByText(/Código copiado|cópialo manualmente/)).toBeVisible()
  await page.getByRole("button", { name: "Entrar al proyecto" }).click()
  await expect(page.locator(".react-flow")).toBeVisible()
  return nombre
}

export async function abrirProyectoE2E(page: Page, nombre: string, participante = "Carlos E2E"): Promise<void> {
  await page.goto("/")
  const reciente = page.locator(".project-list li").filter({ hasText: nombre })
  if (await reciente.count()) {
    await reciente.getByRole("button", { name: "Abrir" }).click()
  } else {
    await page.getByRole("button", { name: "Unirse con código" }).click()
    await page.getByLabel("Código del proyecto").fill(obtenerCodigoProyectoE2E(nombre))
    await page.getByLabel("Tu nombre o apodo").fill(participante)
    await page.getByRole("button", { name: "Entrar al proyecto" }).click()
  }
  await expect(page.locator(".react-flow")).toBeVisible()
}

export async function crearClaseNombradaE2E(page: Page, nombre: string, desplazamientoX = 0): Promise<void> {
  const inspector = page.getByTestId("inspector-propiedades")
  const nuevaClase = inspector.getByRole("group", { name: "Nueva clase" })
  void desplazamientoX
  await nuevaClase.getByLabel("Nombre de clase").fill(nombre)
  await nuevaClase.getByRole("button", { name: "Crear clase" }).click()
  const nodo = page.locator(".react-flow__node").filter({ hasText: nombre })
  await expect(nodo).toBeVisible()
  await nodo.click()
}
