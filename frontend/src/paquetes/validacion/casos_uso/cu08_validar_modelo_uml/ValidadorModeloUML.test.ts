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
  it("acepta una clase asociativa vacía y una clase legacy como normal", () => {
    const asociativa = { ...clase("usuario-rol", "UsuarioRol"), tipoClase: "asociativa" as const }
    const legacy = clase("usuario", "Usuario")
    expect(validarModelo(modelo([asociativa, legacy])).valido).toBe(true)
  })

  it("acepta operaciones UML válidas sin convertirlas en error de generación", () => {
    const persona = clase("persona", "Persona", [])
    persona.metodos = [{ id: "m1", nombre: "cambiarNombre", visibilidad: "publica", tipoRetorno: "void", parametros: [{ id: "p1", nombre: "nombre", tipo: "String" }] }]
    expect(validarModelo(modelo([persona])).valido).toBe(true)
  })

  it("rechaza métodos vacíos, tipos inválidos y firmas duplicadas", () => {
    const persona = clase("persona", "Persona", [])
    persona.metodos = [
      { id: "m1", nombre: "", visibilidad: "publica", tipoRetorno: "voiid", parametros: [{ id: "p1", nombre: "", tipo: "strin" }] },
      { id: "m2", nombre: "", visibilidad: "publica", tipoRetorno: "voiid", parametros: [{ id: "p2", nombre: "otro", tipo: "strin" }] },
    ]
    const resultado = validarModelo(modelo([persona]))
    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toEqual(expect.arrayContaining(["METODO_NOMBRE_REQUERIDO", "METODO_RETORNO_INVALIDO", "PARAMETRO_NOMBRE_INVALIDO", "PARAMETRO_TIPO_INVALIDO", "METODO_FIRMA_DUPLICADA"]))
  })
  it("rechaza un id de modelo vacío", () => {
    const entrada = modelo([clase("cliente", "Cliente")])
    entrada.id = "   "
    expect(codigos(validarModelo(entrada))).toContain("MODELO_ID_REQUERIDO")
  })

  it("rechaza un id de clase vacío", () => {
    expect(codigos(validarModelo(modelo([clase(" ", "Cliente")])))).toContain("CLASE_ID_REQUERIDO")
  })

  it("rechaza ids de clase duplicados", () => {
    const resultado = validarModelo(modelo([clase("misma", "Cliente"), clase("misma", "Pedido")]))
    expect(codigos(resultado)).toContain("CLASE_ID_DUPLICADO")
  })

  it("rechaza un id de atributo vacío", () => {
    const resultado = validarModelo(modelo([clase("cliente", "Cliente", [atributo(" ", "nombre", "String")])]))
    expect(codigos(resultado)).toContain("ATRIBUTO_ID_REQUERIDO")
  })

  it("rechaza ids de atributo duplicados en clases diferentes", () => {
    const resultado = validarModelo(modelo([
      clase("cliente", "Cliente", [atributo("campo", "nombre", "String")]),
      clase("pedido", "Pedido", [atributo("campo", "fecha", "LocalDate")]),
    ]))
    expect(codigos(resultado)).toContain("ATRIBUTO_ID_DUPLICADO")
  })

  it("rechaza un id de relación vacío", () => {
    const resultado = validarModelo(modelo([clase("cliente", "Cliente"), clase("pedido", "Pedido")], [{
      id: " ", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido",
      multiplicidadOrigen: "1", multiplicidadDestino: "0..*",
    }]))
    expect(codigos(resultado)).toContain("RELACION_ID_REQUERIDO")
  })

  it("rechaza ids de relación duplicados", () => {
    const relacion: RelacionUML = {
      id: "relacion", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido",
      multiplicidadOrigen: "1", multiplicidadDestino: "0..*",
    }
    const resultado = validarModelo(modelo(
      [clase("cliente", "Cliente"), clase("pedido", "Pedido")],
      [relacion, { ...relacion }]
    ))
    expect(codigos(resultado)).toContain("RELACION_ID_DUPLICADO")
  })

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
  ])("rechaza el campo reservado %s", (nombre, codigo) => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", nombre, "String")])])
    )

    expect(resultado.valido).toBe(false)
    expect(codigos(resultado)).toContain(codigo)
  })

  it("acepta el identificador convencional id de tipo Long", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", "id", "Long")])])
    )

    expect(resultado.valido).toBe(true)
  })

  it("deja la convención id: Long al evaluador de generación", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", "id", "String")])])
    )

    expect(resultado.valido).toBe(true)
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

  it.each([null, ""])("mantiene editable un atributo sin tipo y lo resume como incompleto: %j", (tipo) => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", "nombre", tipo)])])
    )

    expect(resultado.valido).toBe(true)
    expect(resultado.diagnosticos).toEqual([
      expect.objectContaining({ codigo: "ATRIBUTOS_SIN_TIPO", severidad: "advertencia", mensaje: expect.stringContaining("Cliente.nombre") }),
    ])
  })

  it("mantiene estructuralmente válido un tipo ajeno al perfil Spring sin convertirlo a String", () => {
    const resultado = validarModelo(
      modelo([clase("cliente", "Cliente", [atributo("a1", "saldo", "Money")])])
    )

    expect(resultado).toEqual({ valido: true, diagnosticos: [] })
  })

  it("resume muchos atributos incompletos sin exponer ids técnicos", () => {
    const atributos = Array.from({ length: 8 }, (_, indice) => atributo(`EAID_${indice}`, `campo${indice}`, null))
    const resultado = validarModelo(modelo([clase("EAID_CLASE", "Cliente", atributos)]))

    expect(resultado.diagnosticos).toHaveLength(1)
    expect(resultado.diagnosticos[0].mensaje).toContain("8 atributos sin tipo definido")
    expect(resultado.diagnosticos[0].mensaje).toContain("Cliente.campo0")
    expect(resultado.diagnosticos[0].mensaje).toContain("y 3 más")
    expect(resultado.diagnosticos[0].mensaje).not.toContain("EAID_")
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

  it("acepta una generalización estructural sin multiplicidades", () => {
    const resultado = validarModelo(
      modelo([clase("persona", "Persona"), clase("cliente", "Cliente")], [{
        id: "g1",
        tipo: "generalizacion",
        claseOrigenId: "cliente",
        claseDestinoId: "persona",
        multiplicidadOrigen: null,
        multiplicidadDestino: null,
      }])
    )

    expect(resultado).toEqual({ valido: true, diagnosticos: [] })
  })
})
