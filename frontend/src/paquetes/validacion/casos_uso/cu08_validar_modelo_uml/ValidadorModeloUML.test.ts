import { describe, expect, it } from "vitest"
import type {
  AtributoUML,
  ClaseUML,
  ModeloUMLCanonico,
  RelacionUML,
} from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { validarModelo } from "./ValidadorModeloUML"

function atributo(
  id: string,
  nombre: string,
  tipo: string | null
): AtributoUML {
  return { id, nombre, tipo }
}

function clase(
  id: string,
  nombre: string,
  atributos: AtributoUML[] = []
): ClaseUML {
  return {
    id,
    nombre,
    atributos,
    posicion: { x: 0, y: 0 },
    abstracta: false,
  }
}

function modelo(
  clases: ClaseUML[],
  relaciones: RelacionUML[] = []
): ModeloUMLCanonico {
  return {
    id: "modelo-prueba",
    nombre: "Modelo de prueba",
    version: "4.2.0",
    clases,
    relaciones,
  }
}

function codigos(resultado: ReturnType<typeof validarModelo>): string[] {
  return resultado.diagnosticos.map((diagnostico) => diagnostico.codigo)
}

describe("ValidadorModeloUML", () => {
  it("considera inválido un modelo vacío", () => {
    const resultado = validarModelo(modelo([]))

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain("MODELO_SIN_CLASES")
  })

  it("acepta una clase válida", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("nombre", "nombre", "String")])])
    )

    expect(resultado).toEqual({ valido: true, diagnosticos: [] })
  })

  it.each(["", "123Cliente", "Cliente#", "cliente"])(
    "rechaza el nombre de clase %j",
    (nombre) => {
      const resultado = validarModelo(modelo([clase("clase-1", nombre)]))

      expect(resultado.valido).toBe(false)
      expect(codigos(resultado)).toContain(
        nombre === "" ? "CLASE_NOMBRE_REQUERIDO" : "CLASE_IDENTIFICADOR_INVALIDO"
      )
    }
  )

  it("detecta nombres de clase duplicados sin distinguir mayúsculas", () => {
    const resultado = validarModelo(
      modelo([clase("cliente-1", "Cliente"), clase("cliente-2", "CLIENTE")])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain("CLASE_NOMBRE_DUPLICADO")
  })

  it.each(["", "123nombre", "nombre#", "Nombre"])(
    "rechaza el nombre de atributo %j",
    (nombre) => {
      const resultado = validarModelo(
        modelo([clase("cliente", "Cliente", [atributo("a1", nombre, "String")])])
      )

      expect(resultado.valido).toBe(false)
      expect(codigos(resultado)).toContain(
        nombre === ""
          ? "ATRIBUTO_NOMBRE_REQUERIDO"
          : "ATRIBUTO_IDENTIFICADOR_INVALIDO"
      )
    }
  )

  it.each([
    ["class", "ATRIBUTO_IDENTIFICADOR_INVALIDO"],
    ["id", "ATRIBUTO_ID_RESERVADO"],
  ])("rechaza el campo reservado %s", (nombre, codigo) => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", nombre, "String")])])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain(codigo)
  })

  it("detecta atributos duplicados sin distinguir mayúsculas", () => {
    const resultado = validarModelo(
      modelo([
        clase("cliente", "Cliente", [
          atributo("a1", "nombre", "String"),
          atributo("a2", "NOMBRE", "String"),
        ]),
      ])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain("ATRIBUTO_NOMBRE_DUPLICADO")
  })

  it.each([null, ""])("rechaza un atributo sin tipo: %j", (tipo) => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", "nombre", tipo)])])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain("ATRIBUTO_TIPO_REQUERIDO")
  })

  it("rechaza un tipo desconocido sin convertirlo a String", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", "saldo", "Money")])])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain("ATRIBUTO_TIPO_NO_SOPORTADO")
  })

  it.each(["String", "int", "BigDecimal", "LocalDate", "UUID"])(
    "acepta el tipo soportado %s",
    (tipo) => {
      const resultado = validarModelo(
        modelo([clase("cliente", "Cliente", [atributo("a1", "valor", tipo)])])
      )

      expect(resultado.valido).toBe(true)
    }
  )

  it("rechaza una relación cuyo destino no existe", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente")], [
        {
          id: "r1",
          tipo: "asociacion",
          claseOrigenId: "cliente",
          claseDestinoId: "pedido-inexistente",
          multiplicidadOrigen: "1",
          multiplicidadDestino: "0..*",
        },
      ])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain("RELACION_EXTREMO_INEXISTENTE")
  })

  it("mantiene válido el modelo y solo advierte por multiplicidad incompleta", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente"), clase("pedido", "Pedido")], [
        {
          id: "r1",
          tipo: "asociacion",
          claseOrigenId: "cliente",
          claseDestinoId: "pedido",
          multiplicidadOrigen: null,
          multiplicidadDestino: "0..*",
        },
      ])
    )

    expect(resultado.valido).toBe(true)
    expect(codigos(resultado)).toEqual(["RELACION_MULTIPLICIDAD_INCOMPLETA"])
    expect(resultado.diagnosticos.every((d) => d.severidad === "advertencia")).toBe(true)
  })

  it("no emite advertencias de capacidad de generación para una relación estructural completa", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente"), clase("pedido", "Pedido")], [
        {
          id: "r1",
          tipo: "asociacion",
          claseOrigenId: "cliente",
          claseDestinoId: "pedido",
          multiplicidadOrigen: "1",
          multiplicidadDestino: "0..*",
        },
      ])
    )

    expect(resultado).toEqual({ valido: true, diagnosticos: [] })
  })
})
