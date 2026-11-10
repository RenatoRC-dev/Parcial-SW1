import { useEffect, useState } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { UMLModel } from "@tumaet/apollon"
import { PaginaModeladoClases, PanelResumenValidacion } from "./PaginaModeladoClases"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { evaluarAptitudGeneracionSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/EvaluadorAptitudGeneracionSpring"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { ProveedorPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

const { montajes } = vi.hoisted(() => ({ montajes: {} as Record<string, number> }))
function EstadoPersistente({ nombre }: { nombre: string }) {
  const [valor, establecerValor] = useState("")
  useEffect(() => { montajes[nombre] = (montajes[nombre] ?? 0) + 1 }, [nombre])
  return <input aria-label={nombre} value={valor} onChange={(evento) => establecerValor(evento.target.value)} />
}
vi.mock("./componentes/AnfitrionEditorApollon", () => ({
  AnfitrionEditorApollon: ({ alCambiarModelo, modeloParaReemplazar }: { alCambiarModelo: (modelo: UMLModel) => void; modeloParaReemplazar: UMLModel }) => {
    useEffect(() => { alCambiarModelo(modeloParaReemplazar) }, [alCambiarModelo, modeloParaReemplazar])
    return <EstadoPersistente nombre="editor-estado" />
  },
}))
vi.mock("./componentes/InspectorPropiedadesUML", () => ({ InspectorPropiedadesUML: () => <EstadoPersistente nombre="propiedades-borrador" /> }))
vi.mock("../../../asistencia_contextual/casos_uso/cu12_asistir_usuario/PanelAsistenteContextual", () => ({ PanelAsistenteContextual: () => <EstadoPersistente nombre="chat-borrador" /> }))
vi.mock("../../../colaboracion/casos_uso/cu03_colaborar_modelo/PanelColaboracion", () => ({ PanelColaboracion: () => <EstadoPersistente nombre="colaboracion-estado" /> }))

function mostrar(alCambiarModeloCanonico = vi.fn()) {
  return render(<PaginaModeladoClases proyectoId="p" accesoColaboracion={{ projectId: "p", participantId: "u", displayName: "Persona", credential: "prueba" }}
    modeloInicial={{ id: "m", nombre: "Modelo", version: "1", clases: [{ id: "prestamo", nombre: "Prestamo", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [{ id: "estado", nombre: "estado", tipo: "String" }] }], relaciones: [] }} cambiosSinGuardar alCambiarModeloCanonico={alCambiarModeloCanonico} />)
}
function redimensionar(ancho: number) {
  act(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: ancho }); window.dispatchEvent(new Event("resize")) })
}
const panel = (id: string) => document.getElementById(id)!

