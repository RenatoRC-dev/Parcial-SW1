import { describe, expect, it, vi } from "vitest"
import type { ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import type { ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import { interpretarInstruccionModelado } from "./interpretarInstruccionModelado.js"
import { normalizarComandosAsistidos, normalizarNombreClaseAsistido, normalizarTipoAsistido } from "./normalizarSemanticaAsistida.js"
import { ProveedorDeterministaE2E } from "../../pruebas/ProveedorDeterministaE2E.js"
import { ejecutarComandosUML } from "./EjecutorComandosUML.js"

const modelo: ModeloUMLCanonicoIA = {
  id: "modelo", nombre: "Modelo", version: "4.2.0",
  clases: [
    { id: "factura", nombre: "Factura", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [], metodos: [] },
    { id: "factura-producto", nombre: "FacturaProducto", abstracta: false, posicion: { x: 300, y: 0 }, atributos: [], metodos: [] },
  ],
  relaciones: [],
}

describe("normalización semántica asistida", () => {
  it.each([
    ["factura", "Factura"], ["FACTURA", "Factura"], ["Factura", "Factura"], ["FaCtUrA", "Factura"],
    ["factura producto", "FacturaProducto"], ["FACTURA PRODUCTO", "FacturaProducto"],
    ["factura_producto", "FacturaProducto"], ["FACTURA_PRODUCTO", "FacturaProducto"],
    ["factura-producto", "FacturaProducto"], [" factura   producto ", "FacturaProducto"],
    ["API_CLIENTE", "ApiCliente"],
  ])("normaliza %s como %s", (entrada, esperado) => {
    expect(normalizarNombreClaseAsistido(entrada)).toBe(esperado)
  })

  it.each([
    ["string", "String"], ["STRING", "String"], ["long", "Long"], ["LONG", "Long"],
    ["integer", "Integer"], ["double", "Double"], ["boolean", "Boolean"], ["Float", "Float"],
    ["void", "void"], ["varchar", "varchar"],
  ])("normaliza el tipo %s sin coerciones semánticas", (entrada, esperado) => {
    expect(normalizarTipoAsistido(entrada)).toBe(esperado)
  })

  it("resuelve referencias normalizadas y aplica los valores predeterminados asistidos", () => {
    const comandos = normalizarComandosAsistidos(modelo, [{
      tipo: "agregar_atributo", claseRef: "FACTURA_PRODUCTO", refTemporal: "tmp_precio",
      nombre: "precio", tipoDato: "double", visibilidad: null,
    }])
    expect(comandos[0]).toEqual(expect.objectContaining({ claseRef: "factura-producto", tipoDato: "Double", visibilidad: "privada" }))
  })

  it("preserva la visibilidad de atributo provista explÃ­citamente", () => {
    const comandos = normalizarComandosAsistidos(modelo, [{
      tipo: "agregar_atributo", claseRef: "factura", refTemporal: "tmp_codigo",
      nombre: "codigo", tipoDato: "String", visibilidad: "publica",
    }])
    expect(comandos[0]).toEqual(expect.objectContaining({ visibilidad: "publica" }))
  })

  it("normaliza una instrucción estructurada clara de clase asociativa", async () => {
    const proveedor: ProveedorModeloLenguaje = {
      interpretarCambiosUML: vi.fn(async () => ({
        resultado: "aplicar", mensaje: "asociativa",
        comandos: [{
          tipo: "crear_clase_asociativa", refTemporal: "tmp_factura_item", nombre: "factura item",
          claseARef: "FACTURA", claseBRef: "FACTURA_PRODUCTO",
        }],
      })),
    }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Crea una clase asociativa FacturaItem", modelo, revision: 1 }, proveedor)

    expect(resultado).toMatchObject({
      resultado: "aplicar",
      comandos: [expect.objectContaining({ nombre: "FacturaItem", claseARef: "factura", claseBRef: "factura-producto" })],
    })
  })

  it("acepta id Long, rechaza id String y no muta el modelo", async () => {
    const original = structuredClone(modelo)
    const proveedorLong: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "id", comandos: [{ tipo: "agregar_atributo", claseRef: "factura", refTemporal: "tmp_id", nombre: "id", tipoDato: "long", visibilidad: null }] })) }
    const aceptado = await interpretarInstruccionModelado({ instruccion: "Agrega id Long a Factura", modelo, revision: 1 }, proveedorLong)
    expect(aceptado).toMatchObject({ resultado: "aplicar", comandos: [expect.objectContaining({ claseRef: "factura", tipoDato: "Long", visibilidad: "privada" })] })

    const proveedorString: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "id", comandos: [{ tipo: "agregar_atributo", claseRef: "factura", refTemporal: "tmp_id", nombre: "id", tipoDato: "String", visibilidad: null }] })) }
    const rechazado = await interpretarInstruccionModelado({ instruccion: "Agrega id String a Factura", modelo, revision: 1 }, proveedorString)
    expect(rechazado).toMatchObject({ resultado: "rechazar", comandos: [] })
    expect(rechazado.mensaje).toContain("debe utilizar el tipo Long")
    expect(modelo).toEqual(original)
  })

  it("normaliza antes de detectar duplicados y devuelve una sola causa útil", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "crear", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_factura", nombre: "FACTURA", abstracta: false }] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Crea una clase FACTURA", modelo, revision: 2 }, proveedor)
    expect(resultado).toMatchObject({ resultado: "rechazar", comandos: [] })
    expect(resultado.mensaje).toContain("duplicado")
    expect(resultado.mensaje).not.toContain("inválido")
  })

  it("rechaza tipos no soportados sin convertirlos", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "tipo", comandos: [{ tipo: "agregar_atributo", claseRef: "factura", refTemporal: "tmp_dato", nombre: "dato", tipoDato: "varchar", visibilidad: null }] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Agrega dato varchar", modelo, revision: 3 }, proveedor)
    expect(resultado).toMatchObject({ resultado: "rechazar", comandos: [] })
    expect(resultado.mensaje).toContain("varchar")
  })

  it("el proveedor determinista expresa valores predeterminados y aclara métodos ambiguos", async () => {
    const proveedor = new ProveedorDeterministaE2E()
    const crear = await proveedor.interpretarCambiosUML({ instruccion: "Agrega a factura un método cobrar", modelo, contexto: {} })
    expect(crear.comandos[0]).toEqual(expect.objectContaining({ tipo: "crear_metodo", claseRef: "factura", nombre: "cobrar", tipoRetorno: "void", visibilidad: "publica", parametros: [] }))

    const ambiguo = structuredClone(modelo)
    ambiguo.clases[0].metodos = [{ id: "cobrar-1", nombre: "cobrar", visibilidad: "publica", tipoRetorno: "void", parametros: [] }]
    ambiguo.clases[1].metodos = [{ id: "cobrar-2", nombre: "cobrar", visibilidad: "publica", tipoRetorno: "void", parametros: [{ id: "p", nombre: "monto", tipo: "Double" }] }]
    const resultado = await proveedor.interpretarCambiosUML({ instruccion: "Agrega al método cobrar un parámetro moneda String", modelo: ambiguo, contexto: {} })
    expect(resultado).toMatchObject({ resultado: "aclarar", comandos: [] })
  })

  it("interpreta Persona-Auto como cantidades de negocio y produce extremos UML correctos", async () => {
    const vacio: ModeloUMLCanonicoIA = { id: "m", nombre: "Modelo", version: "4.2.0", clases: [], relaciones: [] }
    const resultado = await interpretarInstruccionModelado({
      instruccion: "Crea una clase Persona y una clase Auto. Una Persona puede tener cero o muchos Autos. Cada Auto pertenece exactamente a una Persona.",
      modelo: vacio,
      revision: 1,
    }, new ProveedorDeterministaE2E())
    expect(resultado).toMatchObject({ resultado: "aplicar" })
    let secuencia = 0
    const aplicado = ejecutarComandosUML(vacio, resultado.comandos, (categoria) => `${categoria}-${++secuencia}`)
    const persona = aplicado.clases.find((clase) => clase.nombre === "Persona")!
    const auto = aplicado.clases.find((clase) => clase.nombre === "Auto")!
    expect(aplicado.relaciones[0]).toMatchObject({
      claseOrigenId: persona.id,
      claseDestinoId: auto.id,
      multiplicidadOrigen: "1",
      multiplicidadDestino: "0..*",
    })
  })
})
