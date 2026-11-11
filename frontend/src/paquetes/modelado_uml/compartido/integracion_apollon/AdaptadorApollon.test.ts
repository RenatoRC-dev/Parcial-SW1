import { describe, expect, it } from "vitest"
import type { UMLModel } from "@tumaet/apollon"
import {
  convertirAModeloCanonico,
  convertirAModeloCanonicoConAdvertencias,
  convertirDesdeModeloCanonico,
  normalizarAsociacionesSinNavegabilidad,
} from "./AdaptadorApollon"

function crearModelo(
  nodes: UMLModel["nodes"] = [],
  edges: UMLModel["edges"] = []
): UMLModel {
  return {
    version: "4.2.0",
    id: "modelo-1",
    title: "Modelo de prueba",
    type: "ClassDiagram",
    nodes,
    edges,
    assessments: {},
  }
}

function crearClase(
  id: string,
  name: string,
  opciones: {
    attributes?: Array<{ id: string; name: string }>
    position?: { x: number; y: number }
    isAbstract?: boolean
  } = {}
): UMLModel["nodes"][number] {
  return {
    id,
    type: "class",
    width: 200,
    height: 100,
    position: opciones.position ?? { x: 0, y: 0 },
    measured: { width: 200, height: 100 },
    data: {
      name,
      attributes: opciones.attributes ?? [],
      methods: [],
      ...(opciones.isAbstract === undefined
        ? {}
        : { isAbstract: opciones.isAbstract }),
    },
  }
}

function crearRelacion(
  type: UMLModel["edges"][number]["type"],
  data: Record<string, unknown> = {}
): UMLModel["edges"][number] {
  return {
    id: "relacion-1",
    type,
    source: "cliente",
    target: "pedido",
    sourceHandle: "source",
    targetHandle: "target",
    data: { points: [], ...data },
  }
}