describe("F8-UX01 estructura de modelado", () => {
  beforeEach(() => {
    redimensionar(1600)
    Object.keys(montajes).forEach((clave) => delete montajes[clave])
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it("UX04 navega por cinco vistas centrales sin desmontar editor, chat o borradores", () => {
    const informar = vi.fn(); mostrar(informar)
    const publicaciones = informar.mock.calls.length
    const editor = screen.getByLabelText("editor-estado")
    const chat = screen.getByLabelText("chat-borrador")
    fireEvent.change(editor, { target: { value: "zoom/selección simulados" } })
    fireEvent.change(chat, { target: { value: "Borrador" } })
    const principal = document.getElementById("workspace-main")!
    for (const [nombre, prueba] of [["Desde imagen", "panel-modelado-imagen"], ["Validación", "panel-validacion-producto"], ["XMI", null], ["Generar", "panel-generacion"]] as const) {
      fireEvent.click(screen.getByRole("button", { name: nombre }))
      expect(screen.getByRole("button", { name: nombre })).toHaveAttribute("aria-current", "page")
      expect(editor).not.toBeVisible(); expect(chat).toBeVisible()
      if (prueba) expect(within(principal).getByTestId(prueba)).toBeVisible()
      else expect(within(principal).getByRole("heading", { name: "Interoperabilidad XMI" })).toBeVisible()
      expect(panel("workspace-properties")).toBeVisible()
    }
    fireEvent.click(screen.getByRole("button", { name: "Modelo" }))
    expect(editor).toBeVisible(); expect(editor).toHaveValue("zoom/selección simulados")
    expect(chat).toHaveValue("Borrador")
    expect(Object.values(montajes)).toEqual([1, 1, 1, 1])
    expect(informar).toHaveBeenCalledTimes(publicaciones)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("UX04 separa UML válido y Spring bloqueado con nombres de elementos reales", () => {
    const conceptual: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", relaciones: [], clases: [{ id: "p", nombre: "Prestamo", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [{ id: "e", nombre: "estado", tipo: "Money" }] }] }
    const resultado = validarModelo(conceptual)
    const aptitud = evaluarAptitudGeneracionSpring(conceptual, resultado)
    render(<PanelResumenValidacion resultado={resultado} modelo={conceptual} aptitud={aptitud} />)
    expect(screen.getByText("Modelo válido")).toBeVisible()
    expect(screen.getByText("No apto")).toBeVisible()
    expect(screen.getByText(/Tipo no soportado para Prestamo.estado/)).toBeInTheDocument()
    expect(screen.getByText(/Motivos que bloquean/).closest("details")!.textContent).toContain(aptitud.motivos[0])
  })

  it("UX04 mantiene el modo foco y paneles cerrados al cambiar de vista", () => {
    mostrar()
    fireEvent.click(screen.getByRole("button", { name: "Modo foco" }))
    fireEvent.click(screen.getByRole("button", { name: "XMI" }))
    expect(panel("workspace-tools")).not.toBeVisible(); expect(panel("workspace-properties")).not.toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Restaurar paneles" }))
    expect(panel("workspace-tools")).toBeVisible(); expect(panel("workspace-properties")).toBeVisible()
    expect(screen.getByRole("button", { name: "XMI" })).toHaveAttribute("aria-current", "page")
  })

  it("UX04 muestra diagnóstico UML con el elemento identificado por ID existente", () => {
    const duplicado: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", relaciones: [], clases: [{ id: "p", nombre: "Prestamo", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [{ id: "e", nombre: "estado", tipo: "String" }, { id: "e2", nombre: "estado", tipo: "String" }] }] }
    const resultado = validarModelo(duplicado)
    render(<PanelResumenValidacion resultado={resultado} modelo={duplicado} aptitud={evaluarAptitudGeneracionSpring(duplicado, resultado)} />)
    expect(screen.getByText("Modelo con errores")).toBeVisible()
    const errores = screen.getByRole("region", { name: "Errores" })
    expect(within(errores).getByText("Prestamo.estado")).toBeVisible()
    expect(errores.textContent).toContain("duplicados")
  })

  it("UX03 permite ajustar ancho sin remontar ni cerrar ninguno de los paneles", () => {
    const informar = vi.fn(); mostrar(informar)
    const publicaciones = informar.mock.calls.length
    fireEvent.change(screen.getByRole("slider", { name: "Ancho del asistente" }), { target: { value: "480" } })
    expect(screen.getByRole("slider")).toHaveValue("480")
    expect(document.querySelector(".modeling-workspace")).toHaveStyle({ "--assistant-preferred-width": "480px" })
    fireEvent.click(screen.getByRole("button", { name: "Modo foco" }))
    fireEvent.click(screen.getByRole("button", { name: "Restaurar paneles" }))
    expect(panel("workspace-tools")).toBeVisible(); expect(panel("workspace-properties")).toBeVisible()
    expect(screen.getByRole("slider")).toHaveValue("480")
    expect(informar).toHaveBeenCalledTimes(publicaciones)
    expect(Object.values(montajes)).toEqual([1, 1, 1, 1])
  })

  it("UX02 conserva las cinco entradas sin duplicar asistente ni formulario CU04", () => {
    mostrar()
    for (const nombre of ["Modelo", "Desde imagen", "Validación", "XMI", "Generar"]) expect(screen.getByRole("button", { name: nombre })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Asistente IA" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Instrucción UML")).not.toBeInTheDocument()
    expect(screen.getAllByLabelText("chat-borrador")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Desde imagen" }))
    expect(screen.getByLabelText("chat-borrador")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    expect(panel("workspace-tools")).not.toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    expect(screen.getByLabelText("chat-borrador")).toBeVisible()
    expect(panel("workspace-properties")).toBeVisible()
  })

  it.each([1600, 1200, 960, 800, 390])("soporta las cuatro combinaciones independientes a %i px", (ancho) => {
    redimensionar(ancho)
    const { container } = mostrar()
    const asistente = screen.getByRole("button", { name: "Asistente" })
    const propiedades = screen.getByRole("button", { name: "Propiedades UML" })
    expect(asistente).toHaveAttribute("aria-controls", "workspace-tools")
    expect(propiedades).toHaveAttribute("aria-controls", "workspace-properties")
    if (asistente.getAttribute("aria-expanded") === "false") fireEvent.click(asistente)
    if (propiedades.getAttribute("aria-expanded") === "false") fireEvent.click(propiedades)
    expect(panel("workspace-tools")).toBeVisible()
    expect(panel("workspace-properties")).toBeVisible()
    expect(container.querySelector(".modeling-workspace")).toHaveClass("has-tool-panel", "has-inspector-panel")
    fireEvent.click(asistente)
    expect(panel("workspace-tools")).not.toBeVisible()
    expect(panel("workspace-properties")).toBeVisible()
    fireEvent.click(propiedades)
    expect(container.querySelector(".modeling-workspace")).toHaveAttribute("data-focus-mode", "true")
    fireEvent.click(asistente)
    expect(panel("workspace-tools")).toBeVisible()
    expect(panel("workspace-properties")).not.toBeVisible()
    fireEvent.click(propiedades)
    expect(asistente).toHaveAttribute("aria-expanded", "true")
    expect(propiedades).toHaveAttribute("aria-expanded", "true")
  })

  it("no remonta editor, chat, propiedades o colaboración al cerrar, cambiar herramienta o redimensionar", () => {
    const informar = vi.fn()
    mostrar(informar)
    const publicaciones = informar.mock.calls.length
    expect(informar.mock.lastCall?.[0].clases[0]).toMatchObject({ id: "prestamo", atributos: [{ id: "estado", nombre: "estado", tipo: "String" }] })
    const controles = ["editor-estado", "chat-borrador", "propiedades-borrador", "colaboracion-estado"].map((nombre) => screen.getByLabelText(nombre))
    controles.forEach((input) => fireEvent.change(input, { target: { value: "contenido conservado" } }))
    fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    fireEvent.click(screen.getByRole("button", { name: "Propiedades UML" }))
    fireEvent.click(screen.getByRole("button", { name: "XMI" }))
    redimensionar(800)
    fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    fireEvent.click(screen.getByRole("button", { name: "Propiedades UML" }))
    controles.forEach((input) => { expect(input.isConnected).toBe(true); expect(input).toHaveValue("contenido conservado") })
    expect(Object.values(montajes)).toEqual([1, 1, 1, 1])
    expect(informar).toHaveBeenCalledTimes(publicaciones)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([1200, 960, 800, 390])("usa valores iniciales adaptados sin imponer exclusión a %i px", (ancho) => {
    redimensionar(ancho)
    mostrar()
    expect(panel("workspace-tools").hidden).toBe(ancho < 960)
    expect(panel("workspace-properties").hidden).toBe(ancho < 960)
    if (ancho >= 960) fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    expect(panel("workspace-tools")).toBeVisible()
    if (ancho < 960) fireEvent.click(screen.getByRole("button", { name: "Propiedades UML" }))
    expect(panel("workspace-properties")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Propiedades UML" }))
    expect(panel("workspace-tools")).toBeVisible()
    expect(panel("workspace-properties")).not.toBeVisible()
  })

  it("cierra con Escape y devuelve el foco al control visible", () => {
    mostrar()
    const chat = screen.getByLabelText("chat-borrador")
    chat.focus()
    fireEvent.keyDown(chat, { key: "Escape" })
    expect(panel("workspace-tools")).not.toBeVisible()
    expect(screen.getByRole("button", { name: "Asistente" })).toHaveFocus()
    const propiedades = screen.getByLabelText("propiedades-borrador")
    propiedades.focus()
    fireEvent.keyDown(propiedades, { key: "Escape" })
    expect(panel("workspace-properties")).not.toBeVisible()
    expect(screen.getByRole("button", { name: "Propiedades UML" })).toHaveFocus()
  })

  it("no cierra paneles ni pierde el foco al reducir el ancho", () => {
    mostrar()
    screen.getByLabelText("chat-borrador").focus()
    redimensionar(800)
    expect(panel("workspace-tools")).toBeVisible()
    expect(panel("workspace-properties")).toBeVisible()
    expect(screen.getByLabelText("chat-borrador")).toHaveFocus()
  })

  it.each([[true, true], [true, false], [false, true], [false, false]])("restaura el estado previo tras modo foco (%s/%s)", (asistenteAbierto, propiedadesAbiertas) => {
    redimensionar(960)
    mostrar()
    const controles = ["editor-estado", "chat-borrador", "propiedades-borrador", "colaboracion-estado"].map((nombre) => screen.getByLabelText(nombre))
    controles.forEach((input) => fireEvent.change(input, { target: { value: "estado previo" } }))
    if (!asistenteAbierto) fireEvent.click(screen.getByRole("button", { name: "Asistente" }))
    if (!propiedadesAbiertas) fireEvent.click(screen.getByRole("button", { name: "Propiedades UML" }))
    fireEvent.click(screen.getByRole("button", { name: "Modo foco" }))
    expect(panel("workspace-tools")).not.toBeVisible()
    expect(panel("workspace-properties")).not.toBeVisible()
    redimensionar(390)
    fireEvent.click(screen.getByRole("button", { name: "Restaurar paneles" }))
    expect(panel("workspace-tools").hidden).toBe(!asistenteAbierto)
    expect(panel("workspace-properties").hidden).toBe(!propiedadesAbiertas)
    controles.forEach((input) => { expect(input.isConnected).toBe(true); expect(input).toHaveValue("estado previo") })
    expect(Object.values(montajes)).toEqual([1, 1, 1, 1])
    expect(fetch).not.toHaveBeenCalled()
  })

  it("traduce los controles nuevos al inglés con las preferencias existentes", () => {
    localStorage.setItem("sw1.idioma", "en")
    render(<ProveedorPreferenciasUI><PaginaModeladoClases proyectoId="p" accesoColaboracion={{ projectId: "p", participantId: "u", displayName: "Persona", credential: "prueba" }} modeloInicial={{ id: "m", nombre: "Modelo", version: "1", clases: [], relaciones: [] }} alCambiarModeloCanonico={vi.fn()} /></ProveedorPreferenciasUI>)
    expect(screen.getByRole("group", { name: "Modeling workspace panels" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Assistant" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Close UML properties" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Focus mode" }))
    expect(screen.getByRole("button", { name: "Restore panels" })).toHaveAttribute("aria-pressed", "true")
  })
})
