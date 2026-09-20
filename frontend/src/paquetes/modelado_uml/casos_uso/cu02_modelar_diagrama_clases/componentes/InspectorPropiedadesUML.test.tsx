import { act, fireEvent, render, screen, within } from "@testing-library/react"
import type { ApollonEditor } from "@tumaet/apollon"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ModeloUMLCanonico } from "../../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { MULTIPLICIDADES_UML, TIPOS_RELACION_UML, VISIBILIDADES_UML } from "../../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { TIPOS_GENERACION_SOPORTADOS, TIPOS_RETORNO_METODO } from "../../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { ProveedorPreferenciasUI } from "../../../../../configuracion/PreferenciasUI"
import { InspectorPropiedadesUML } from "./InspectorPropiedadesUML"

const modelo: ModeloUMLCanonico = {
  id: "m",
  nombre: "Modelo",
  version: "4.2.0",
  clases: [
    { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [{ id: "saldo", nombre: "saldo", tipo: "Money", visibilidad: "privada" }] },
    { id: "factura", nombre: "Factura", abstracta: false, posicion: { x: 300, y: 0 }, atributos: [] },
  ],
  relaciones: [],
}

const modeloConRelacion: ModeloUMLCanonico = {
  ...modelo,
  relaciones: [{ id: "relacion-1", tipo: "asociacion", claseOrigenId: "factura", claseDestinoId: "cliente", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "factura", rolDestino: "cliente" }],
}

let seleccionar: (ids: string[]) => void
const editor = {
  subscribeToSelectionChange: vi.fn((callback: (ids: string[]) => void) => {
    seleccionar = callback
    return 7
  }),
  unsubscribe: vi.fn(),
} as unknown as ApollonEditor

function renderizar(modeloActual = modelo, aplicar = vi.fn()) {
  render(<ProveedorPreferenciasUI><InspectorPropiedadesUML editor={editor} modelo={modeloActual} alAplicar={aplicar} /></ProveedorPreferenciasUI>)
  return aplicar
}

function seleccionarCliente() {
  act(() => seleccionar(["cliente"]))
}

