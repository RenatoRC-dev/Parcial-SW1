import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ConfiguracionConectorEA } from "./ConfiguracionConectorEA"
import { TarjetaFlujoAsistente } from "./TarjetaFlujoAsistente"
import type { VistaFlujoAsistente } from "./consultarAsistenteContextual"

describe("EA setup and reverse preview", () => {
  it("loads authenticated actual status only on opening; downloads and revokes without project credentials in code", async () => {
    const estado = vi.fn(async () => ({ estado: "disconnected" as const }))
    const descargar = vi.fn(async () => {}), revocar = vi.fn(async () => {})
    const crear = vi.fn(async () => ({ codigo: "one-use-code", expires: Date.now() + 180000 }))
    render(<ConfiguracionConectorEA projectId="p" credential="secret" estado={estado} descargar={descargar} revocar={revocar} crear={crear} />)
    expect(estado).not.toHaveBeenCalled()
    const details = screen.getByText("Configurar Enterprise Architect").closest("details")!; details.open = true; fireEvent(details, new Event("toggle"))
    expect(await screen.findByText("Desconectado")).toBeVisible()
    expect(estado).toHaveBeenCalledWith("p", "secret")
    fireEvent.click(screen.getByRole("button", { name: /Descargar conector/ }))
    await waitFor(() => expect(descargar).toHaveBeenCalledWith("p", "secret"))
    await waitFor(() => expect(screen.getByRole("button", { name: /Generar código/ })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: /Generar código/ }))
    expect(await screen.findByDisplayValue("one-use-code")).toHaveAttribute("type", "password")
    expect(screen.queryByDisplayValue("secret")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Revocar mi conector" }))
    await waitFor(() => expect(revocar).toHaveBeenCalledWith("p", "secret"))
    expect(screen.queryByDisplayValue("one-use-code")).not.toBeInTheDocument()
  })
  it("status failure never claims connected; unavailable ZIP is actionable", async () => {
    render(<ConfiguracionConectorEA projectId="p" credential="s" solicitar estado={vi.fn(async () => { throw Error() })} descargar={vi.fn(async () => { throw Error() })} />)
    expect(await screen.findByRole("alert")).toBeVisible()
    expect(screen.queryByText("Conectado")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Descargar conector/ }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se completó"))
  })
  it("reverse preview safely renders attributes, roles and warnings; confirmation is explicit", () => {
    const decidir=vi.fn(), cancelar=vi.fn()
    const flujo: VistaFlujoAsistente = { requestId:"r",sourceMessageId:"s",participantId:"p",revision:1,operacion:"importar_desde_ea",estado:"review",resumen:"Replacement pending",advertencias:["Methods omitted"],vistaPrevia:{clases:[{nombre:"<script>alert(1)</script>",atributos:[{nombre:"nombre",tipo:"String"}]}],relaciones:[{nombre:"compra",tipo:"asociacion",origen:"Cliente",destino:"Venta",multiplicidadOrigen:"1",multiplicidadDestino:"0..*",rolOrigen:"cliente",rolDestino:"ventas"}],truncado:false} }
    const view=render(<TarjetaFlujoAsistente flujo={flujo} ocupado={false} alDecidir={decidir} alDescargar={vi.fn()} alCancelar={cancelar} />)
    expect(screen.getByText("nombre: String")).toBeVisible(); expect(screen.getByText(/cliente \/ ventas/)).toBeVisible()
    expect(view.container.querySelector("script")).toBeNull(); expect(decidir).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name:"Confirmar reemplazo del modelo" })); expect(decidir).toHaveBeenCalledWith("confirmar")
    view.rerender(<TarjetaFlujoAsistente flujo={{...flujo,estado:"queued"}} ocupado={false} alDecidir={decidir} alDescargar={vi.fn()} alCancelar={cancelar} />)
    expect(screen.queryByRole("button",{name:"Confirmar reemplazo del modelo"})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button",{name:"Cancelar solicitud pendiente"})); expect(cancelar).toHaveBeenCalledOnce()
  })
})
