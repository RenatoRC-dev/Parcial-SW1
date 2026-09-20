import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { evaluarAptitudGeneracionSpring } from "./EvaluadorAptitudGeneracionSpring"
import { PanelGeneracionSpring } from "./PanelGeneracionSpring"

const modelo: ModeloUMLCanonico = { id: "m", nombre: "Modelo", version: "1", relaciones: [], clases: [{ id: "c", nombre: "Cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [{ id: "a", nombre: "nombre", tipo: "String" }] }] }

describe("PanelGeneracionSpring", () => {
  it("habilita la generación y presenta éxito", async () => {
    const alGenerar = vi.fn().mockResolvedValue(undefined)
    const validacion = validarModelo(modelo)
    render(<PanelGeneracionSpring modelo={modelo} validacion={validacion} aptitud={evaluarAptitudGeneracionSpring(modelo, validacion)} alGenerar={alGenerar} />)
    fireEvent.click(screen.getByRole("button", { name: "Generar backend Spring Boot" }))
    await waitFor(() => expect(alGenerar).toHaveBeenCalledWith(modelo))
    expect(await screen.findByText("Backend generado y descargado.")).toBeVisible()
  })

  it("deshabilita el botón y explica un modelo no apto", () => {
    const invalido = { ...modelo, clases: [] }
    const validacion = validarModelo(invalido)
    render(<PanelGeneracionSpring modelo={invalido} validacion={validacion} aptitud={evaluarAptitudGeneracionSpring(invalido, validacion)} />)
    expect(screen.getByRole("button", { name: "Generar backend Spring Boot" })).toBeDisabled()
    expect(screen.getByText("El modelo contiene errores de validación UML.")).toBeVisible()
  })

  it("distingue UML editable de generación no apta por atributo incompleto", () => {
    const incompleto: ModeloUMLCanonico = {
      ...modelo,
      clases: [{ ...modelo.clases[0], atributos: [{ id: "a", nombre: "nombre", tipo: null }] }],
    }
    const validacion = validarModelo(incompleto)
    render(<PanelGeneracionSpring modelo={incompleto} validacion={validacion} aptitud={evaluarAptitudGeneracionSpring(incompleto, validacion)} />)

    expect(screen.getByText("Válido")).toBeVisible()
    expect(screen.getByText("No apto")).toBeVisible()
    expect(screen.getByRole("button", { name: "Generar backend Spring Boot" })).toBeDisabled()
    expect(screen.getByText(/Cliente.nombre/)).toBeVisible()
  })

  it("mantiene apto 1 a 1..* y muestra la advertencia mínima sin bloquear", () => {
    const conMinimo: ModeloUMLCanonico = {
      ...modelo,
      clases: [
        { ...modelo.clases[0], id: "factura", nombre: "Factura" },
        { id: "detalle", nombre: "DetalleFactura", abstracta: false, posicion: { x: 300, y: 0 }, atributos: [{ id: "numero", nombre: "numero", tipo: "String" }] },
      ],
      relaciones: [{
        id: "relacion-uuid-interna", nombre: "contiene", tipo: "asociacion", claseOrigenId: "factura", claseDestinoId: "detalle",
        multiplicidadOrigen: "1", multiplicidadDestino: "1..*", rolOrigen: "factura", rolDestino: "detalles",
      }],
    }
    const validacion = validarModelo(conMinimo)
    render(<PanelGeneracionSpring modelo={conMinimo} validacion={validacion} aptitud={evaluarAptitudGeneracionSpring(conMinimo, validacion)} />)
    expect(screen.getByText("Válido")).toBeVisible()
    expect(screen.getByText("Apto")).toBeVisible()
    expect(screen.getByRole("button", { name: "Generar backend Spring Boot" })).toBeEnabled()
    expect(screen.getByText(/«contiene» — Factura \(1\) ↔ DetalleFactura \(1\.\.\*\).*regla de negocio/)).toBeVisible()
    expect(screen.queryByText(/relacion-uuid-interna/)).not.toBeInTheDocument()
  })

  it("muestra el error del servicio", async () => {
    const validacion = validarModelo(modelo)
    render(<PanelGeneracionSpring modelo={modelo} validacion={validacion} aptitud={evaluarAptitudGeneracionSpring(modelo, validacion)} alGenerar={() => Promise.reject(new Error("servicio no disponible"))} />)
    fireEvent.click(screen.getByRole("button", { name: "Generar backend Spring Boot" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("servicio no disponible")
  })
})
