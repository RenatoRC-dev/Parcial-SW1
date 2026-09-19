import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { ControlesPreferencias, ProveedorPreferenciasUI } from "./PreferenciasUI"

describe("preferencias de interfaz", () => {
  beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.theme })

  it("usa español y Sistema por defecto, cambia idioma/tema y persiste", () => {
    const primera = render(<ProveedorPreferenciasUI><ControlesPreferencias /></ProveedorPreferenciasUI>)
    expect(screen.getByLabelText("Idioma")).toHaveValue("es")
    expect(screen.getByLabelText("Tema")).toHaveValue("sistema")
    fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "en" } })
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "oscuro" } })
    expect(screen.getByLabelText("Language")).toHaveValue("en")
    expect(document.documentElement.dataset.theme).toBe("dark")
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "es" } })
    fireEvent.change(screen.getByLabelText("Tema"), { target: { value: "claro" } })
    expect(screen.getByLabelText("Idioma")).toHaveValue("es")
    expect(document.documentElement.dataset.theme).toBe("light")
    fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "en" } })
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "oscuro" } })
    primera.unmount()
    render(<ProveedorPreferenciasUI><ControlesPreferencias /></ProveedorPreferenciasUI>)
    expect(screen.getByLabelText("Language")).toHaveValue("en")
    expect(screen.getByLabelText("Theme")).toHaveValue("oscuro")
  })

  it("descarta valores corruptos", () => {
    localStorage.setItem("sw1.idioma", "xx")
    localStorage.setItem("sw1.tema", "neon")
    render(<ProveedorPreferenciasUI><ControlesPreferencias /></ProveedorPreferenciasUI>)
    expect(screen.getByLabelText("Idioma")).toHaveValue("es")
    expect(screen.getByLabelText("Tema")).toHaveValue("sistema")
  })
})
