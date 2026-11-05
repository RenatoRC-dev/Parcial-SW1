import { act, render, screen } from "@testing-library/react"
import type { ApollonEditor, CollaboratorInfo } from "@tumaet/apollon"
import { describe, expect, it, vi } from "vitest"
import { PanelColaboracion } from "./PanelColaboracion"

const conectar = vi.hoisted(() => vi.fn((_opciones: {
  projectId: string
  credential: string
  alCambiarParticipantes: (participantes: CollaboratorInfo[]) => void
}) => ({ desconectar: vi.fn() })))

vi.mock("./conectarColaboracionApollon", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("./conectarColaboracionApollon")>()
  return { ...original, conectarColaboracionApollon: conectar }
})

vi.mock("../../../../configuracion/PreferenciasUI", () => ({
  usarPreferenciasUI: () => ({ t: (clave: string) => clave }),
}))

describe("PanelColaboracion con acceso autorizado", () => {
  it("pasa la credencial sólo al conector y muestra nombres de Awareness sin renderizar secretos", () => {
    const credencial = "S".repeat(43)
    render(<PanelColaboracion
      editor={{} as ApollonEditor}
      acceso={{ projectId: "proyecto-1", participantId: "participante-1", displayName: "Renato", credential: credencial }}
      habilitada
    />)
    expect(conectar).toHaveBeenCalledWith(expect.objectContaining({ projectId: "proyecto-1", credential: credencial }))
    expect(document.body.textContent).not.toContain(credencial)
    expect(document.body.textContent).not.toContain("Diseñador")

    const opciones = conectar.mock.calls[0]![0]
    act(() => opciones.alCambiarParticipantes([
      { id: "participante-1", name: "Renato", color: "#2563eb", clientIds: [1], isLocal: true } as CollaboratorInfo,
      { id: "participante-2", name: "Carlos", color: "#047857", clientIds: [2], isLocal: false } as CollaboratorInfo,
    ]))
    expect(screen.getByText(/Renato/)).toBeVisible()
    expect(screen.getByText("Carlos")).toBeVisible()
  })
})