describe("AdaptadorApollon", () => {
  it.each([["", undefined], ["- ", "privada"], ["+ ", "publica"], ["# ", "protegida"], ["~ ", "paquete"]] as const)("preserva atributo sin tipo/visibilidad %j en JSON y ciclos Apollon", (prefijo, visibilidad) => {
    const resultado = convertirAModeloCanonicoConAdvertencias(crearModelo([crearClase("cliente", "Cliente", { attributes: [{ id: "nombre-estable", name: `${prefijo}nombre` }, { id: "correo", name: "correo: String" }] })]))
    const atributo = resultado.modelo.clases[0].atributos[0]
    expect(atributo).toEqual({ id: "nombre-estable", nombre: "nombre", tipo: null, ...(visibilidad ? { visibilidad } : {}) })
    expect(resultado.advertencias).toEqual([])
    const apollon = convertirDesdeModeloCanonico(JSON.parse(JSON.stringify(resultado.modelo)))
    expect(apollon.nodes[0].data).toMatchObject({ attributes: [{ name: `${prefijo}nombre` }, { name: "correo: String" }] })
    expect(convertirAModeloCanonico(apollon).clases[0].atributos).toEqual(resultado.modelo.clases[0].atributos)
  })

  it("normaliza nombre: vacío a tipo null solo en la frontera textual del editor", () => {
    const resultado = convertirAModeloCanonico(crearModelo([crearClase("cliente", "Cliente", { attributes: [{ id: "dato", name: "- nombre:  " }] })]))
    expect(resultado.clases[0].atributos[0]).toEqual({ id: "dato", nombre: "nombre", tipo: null, visibilidad: "privada" })
  })

  it("convierte un diagrama de clases vacío", () => {
    const canonico = convertirAModeloCanonico(crearModelo())

    expect(canonico).toMatchObject({
      id: "modelo-1",
      nombre: "Modelo de prueba",
      version: "4.2.0",
      clases: [],
      relaciones: [],
    })
  })

  it("preserva id, nombre, posición y abstracción de una clase", () => {
    const canonico = convertirAModeloCanonico(
      crearModelo([
        crearClase("cliente", "Cliente", {
          position: { x: 125, y: 240 },
          isAbstract: true,
        }),
      ])
    )

    expect(canonico.clases).toEqual([
      {
        id: "cliente",
        nombre: "Cliente",
        atributos: [],
        metodos: [],
        posicion: { x: 125, y: 240 },
        abstracta: true,
        tipoClase: "normal",
      },
    ])
  })

  it("interpreta atributos y conserva sus ids estables", () => {
    const canonico = convertirAModeloCanonico(
      crearModelo([
        crearClase("cliente", "Cliente", {
          attributes: [
            { id: "atributo-nombre", name: "+ nombre: String" },
            { id: "atributo-email", name: "- email : String" },
            { id: "atributo-saldo", name: "# saldo: Double" },
            { id: "atributo-interno", name: "~ interno: String" },
          ],
        }),
      ])
    )

    expect(canonico.clases[0].atributos).toEqual([
      {
        id: "atributo-nombre",
        nombre: "nombre",
        tipo: "String",
        visibilidad: "publica",
      },
      {
        id: "atributo-email",
        nombre: "email",
        tipo: "String",
        visibilidad: "privada",
      },
      {
        id: "atributo-saldo",
        nombre: "saldo",
        tipo: "Double",
        visibilidad: "protegida",
      },
      {
        id: "atributo-interno",
        nombre: "interno",
        tipo: "String",
        visibilidad: "paquete",
      },
    ])
  })

  it("elimina multiplicidades y roles ajenos a una generalización de Apollon", () => {
    const canonico = convertirAModeloCanonico(crearModelo(
      [crearClase("cliente", "Cliente"), crearClase("persona", "Persona")],
      [{ ...crearRelacion("ClassInheritance", {
        sourceMultiplicity: "*", targetMultiplicity: "1", sourceRole: "hijo", targetRole: "padre",
      }), source: "cliente", target: "persona" }],
    ))
    expect(canonico.relaciones[0]).toEqual(expect.objectContaining({
      tipo: "generalizacion", claseOrigenId: "cliente", claseDestinoId: "persona",
      multiplicidadOrigen: null, multiplicidadDestino: null,
    }))
    expect(canonico.relaciones[0]).not.toHaveProperty("rolOrigen")
    expect(canonico.relaciones[0]).not.toHaveProperty("rolDestino")
  })

  it("preserva simultáneamente métodos y los cuatro tipos de relación en un ciclo canónico", () => {
    const integrado = {
      id: "integrado", nombre: "Modelo integrado", version: "4.2.0",
      clases: [
        { id: "persona", nombre: "Persona", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [], metodos: [] },
        { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 300, y: 0 }, atributos: [], metodos: [{ id: "descuento", nombre: "calcularDescuento", visibilidad: "publica" as const, tipoRetorno: "Double", parametros: [{ id: "total", nombre: "total", tipo: "Double" }] }] },
        { id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 600, y: 0 }, atributos: [], metodos: [] },
        { id: "detalle", nombre: "DetallePedido", abstracta: false, posicion: { x: 900, y: 0 }, atributos: [], metodos: [] },
        { id: "biblioteca", nombre: "Biblioteca", abstracta: false, posicion: { x: 0, y: 300 }, atributos: [], metodos: [] },
        { id: "libro", nombre: "Libro", abstracta: false, posicion: { x: 300, y: 300 }, atributos: [], metodos: [] },
      ],
      relaciones: [
        { id: "g", tipo: "generalizacion" as const, claseOrigenId: "cliente", claseDestinoId: "persona", multiplicidadOrigen: null, multiplicidadDestino: null },
        { id: "a", tipo: "asociacion" as const, claseOrigenId: "cliente", claseDestinoId: "pedido", multiplicidadOrigen: "1" as const, multiplicidadDestino: "0..*" as const },
        { id: "c", tipo: "composicion" as const, claseOrigenId: "detalle", claseDestinoId: "pedido", multiplicidadOrigen: "1..*" as const, multiplicidadDestino: "1" as const },
        { id: "ag", tipo: "agregacion" as const, claseOrigenId: "libro", claseDestinoId: "biblioteca", multiplicidadOrigen: "0..*" as const, multiplicidadDestino: "1" as const },
      ],
    }
    const vuelta = convertirAModeloCanonico(convertirDesdeModeloCanonico(integrado))
    expect(vuelta.relaciones).toEqual(integrado.relaciones)
    expect(vuelta.clases.find((clase) => clase.id === "cliente")?.metodos).toEqual([
      expect.objectContaining({
        id: "descuento", nombre: "calcularDescuento", visibilidad: "publica", tipoRetorno: "Double",
        parametros: [expect.objectContaining({ nombre: "total", tipo: "Double" })],
      }),
    ])
  })

  it.each([
    ["ClassBidirectional", "asociacion"],
    ["ClassUnidirectional", "asociacion"],
    ["ClassAggregation", "agregacion"],
    ["ClassComposition", "composicion"],
    ["ClassInheritance", "generalizacion"],
  ] as const)("convierte %s en %s", (tipoApollon, tipoCanonico) => {
    const canonico = convertirAModeloCanonico(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [crearRelacion(tipoApollon)]
      )
    )

    expect(canonico.relaciones[0]).toMatchObject({
      id: "relacion-1",
      tipo: tipoCanonico,
      claseOrigenId: "cliente",
      claseDestinoId: "pedido",
    })
  })

  it("normaliza una asociacion Apollon con flecha a la arista publica sin navegabilidad", () => {
    const original = crearModelo(
      [crearClase("persona", "Persona"), crearClase("auto", "Auto")],
      [{ ...crearRelacion("ClassUnidirectional"), source: "persona", target: "auto" }]
    )

    const normalizado = normalizarAsociacionesSinNavegabilidad(original)

    expect(normalizado).not.toBe(original)
    expect(normalizado.edges[0].type).toBe("ClassBidirectional")
    expect(normalizado.edges[0]).toMatchObject({ source: "persona", target: "auto" })
  })

  it.each([
    ["asociacion", "ClassBidirectional", "persona", "auto"],
    ["agregacion", "ClassAggregation", "jugador", "equipo"],
    ["composicion", "ClassComposition", "detalle", "pedido"],
    ["generalizacion", "ClassInheritance", "cliente", "persona"],
  ] as const)("renderiza la convencion canonica %s con el marcador en el extremo destino", (tipo, tipoApollon, origen, destino) => {
    const nombres: Record<string, string> = {
      persona: "Persona", auto: "Auto", jugador: "Jugador", equipo: "Equipo",
      detalle: "DetallePedido", pedido: "Pedido", cliente: "Cliente",
    }
    const modelo = {
      id: `modelo-${tipo}`,
      nombre: "Relaciones",
      version: "4.2.0",
      clases: [origen, destino].map((id, indice) => ({
        id, nombre: nombres[id], abstracta: false, posicion: { x: indice * 300, y: 0 }, atributos: [],
      })),
      relaciones: [{
        id: `relacion-${tipo}`, tipo, claseOrigenId: origen, claseDestinoId: destino,
        multiplicidadOrigen: tipo === "generalizacion" ? null : "1" as const,
        multiplicidadDestino: tipo === "generalizacion" ? null : "0..*" as const,
      }],
    }

    const arista = convertirDesdeModeloCanonico(modelo).edges[0]
    expect(arista).toMatchObject({ type: tipoApollon, source: origen, target: destino })
    if (tipo === "generalizacion") {
      expect(arista.data).toMatchObject({ sourceMultiplicity: "", targetMultiplicity: "" })
    }
  })

  it("normaliza multiplicidades y conserva roles verificados", () => {
    const canonico = convertirAModeloCanonico(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [
          crearRelacion("ClassBidirectional", {
            sourceMultiplicity: "1",
            targetMultiplicity: "*",
            sourceRole: "cliente",
            targetRole: "pedidos",
          }),
        ]
      )
    )

    expect(canonico.relaciones[0]).toMatchObject({
      multiplicidadOrigen: "1",
      multiplicidadDestino: "0..*",
      rolOrigen: "cliente",
      rolDestino: "pedidos",
    })
  })

  it("omite una relación no soportada y entrega una advertencia", () => {
    const resultado = convertirAModeloCanonicoConAdvertencias(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [crearRelacion("ClassDependency")]
      )
    )

    expect(resultado.modelo.relaciones).toEqual([])
    expect(resultado.advertencias).toContain(
      "Tipo de relación de Apollon no soportado por el modelo canónico: ClassDependency."
    )
  })

  it("no inventa un tipo para una multiplicidad desconocida", () => {
    const resultado = convertirAModeloCanonicoConAdvertencias(
      crearModelo(
        [crearClase("cliente", "Cliente"), crearClase("pedido", "Pedido")],
        [crearRelacion("ClassBidirectional", { sourceMultiplicity: "2..5" })]
      )
    )

    expect(resultado.modelo.relaciones[0].multiplicidadOrigen).toBeNull()
    expect(resultado.advertencias[0]).toContain(
      "Multiplicidad de origen no soportada"
    )
  })

  it("recrea una clase canónica con id, atributos, posición y abstracción", () => {
    const apollon = convertirDesdeModeloCanonico({
      id: "modelo-importado",
      nombre: "Importado",
      version: "xmi",
      clases: [{
        id: "cliente",
        nombre: "Cliente",
        abstracta: false,
        posicion: { x: 100, y: 200 },
        atributos: [{ id: "nombre", nombre: "nombre", tipo: "String" }],
      }],
      relaciones: [],
    })

    expect(apollon).toMatchObject({ id: "modelo-importado", title: "Importado", type: "ClassDiagram" })
    expect(apollon.nodes[0]).toMatchObject({
      id: "cliente",
      position: { x: 100, y: 200 },
      data: { name: "Cliente", attributes: [{ id: "nombre", name: "nombre: String" }] },
    })
  })

  it("no inventa String al recrear un atributo canónico sin tipo", () => {
    const modelo = {
      id: "modelo-sin-tipo",
      nombre: "Sin tipo",
      version: "4.2.0",
      clases: [{
        id: "cliente",
        nombre: "Cliente",
        abstracta: false,
        posicion: { x: 100, y: 100 },
        atributos: [{ id: "dato", nombre: "dato", tipo: null }],
      }],
      relaciones: [],
    }

    const vuelta = convertirAModeloCanonico(convertirDesdeModeloCanonico(modelo))

    expect(vuelta.clases[0].atributos[0]).toMatchObject({
      id: "dato",
      nombre: "dato",
      tipo: null,
    })
  })

  it("preserva tipoClase asociativa y normaliza una clase legacy como normal", () => {
    const asociativa = {
      id: "modelo-asociativo", nombre: "Accesos", version: "4.2.0",
      clases: [{ id: "usuario-rol", nombre: "UsuarioRol", tipoClase: "asociativa" as const, abstracta: false, posicion: { x: 10, y: 20 }, atributos: [] }],
      relaciones: [],
    }
    const apollon = convertirDesdeModeloCanonico(asociativa)
    expect(apollon.nodes[0].data).toMatchObject({ sw1TipoClase: "asociativa" })
    expect(convertirAModeloCanonico(apollon).clases[0].tipoClase).toBe("asociativa")

    const legacy = crearModelo([crearClase("legacy", "Legacy")])
    expect(convertirAModeloCanonico(legacy).clases[0].tipoClase).toBe("normal")
  })

  it("preserva la asociación soportada en canonical → Apollon → canonical", () => {
    const modelo = {
      id: "modelo-importado",
      nombre: "Importado",
      version: "4.2.0",
      clases: [
        { id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [] },
        { id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 450, y: 100 }, atributos: [] },
      ],
      relaciones: [{
        id: "relacion",
        nombre: "tiene",
        tipo: "asociacion" as const,
        claseOrigenId: "cliente",
        claseDestinoId: "pedido",
        multiplicidadOrigen: "1" as const,
        multiplicidadDestino: "0..*" as const,
        rolOrigen: "cliente",
        rolDestino: "pedidos",
      }],
    }
    const vuelta = convertirAModeloCanonico(convertirDesdeModeloCanonico(modelo))
    expect(vuelta.relaciones).toEqual([expect.objectContaining(modelo.relaciones[0])])
    const arista = convertirDesdeModeloCanonico(modelo).edges[0]
    expect(arista).toMatchObject({
      sourceHandle: "right",
      targetHandle: "left",
      data: { label: "tiene", sourceMultiplicity: "1", targetMultiplicity: "*" },
    })
  })

  it("preserva operaciones UML y parámetros en canonical → Apollon → canonical", () => {
    const modelo = {
      id: "modelo-metodos", nombre: "Métodos", version: "4.2.0",
      clases: [{
        id: "persona", nombre: "Persona", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [],
        metodos: [
          { id: "calcular", nombre: "calcularTotal", visibilidad: "publica" as const, tipoRetorno: "Double", parametros: [] },
          { id: "cambiar", nombre: "cambiarNombre", visibilidad: "publica" as const, tipoRetorno: "void", parametros: [{ id: "nombre-param", nombre: "nombre", tipo: "String" }] },
          { id: "validar", nombre: "validarStock", visibilidad: "privada" as const, tipoRetorno: "Boolean", parametros: [{ id: "producto-param", nombre: "productoId", tipo: "Long" }] },
        ],
      }],
      relaciones: [],
    }

    const apollon = convertirDesdeModeloCanonico(modelo)
    expect(apollon.nodes[0].data.methods).toMatchObject([
      { id: "calcular", name: "+ calcularTotal(): Double" },
      { id: "cambiar", name: "+ cambiarNombre(nombre: String): void" },
      { id: "validar", name: "- validarStock(productoId: Long): Boolean" },
    ])
    const vuelta = convertirAModeloCanonico(apollon)
    expect(vuelta.clases[0].metodos).toEqual(modelo.clases[0].metodos)
  })

  describe("F8-S3 identidad de parámetros", () => {
    function conParametros(metadata?: unknown) {
      const nodo = crearClase("persona", "Persona")
      nodo.data.methods = [{
        id: "editar", name: "+ editar(nuevo: String, segundo: Long, primero: Boolean): void",
        ...(metadata === undefined ? {} : { sw1Parametros: metadata }),
      }]
      return crearModelo([nodo])
    }

    it("mantiene identidades tras serializar, reordenar y cambiar un tipo; un parámetro nuevo no roba un ID reservado", () => {
      const metadata = [
        { id: "editar:parametro:0", nombre: "primero", tipo: "String" },
        { id: "parametro-estable", nombre: "segundo", tipo: "Long" },
      ]
      const entrada = conParametros(metadata)
      const vuelta = convertirAModeloCanonico(JSON.parse(JSON.stringify(entrada)))
      expect(vuelta.clases[0].metodos?.[0].parametros).toEqual([
        { id: "editar:parametro:0:nuevo:1", nombre: "nuevo", tipo: "String" },
        { id: "parametro-estable", nombre: "segundo", tipo: "Long" },
        { id: "editar:parametro:0", nombre: "primero", tipo: "Boolean" },
      ])
      expect(convertirAModeloCanonico(convertirDesdeModeloCanonico(vuelta))).toEqual(vuelta)
      expect(entrada.nodes[0].data.methods).toEqual([expect.objectContaining({ sw1Parametros: metadata })])
    })

    it("conserva compatibilidad con firmas antiguas sin metadatos", () => {
      const resultado = convertirAModeloCanonicoConAdvertencias(conParametros())
      expect(resultado.advertencias).toEqual([])
      expect(resultado.modelo.clases[0].metodos?.[0].parametros.map((parametro) => parametro.id)).toEqual([
        "editar:parametro:0", "editar:parametro:1", "editar:parametro:2",
      ])
    })

    it.each([
      [{ id: "", nombre: "primero", tipo: "String" }],
      [{ id: "duplicado", nombre: "primero", tipo: "String" }, { id: "duplicado", nombre: "segundo", tipo: "Long" }],
      [{ id: "a", nombre: "primero", tipo: "String" }, { id: "b", nombre: "primero", tipo: "Long" }],
    ])("no adopta identidades vacías o ambiguas y avisa (%j)", (...metadata) => {
      const resultado = convertirAModeloCanonicoConAdvertencias(conParametros(metadata))
      expect(resultado.advertencias).toEqual([expect.stringContaining("identidades de parámetros")])
      const parametros = resultado.modelo.clases[0].metodos?.[0].parametros ?? []
      expect(new Set(parametros.map((parametro) => parametro.id)).size).toBe(3)
      expect(parametros.every((parametro) => parametro.id.startsWith("editar:parametro:"))).toBe(true)
    })
  })
})