describe("InspectorPropiedadesUML compacto", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("crea una clase SW1 limpia, sin atributos ni artefactos de métodos", () => {
    const aplicar = renderizar({ ...modelo, clases: [], relaciones: [] })
    const grupo = screen.getByRole("group", { name: "Nueva clase" })
    fireEvent.change(within(grupo).getByLabelText("Nombre de clase"), { target: { value: "Cliente" } })
    fireEvent.click(within(grupo).getByRole("button", { name: "Crear clase" }))
    const clase = aplicar.mock.calls[0][0].clases[0]
    expect(clase).toMatchObject({ nombre: "Cliente", atributos: [], metodos: [], abstracta: false })
    expect(clase).not.toHaveProperty("methods")
  })

  it("mantiene la validación manual de nombres sin aplicar normalización de lenguaje natural", () => {
    const aplicar = renderizar({ ...modelo, clases: [], relaciones: [] })
    const grupo = screen.getByRole("group", { name: "Nueva clase" })
    fireEvent.change(within(grupo).getByLabelText("Nombre de clase"), { target: { value: "factura_producto" } })
    fireEvent.click(within(grupo).getByRole("button", { name: "Crear clase" }))
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("no es un identificador Java de clase soportado")
  })

  it("representa cada atributo en una fila compacta con edición controlada y borrado inmediato", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    const fila = screen.getByRole("group", { name: "Atributo saldo" })
    expect(within(fila).getByLabelText("Nombre saldo")).toBeVisible()
    expect(within(fila).getByLabelText("Tipo saldo")).toBeInstanceOf(HTMLSelectElement)
    expect(within(fila).getByLabelText("Visibilidad saldo")).toBeInstanceOf(HTMLSelectElement)
    expect(within(fila).getByRole("button", { name: "Eliminar atributo saldo" })).toBeVisible()
    expect(within(fila).queryByRole("button", { name: /Actualizar atributo/ })).toBeNull()
    fireEvent.click(within(fila).getByRole("button", { name: "Eliminar atributo saldo" }))
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0][0].clases[0].atributos).toEqual([])
  })

  it("abre una sola fila temporal y cancelar no produce mutación canónica", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    expect(screen.queryByRole("group", { name: "Nuevo atributo" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar atributo" }))
    expect(screen.getAllByRole("group", { name: "Nuevo atributo" })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "+ Agregar atributo" })).toBeNull()
    fireEvent.click(within(screen.getByRole("group", { name: "Nuevo atributo" })).getByRole("button", { name: "Cancelar" }))
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.queryByRole("group", { name: "Nuevo atributo" })).toBeNull()
  })

  it("confirma exactamente un atributo con tipo autoritativo y visibilidad privada predeterminada", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar atributo" }))
    const fila = screen.getByRole("group", { name: "Nuevo atributo" })
    const tipos = within(fila).getByLabelText("Tipo") as HTMLSelectElement
    const visibilidades = within(fila).getByLabelText("Visibilidad") as HTMLSelectElement
    expect(Array.from(tipos.options).map((opcion) => opcion.value)).toEqual([...TIPOS_GENERACION_SOPORTADOS])
    expect(Array.from(tipos.options).map((opcion) => opcion.value)).not.toContain("strin")
    expect(Array.from(visibilidades.options).map((opcion) => opcion.value)).toEqual([...VISIBILIDADES_UML])
    expect(tipos).toHaveValue(TIPOS_GENERACION_SOPORTADOS[0])
    expect(visibilidades).toHaveValue("privada")
    fireEvent.change(within(fila).getByLabelText("Nombre"), { target: { value: "nombre" } })
    fireEvent.click(within(fila).getByRole("button", { name: "Confirmar atributo" }))
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0][0].clases[0].atributos.at(-1)).toMatchObject({ nombre: "nombre", tipo: "String", visibilidad: "privada" })
  })

  it("permite crear el identificador convencional id de tipo Long", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar atributo" }))
    const fila = screen.getByRole("group", { name: "Nuevo atributo" })
    fireEvent.change(within(fila).getByLabelText("Nombre"), { target: { value: "id" } })
    fireEvent.change(within(fila).getByLabelText("Tipo"), { target: { value: "Long" } })
    fireEvent.click(within(fila).getByRole("button", { name: "Confirmar atributo" }))

    expect(aplicar.mock.calls[0][0].clases[0].atributos.at(-1)).toMatchObject({ nombre: "id", tipo: "Long" })
  })

  it("crea un método compacto con retorno y visibilidad controlados", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar método" }))
    const fila = screen.getByRole("group", { name: "Nuevo método" })
    expect(Array.from((within(fila).getByLabelText("Tipo de retorno") as HTMLSelectElement).options).map((opcion) => opcion.value)).toEqual([...TIPOS_RETORNO_METODO])
    fireEvent.change(within(fila).getByLabelText("Nombre"), { target: { value: "calcularTotal" } })
    fireEvent.change(within(fila).getByLabelText("Tipo de retorno"), { target: { value: "Double" } })
    fireEvent.click(within(fila).getByRole("button", { name: "Confirmar método" }))
    expect(aplicar.mock.calls[0][0].clases[0].metodos[0]).toMatchObject({ nombre: "calcularTotal", tipoRetorno: "Double", visibilidad: "publica", parametros: [] })
  })

  it("cancelar método no muta y un nombre vacío se rechaza", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar método" }))
    fireEvent.click(within(screen.getByRole("group", { name: "Nuevo método" })).getByRole("button", { name: "Cancelar" }))
    expect(aplicar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar método" }))
    fireEvent.click(within(screen.getByRole("group", { name: "Nuevo método" })).getByRole("button", { name: "Confirmar método" }))
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("debe tener un nombre")
  })

  it("renombra el método y controla su retorno y visibilidad", () => {
    const conMetodo: ModeloUMLCanonico = { ...modelo, clases: modelo.clases.map((clase) => clase.id === "cliente" ? { ...clase, metodos: [{ id: "m1", nombre: "calcular", tipoRetorno: "Double", visibilidad: "publica", parametros: [] }] } : clase) }
    const aplicar = renderizar(conMetodo)
    seleccionarCliente()
    const metodo = screen.getByRole("group", { name: "Método calcular" })
    const nombre = within(metodo).getByLabelText("Nombre calcular")
    fireEvent.change(nombre, { target: { value: "calcularTotal" } })
    fireEvent.blur(nombre)
    expect(aplicar.mock.calls[0][0].clases[0].metodos[0].nombre).toBe("calcularTotal")
    fireEvent.change(within(metodo).getByLabelText("Tipo de retorno calcular"), { target: { value: "Boolean" } })
    expect(aplicar.mock.calls[1][0].clases[0].metodos[0].tipoRetorno).toBe("Boolean")
    fireEvent.change(within(metodo).getByLabelText("Visibilidad calcular"), { target: { value: "privada" } })
    expect(aplicar.mock.calls[2][0].clases[0].metodos[0].visibilidad).toBe("privada")
  })

  it("agrega, cambia y elimina parámetros y elimina el método", () => {
    const conMetodo: ModeloUMLCanonico = { ...modelo, clases: modelo.clases.map((clase) => clase.id === "cliente" ? { ...clase, metodos: [{ id: "m1", nombre: "cambiarNombre", tipoRetorno: "void", visibilidad: "publica", parametros: [] }] } : clase) }
    const aplicar = renderizar(conMetodo)
    seleccionarCliente()
    const metodo = screen.getByRole("group", { name: "Método cambiarNombre" })
    fireEvent.click(within(metodo).getByRole("button", { name: "Parámetros" }))
    fireEvent.click(within(metodo).getByRole("button", { name: "+ Agregar parámetro" }))
    const nuevo = within(metodo).getByRole("group", { name: "Nuevo parámetro" })
    fireEvent.change(within(nuevo).getByLabelText("Nombre"), { target: { value: "nombre" } })
    fireEvent.click(within(nuevo).getByRole("button", { name: "Confirmar parámetro" }))
    expect(aplicar.mock.calls[0][0].clases[0].metodos[0].parametros[0]).toMatchObject({ nombre: "nombre", tipo: "String" })

    const parametro = { id: "p1", nombre: "nombre", tipo: "String" }
    const conParametro: ModeloUMLCanonico = { ...conMetodo, clases: conMetodo.clases.map((clase) => clase.id === "cliente" ? { ...clase, metodos: [{ ...clase.metodos![0], parametros: [parametro] }] } : clase) }
    const aplicarParametro = vi.fn()
    renderizar(conParametro, aplicarParametro)
    seleccionarCliente()
    const segundoMetodo = screen.getAllByRole("group", { name: "Método cambiarNombre" }).at(-1)!
    fireEvent.click(within(segundoMetodo).getByRole("button", { name: "Parámetros" }))
    const nombreExistente = within(segundoMetodo).getByLabelText("Nombre nombre")
    fireEvent.change(nombreExistente, { target: { value: "nuevoNombre" } })
    fireEvent.blur(nombreExistente)
    expect(aplicarParametro.mock.calls[0][0].clases[0].metodos[0].parametros[0].nombre).toBe("nuevoNombre")
    fireEvent.change(within(segundoMetodo).getByLabelText("Tipo nombre"), { target: { value: "Long" } })
    expect(aplicarParametro.mock.calls[1][0].clases[0].metodos[0].parametros[0].tipo).toBe("Long")
    fireEvent.click(within(segundoMetodo).getByRole("button", { name: "Eliminar parámetro nombre" }))
    expect(aplicarParametro.mock.calls[2][0].clases[0].metodos[0].parametros).toEqual([])
    fireEvent.click(within(segundoMetodo).getByRole("button", { name: "Eliminar método cambiarNombre" }))
    expect(aplicarParametro.mock.calls[3][0].clases[0].metodos).toEqual([])
  })

  it("mantiene visible la eliminación compacta y elimina sólo el método seleccionado", () => {
    const conMetodos: ModeloUMLCanonico = { ...modelo, clases: modelo.clases.map((clase) => clase.id === "cliente" ? { ...clase, metodos: [
      { id: "cobrar", nombre: "cobrar", tipoRetorno: "void", visibilidad: "publica", parametros: [] },
      { id: "listar", nombre: "listar", tipoRetorno: "String", visibilidad: "publica", parametros: [] },
    ] } : clase) }
    const aplicar = renderizar(conMetodos)
    seleccionarCliente()
    const cobrar = screen.getByRole("group", { name: "Método cobrar" })
    const eliminar = within(cobrar).getByRole("button", { name: "Eliminar método cobrar" })
    expect(eliminar).toBeVisible()
    expect(eliminar).toHaveAttribute("title", "Eliminar método")
    fireEvent.click(eliminar)
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0][0].clases[0].metodos).toEqual([conMetodos.clases[0].metodos![1]])
    expect(aplicar.mock.calls[0][0].clases[0].atributos).toEqual(conMetodos.clases[0].atributos)
  })

  it("rechaza al editar un nombre de parámetro vacío y conserva el original", () => {
    const conParametro: ModeloUMLCanonico = { ...modelo, clases: modelo.clases.map((clase) => clase.id === "cliente" ? { ...clase, metodos: [{ id: "m1", nombre: "cambiarNombre", tipoRetorno: "void", visibilidad: "publica", parametros: [{ id: "p1", nombre: "nombre", tipo: "String" }] }] } : clase) }
    const aplicar = renderizar(conParametro)
    seleccionarCliente()
    const metodo = screen.getByRole("group", { name: "Método cambiarNombre" })
    fireEvent.click(within(metodo).getByRole("button", { name: "Parámetros" }))
    const nombre = within(metodo).getByLabelText("Nombre nombre")
    fireEvent.change(nombre, { target: { value: "   " } })
    fireEvent.blur(nombre)
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("nombre único no vacío")
    expect(nombre).toHaveValue("nombre")
  })

  it("preserva un tipo importado no soportado hasta reemplazarlo intencionalmente", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    const fila = screen.getByRole("group", { name: "Atributo saldo" })
    const tipo = within(fila).getByLabelText("Tipo saldo") as HTMLSelectElement
    expect(tipo).toHaveValue("Money")
    expect(tipo.options[0]?.textContent).toContain("no soportado")
    expect(modelo.clases[0].atributos[0].tipo).toBe("Money")
    fireEvent.change(tipo, { target: { value: "Double" } })
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0][0].clases[0].atributos[0].tipo).toBe("Double")
  })

  it("aplica inmediatamente sólo una visibilidad canónica seleccionada", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    const visibilidad = within(screen.getByRole("group", { name: "Atributo saldo" })).getByLabelText("Visibilidad saldo") as HTMLSelectElement
    expect(Array.from(visibilidad.options).map((opcion) => opcion.value).filter(Boolean)).toEqual([...VISIBILIDADES_UML])
    fireEvent.change(visibilidad, { target: { value: "publica" } })
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0][0].clases[0].atributos[0].visibilidad).toBe("publica")
  })

  it("rechaza un nombre vacío al perder foco y conserva el atributo original", () => {
    const aplicar = renderizar()
    seleccionarCliente()
    const nombre = within(screen.getByRole("group", { name: "Atributo saldo" })).getByLabelText("Nombre saldo")
    fireEvent.change(nombre, { target: { value: "   " } })
    fireEvent.blur(nombre)
    expect(aplicar).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("debe tener un nombre")
    expect(nombre).toHaveValue("saldo")
  })

  it("crea una relación atómicamente con vocabularios canónicos y no crea extremos faltantes", () => {
    const aplicar = renderizar()
    fireEvent.click(screen.getByRole("button", { name: "+ Nueva relación" }))
    const grupo = screen.getByRole("group", { name: "Nueva relación" })
    const crear = within(grupo).getByRole("button", { name: "Crear relación" })
    expect(crear).toBeDisabled()
    expect(Array.from((within(grupo).getByLabelText("Tipo de relación") as HTMLSelectElement).options).map((opcion) => opcion.value)).toEqual([...TIPOS_RELACION_UML])
    fireEvent.change(within(grupo).getByLabelText("Clase A"), { target: { value: "factura" } })
    expect(crear).toBeDisabled()
    fireEvent.change(within(grupo).getByLabelText("Clase B"), { target: { value: "cliente" } })
    const cantidadClientes = within(grupo).getByLabelText("Para una Factura, ¿cuántos Cliente puede haber?") as HTMLSelectElement
    expect(Array.from(cantidadClientes.options).map((opcion) => opcion.value).filter(Boolean)).toEqual([...MULTIPLICIDADES_UML])
    fireEvent.change(cantidadClientes, { target: { value: "0..*" } })
    fireEvent.change(within(grupo).getByLabelText("Para un Cliente, ¿cuántas Factura puede haber?"), { target: { value: "1" } })
    fireEvent.change(within(grupo).getByLabelText("Rol (opcional) Clase A"), { target: { value: "pedidos" } })
    fireEvent.change(within(grupo).getByLabelText("Nombre de relación (opcional)"), { target: { value: "tiene" } })
    fireEvent.click(crear)
    expect(aplicar).toHaveBeenCalledOnce()
    expect(aplicar.mock.calls[0][0].relaciones).toHaveLength(1)
    expect(aplicar.mock.calls[0][0].relaciones[0]).toMatchObject({ nombre: "tiene", tipo: "asociacion", claseOrigenId: "factura", claseDestinoId: "cliente", multiplicidadOrigen: "1", multiplicidadDestino: "0..*", rolOrigen: "pedidos" })
  })

  it.each(["agregacion", "composicion"] as const)("crea %s con Parte en origen y Todo en destino", (tipo) => {
    const aplicar = renderizar()
    fireEvent.click(screen.getByRole("button", { name: "+ Nueva relación" }))
    const grupo = screen.getByRole("group", { name: "Nueva relación" })
    fireEvent.change(within(grupo).getByLabelText("Tipo de relación"), { target: { value: tipo } })
    fireEvent.change(within(grupo).getByLabelText("Todo"), { target: { value: "factura" } })
    fireEvent.change(within(grupo).getByLabelText("Parte"), { target: { value: "cliente" } })
    fireEvent.change(within(grupo).getByLabelText("Para una Cliente, ¿cuántos Factura puede haber?"), { target: { value: "1" } })
    fireEvent.change(within(grupo).getByLabelText("Para un Factura, ¿cuántas Cliente puede haber?"), { target: { value: "0..*" } })
    fireEvent.click(within(grupo).getByRole("button", { name: "Crear relación" }))

    expect(aplicar.mock.calls[0][0].relaciones[0]).toMatchObject({
      tipo,
      claseOrigenId: "cliente",
      claseDestinoId: "factura",
      multiplicidadOrigen: "0..*",
      multiplicidadDestino: "1",
    })
  })

  it("crea una generalización de Subclase a Superclase sin multiplicidades", () => {
    const aplicar = renderizar()
    fireEvent.click(screen.getByRole("button", { name: "+ Nueva relación" }))
    const grupo = screen.getByRole("group", { name: "Nueva relación" })
    fireEvent.change(within(grupo).getByLabelText("Tipo de relación"), { target: { value: "generalizacion" } })
    fireEvent.change(within(grupo).getByLabelText("Subclase"), { target: { value: "factura" } })
    fireEvent.change(within(grupo).getByLabelText("Superclase"), { target: { value: "cliente" } })
    expect(within(grupo).queryByText(/¿cuántos/)).toBeNull()
    fireEvent.click(within(grupo).getByRole("button", { name: "Crear relación" }))

    expect(aplicar.mock.calls[0][0].relaciones[0]).toMatchObject({
      tipo: "generalizacion",
      claseOrigenId: "factura",
      claseDestinoId: "cliente",
      multiplicidadOrigen: null,
      multiplicidadDestino: null,
    })
  })

  it("edita tipo, multiplicidad y rol sin botón Actualizar y elimina la relación", () => {
    const aplicar = renderizar(modeloConRelacion)
    expect(screen.queryByRole("group", { name: "Relación Factura → Cliente" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Factura → Cliente" }))
    const grupo = screen.getByRole("group", { name: "Relación Factura → Cliente" })
    expect(within(grupo).queryByRole("button", { name: /Actualizar relación/ })).toBeNull()
    fireEvent.change(within(grupo).getByLabelText("Tipo de relación"), { target: { value: "agregacion" } })
    expect(aplicar.mock.calls[0][0].relaciones[0].tipo).toBe("agregacion")
    expect(within(grupo).getByText("Cada Cliente se relaciona con esta cantidad de Factura.")).toBeVisible()
    expect(within(grupo).getByText("Cada Factura se relaciona con esta cantidad de Cliente.")).toBeVisible()
    fireEvent.change(within(grupo).getByLabelText("Multiplicidad en este extremo Cliente"), { target: { value: "1..*" } })
    expect(aplicar.mock.calls[1][0].relaciones[0].multiplicidadDestino).toBe("1..*")
    const rol = within(grupo).getByLabelText("Rol (opcional) Cliente")
    fireEvent.change(rol, { target: { value: " clientes " } })
    fireEvent.blur(rol)
    expect(aplicar.mock.calls[2][0].relaciones[0].rolDestino).toBe("clientes")
    fireEvent.click(within(grupo).getByRole("button", { name: "Eliminar relación" }))
    expect(aplicar.mock.calls[3][0].relaciones).toEqual([])
  })

  it.each([
    ["Persona", "Auto", "0..*", "1", "1", "0..*"],
    ["Usuario", "Perfil", "0..1", "1", "1", "0..1"],
    ["Departamento", "Empleado", "1..*", "0..1", "0..1", "1..*"],
  ] as const)("traduce cantidades de negocio %s/%s a multiplicidades de extremos UML", (nombreOrigen, nombreDestino, destinosPorOrigen, origenesPorDestino, extremoOrigen, extremoDestino) => {
    const modeloAsimetrico: ModeloUMLCanonico = {
      ...modelo,
      clases: [
        { ...modelo.clases[0], id: "origen", nombre: nombreOrigen },
        { ...modelo.clases[1], id: "destino", nombre: nombreDestino },
      ],
      relaciones: [],
    }
    const aplicar = renderizar(modeloAsimetrico)
    fireEvent.click(screen.getByRole("button", { name: "+ Nueva relación" }))
    const grupo = screen.getByRole("group", { name: "Nueva relación" })
    fireEvent.change(within(grupo).getByLabelText("Clase A"), { target: { value: "origen" } })
    fireEvent.change(within(grupo).getByLabelText("Clase B"), { target: { value: "destino" } })
    fireEvent.change(within(grupo).getByLabelText(`Para una ${nombreOrigen}, ¿cuántos ${nombreDestino} puede haber?`), { target: { value: destinosPorOrigen } })
    fireEvent.change(within(grupo).getByLabelText(`Para un ${nombreDestino}, ¿cuántas ${nombreOrigen} puede haber?`), { target: { value: origenesPorDestino } })
    fireEvent.click(within(grupo).getByRole("button", { name: "Crear relación" }))
    expect(aplicar.mock.calls[0][0].relaciones[0]).toMatchObject({
      claseOrigenId: "origen",
      claseDestinoId: "destino",
      multiplicidadOrigen: extremoOrigen,
      multiplicidadDestino: extremoDestino,
    })
  })

  it("muestra directamente la relación seleccionada por el editor", () => {
    renderizar(modeloConRelacion)
    act(() => seleccionar(["relacion-1"]))

    expect(screen.getByText("Relación seleccionada")).toBeVisible()
    expect(screen.getByRole("group", { name: /Relación Factura/ })).toBeVisible()
  })

  it("resume muchas relaciones y expande sólo la elegida", () => {
    const relaciones = Array.from({ length: 12 }, (_, indice) => ({
      ...modeloConRelacion.relaciones[0], id: `r-${indice}`,
    }))
    renderizar({ ...modeloConRelacion, relaciones })

    expect(screen.getByText("12 relaciones; selecciona una para editarla")).toBeVisible()
    expect(screen.queryAllByRole("group", { name: /Relación Factura/ })).toHaveLength(0)
    fireEvent.click(screen.getAllByRole("button", { name: "Factura → Cliente" })[4])
    expect(screen.getAllByRole("group", { name: /Relación Factura/ })).toHaveLength(1)
  })

  it("traduce las nuevas acciones compactas sin cambiar los valores canónicos", () => {
    localStorage.setItem("sw1.idioma", "en")
    const aplicar = renderizar()
    seleccionarCliente()
    fireEvent.click(screen.getByRole("button", { name: "+ Add attribute" }))
    const fila = screen.getByRole("group", { name: "New attribute" })
    expect(within(fila).getByRole("button", { name: "Confirm attribute" })).toBeVisible()
    expect(within(fila).getByRole("button", { name: "Cancel" })).toBeVisible()
    fireEvent.click(within(fila).getByRole("button", { name: "Cancel" }))
    expect(aplicar).not.toHaveBeenCalled()
  })
})
