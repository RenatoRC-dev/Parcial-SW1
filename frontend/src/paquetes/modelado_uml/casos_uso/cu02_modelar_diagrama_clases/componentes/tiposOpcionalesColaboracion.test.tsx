import { act, fireEvent, render, waitFor, within } from "@testing-library/react"
import type { ApollonEditor } from "@tumaet/apollon"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { AnfitrionEditorApollon } from "./AnfitrionEditorApollon"
import { convertirAModeloCanonico, convertirDesdeModeloCanonico } from "../../../compartido/integracion_apollon/AdaptadorApollon"
import type { ModeloUMLCanonico } from "../../../../../nucleo/modelo_uml/ModeloUMLCanonico"

describe("atributos opcionales en Apollon/Yjs real (transporte enlazado en memoria)", () => {
  // jsdom lacks the geometry API used by XYFlow; no editor/Yjs/history mocks.
  beforeAll(() => { vi.stubGlobal("DOMMatrixReadOnly", class { readonly m22 = 1 }) })
  afterAll(() => { vi.unstubAllGlobals() })
  it("sincroniza tipo null/String/null y conserva Undo/Redo e identidad sin recargar", async () => {
    let a: ApollonEditor | null = null, b: ApollonEditor | null = null
    const error = vi.fn(), cambiar = vi.fn()
    const vista = render(<>
      <div data-testid="editor-a"><AnfitrionEditorApollon alCambiarModelo={cambiar} alOcurrirError={error} alCambiarEditor={(e) => { a = e }} labels={{ undo: "Deshacer", redo: "Rehacer" }} /></div>
      <div data-testid="editor-b"><AnfitrionEditorApollon alCambiarModelo={cambiar} alOcurrirError={error} alCambiarEditor={(e) => { b = e }} /></div>
    </>)
    try {
      await waitFor(() => { expect(a).not.toBeNull(); expect(b).not.toBeNull() })
      const left = a!, right = b!
      const modelo: ModeloUMLCanonico = { id: "modelo", nombre: "Conceptual", version: "4.2.0", clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [{ id: "nombre", nombre: "nombre", tipo: null, visibilidad: "privada" }] }], relaciones: [] }
      await act(async () => {
        left.model = convertirDesdeModeloCanonico(modelo)
        left.sendBroadcastMessage((frame) => right.receiveBroadcastedMessage(frame))
        right.sendBroadcastMessage((frame) => left.receiveBroadcastedMessage(frame))
        left.broadcastFullState()
      })
      const atributo = (editor: ApollonEditor) => convertirAModeloCanonico(editor.model).clases[0]?.atributos[0]
      await waitFor(() => expect(atributo(right)).toMatchObject({ id: "nombre", nombre: "nombre", tipo: null, visibilidad: "privada" }))
      // Separate initial creation from the existing Yjs UndoManager capture window.
      await act(async () => { await new Promise((r) => setTimeout(r, 550)) })
      await act(async () => { left.model = convertirDesdeModeloCanonico({ ...modelo, clases: [{ ...modelo.clases[0], atributos: [{ ...modelo.clases[0].atributos[0], tipo: "String" }] }] }) })
      await waitFor(() => expect(atributo(right)?.tipo).toBe("String"))
      const scope = within(vista.getByTestId("editor-a"))
      fireEvent.click(scope.getByRole("button", { name: "Deshacer" }))
      await waitFor(() => expect(atributo(right)).toMatchObject({ id: "nombre", tipo: null, visibilidad: "privada" }))
      fireEvent.click(scope.getByRole("button", { name: "Rehacer" }))
      await waitFor(() => expect(atributo(right)?.tipo).toBe("String"))
      await act(async () => { left.model = convertirDesdeModeloCanonico(modelo) })
      await waitFor(() => expect(atributo(right)).toMatchObject({ id: "nombre", tipo: null, visibilidad: "privada" }))
      expect(error).not.toHaveBeenCalled()
    } finally { vista.unmount() }
  })
})
