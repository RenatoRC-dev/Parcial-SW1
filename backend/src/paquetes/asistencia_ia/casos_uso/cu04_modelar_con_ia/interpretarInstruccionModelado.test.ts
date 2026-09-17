import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import type { ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import { ErrorProveedorIA } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import type { ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import { interpretarInstruccionModelado } from "./interpretarInstruccionModelado.js"

const modelo: ModeloUMLCanonicoIA = {
  id: "modelo", nombre: "Modelo", version: "4.2.0",
  clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [] }],
  relaciones: [],
}

describe("interpretarInstruccionModelado", () => {
  it("devuelve un plan aplicable validado", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "Correo agregado.", comandos: [{ tipo: "agregar_atributo", claseRef: "cliente", refTemporal: "tmp_correo", nombre: "correo", tipoDato: "String", visibilidad: "privada" }] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Agrega correo", modelo, revision: 4 }, proveedor)
    expect(resultado).toMatchObject({ resultado: "aplicar", revision: 4 })
  })

  it("convierte un plan semánticamente inválido en rechazo sin comandos", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "", comandos: [{ tipo: "renombrar_clase", claseId: "ausente", nuevoNombre: "Otra" }] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Renombra", modelo, revision: 1 }, proveedor)
    expect(resultado.resultado).toBe("rechazar")
    expect(resultado.comandos).toEqual([])
  })

  it.each(["aclarar", "rechazar"] as const)("%s preserva cero comandos", async (resultadoProveedor) => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: resultadoProveedor, mensaje: "Mensaje", comandos: [] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Solicitud", modelo, revision: 2 }, proveedor)
    expect(resultado.comandos).toEqual([])
  })

  it("bloquea una eliminación cuya intención no es explícita", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "", comandos: [{ tipo: "eliminar_clase", claseId: "cliente" }] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Ya no necesito algo de clientes", modelo, revision: 2 }, proveedor)
    expect(resultado).toMatchObject({ resultado: "aclarar", comandos: [] })
  })
})

describe("API CU04", () => {
  it("rechaza entrada malformada sin llamar al proveedor", async () => {
    const interpretarCambiosUML = vi.fn()
    await request(crearAplicacionGeneracionBackend({ proveedorIA: { interpretarCambiosUML } })).post("/api/ia/modelado/interpretar").send({ instruccion: "", modelo, revision: -1 }).expect(400)
    expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it("devuelve la revisión y los comandos validados", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "Clase creada.", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_factura", nombre: "Factura", abstracta: false }] })) }
    const respuesta = await request(crearAplicacionGeneracionBackend({ proveedorIA: proveedor })).post("/api/ia/modelado/interpretar").send({ instruccion: "Crea Factura", modelo, revision: 8 }).expect(200)
    expect(respuesta.body).toMatchObject({ resultado: "aplicar", revision: 8 })
  })

  it("mapea el límite del proveedor sin filtrar detalles", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => { throw new ErrorProveedorIA("limite", "detalle privado") }) }
    const respuesta = await request(crearAplicacionGeneracionBackend({ proveedorIA: proveedor })).post("/api/ia/modelado/interpretar").send({ instruccion: "Crea Factura", modelo, revision: 0 }).expect(429)
    expect(respuesta.body.error).not.toContain("detalle privado")
  })
})
