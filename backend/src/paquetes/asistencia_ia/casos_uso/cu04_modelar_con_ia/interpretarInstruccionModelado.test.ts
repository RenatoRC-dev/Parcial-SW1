import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import type { ProveedorModeloLenguaje } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import { ErrorProveedorIA } from "../../compartido/proveedores/ProveedorModeloLenguaje.js"
import type { ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import type { ComandoModeloUML } from "../../compartido/contrato/ComandoModeloUML.js"
import { ejecutarComandosUML } from "./EjecutorComandosUML.js"
import { interpretarInstruccionModelado } from "./interpretarInstruccionModelado.js"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RepositorioProyectosArchivos } from "../../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { ProtegerAccesoProyecto } from "../../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"

const modelo: ModeloUMLCanonicoIA = {
  id: "modelo", nombre: "Modelo", version: "4.2.0",
  clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 }, atributos: [] }],
  relaciones: [],
}

async function prepararApi(proveedor: ProveedorModeloLenguaje) {
  const directorio = await mkdtemp(join(tmpdir(), "nexocase-cu04-"))
  const aplicacion = crearAplicacionGeneracionBackend({ proveedorIA: proveedor, accesoProyectos: {
    proyectos: new RepositorioProyectosArchivos(directorio), participantes: new RepositorioParticipantesMemoria(),
    protector: new ProtegerAccesoProyecto("pepper-cu04-test"), eventos: new RepositorioEventosMemoria(), mensajes: new RepositorioMensajesMemoria(),
  } })
  const creado = await request(aplicacion).post("/api/proyectos").send({ nombre: "Prueba CU04", nombreParticipante: "Renato" }).expect(201)
  const ruta = `/api/proyectos/${creado.body.proyecto.id}/modelado-ia/interpretar`
  const enviar = (cuerpo: Record<string, unknown>) => request(aplicacion).post(ruta).set({ Authorization: `Bearer ${creado.body.credencial}` })
    .send({ requestId: crypto.randomUUID(), ...cuerpo })
  return { enviar, cerrar: () => rm(directorio, { recursive: true, force: true }) }
}

describe("interpretarInstruccionModelado", () => {
  const prestamo: ModeloUMLCanonicoIA = { ...modelo, clases: [{ ...modelo.clases[0], id: "tmp-prestamo-real", nombre: "Prestamo" }] }
  const estado: ComandoModeloUML = { tipo: "agregar_atributo", claseRef: "tmp-prestamo-real", refTemporal: "tmp-attr-1", nombre: "estado", tipoDato: "String", visibilidad: "privada" }
  const preparar = (comandos: ComandoModeloUML[], actual = prestamo, instruccion = "Agrega estado String a Prestamo.") => interpretarInstruccionModelado({ instruccion, modelo: actual, revision: 7 },
    { interpretarCambiosUML: async () => ({ resultado: "aplicar", mensaje: "Plan de estado.", comandos }) })

  it("normaliza tmp-attr-1 al agregar estado a Prestamo conservando el ID estable y la atomicidad", async () => {
    const original = structuredClone(prestamo)
    const comandoOriginal = structuredClone(estado)
    const plan = await preparar([estado])
    expect(plan).toMatchObject({ resultado: "aplicar", comandos: [{ claseRef: "tmp-prestamo-real", refTemporal: "tmp_attr_1" }] })
    const aplicado = ejecutarComandosUML(prestamo, plan.comandos, () => "atributo-estado")
    expect(aplicado.clases[0]).toMatchObject({ id: "tmp-prestamo-real", atributos: [{ nombre: "estado", tipo: "String" }] })
    expect(prestamo).toEqual(original); expect(estado).toEqual(comandoOriginal)
  })

  it("mantiene referencias entre clases, atributos, métodos, parámetros y relaciones del mismo plan", async () => {
    const comandos: ComandoModeloUML[] = [
      { tipo: "crear_clase", refTemporal: "tmp-clase-1", nombre: "Devolucion", abstracta: false },
      { tipo: "agregar_atributo", claseRef: "tmp-clase-1", refTemporal: "tmp-attr-1", nombre: "estado", tipoDato: "String", visibilidad: "privada" },
      { tipo: "crear_metodo", claseRef: "tmp-clase-1", refTemporal: "tmp-metodo-1", nombre: "registrar", tipoRetorno: "void", visibilidad: "publica", parametros: [{ refTemporal: "tmp-param-1", nombre: "estado", tipo: "String" }] },
      { tipo: "crear_relacion", refTemporal: "tmp-rel-1", tipoRelacion: "asociacion", claseOrigenRef: "tmp-prestamo-real", claseDestinoRef: "tmp-clase-1", cantidadDestinoPorOrigen: "0..1", cantidadOrigenPorDestino: "1", rolOrigen: null, rolDestino: null },
    ]
    const plan = await preparar(comandos, prestamo, "Crea Devolucion con estado String y firma registrar(estado String): void. Cada Prestamo tiene cero o una Devolucion; cada Devolucion pertenece a un Prestamo.")
    expect(plan.resultado).toBe("aplicar")
    expect(plan.comandos[1]).toMatchObject({ claseRef: "tmp_clase_1", refTemporal: "tmp_attr_1" })
    expect(plan.comandos[2]).toMatchObject({ claseRef: "tmp_clase_1", refTemporal: "tmp_metodo_1", parametros: [{ refTemporal: "tmp_param_1" }] })
    expect(plan.comandos[3]).toMatchObject({ claseOrigenRef: "tmp-prestamo-real", claseDestinoRef: "tmp_clase_1" })
    let id = 0
    const aplicado = ejecutarComandosUML(prestamo, plan.comandos, () => `nuevo-${++id}`)
    expect(aplicado.relaciones[0].claseDestinoId).toBe(aplicado.clases[1].id)
    expect(aplicado.clases[1].metodos?.[0].parametros[0].nombre).toBe("estado")
    expect(comandos[0]).toMatchObject({ refTemporal: "tmp-clase-1" })
  })

  it.each(["attr-1", "tmp.attr.1", "tmp attr 1", "tmp-", "tmp-attr--1"])("rechaza un temporal no normalizable %s sin cambios parciales", async (refTemporal) => {
    const original = structuredClone(prestamo)
    const plan = await preparar([{ ...estado, refTemporal }])
    expect(plan).toMatchObject({ resultado: "rechazar", comandos: [] })
    expect(prestamo).toEqual(original)
  })

  it.each(["tmp-attr-1", "tmp_attr_1"])("rechaza duplicados y colisiones de normalización con %s", async (refTemporal) => {
    expect(await preparar([estado, { ...estado, refTemporal, nombre: "observacion" }])).toMatchObject({ resultado: "rechazar", comandos: [] })
  })

  it.each(["tmp-attr-1", "tmp_attr_1"])("no oculta un ID estable al normalizar contra %s", async (id) => {
    const actual = { ...prestamo, clases: [{ ...prestamo.clases[0], id }] }
    const plan = await preparar([{ ...estado, claseRef: id }], actual)
    expect(plan).toMatchObject({ resultado: "rechazar", comandos: [] })
    expect(actual.clases[0].atributos).toEqual([])
  })
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
    expect(resultado.mensaje).toContain("La instrucción no produjo un cambio UML válido.")
    expect(resultado.mensaje).toContain("El modelo no fue modificado.")
  })

  it.each(["aclarar", "rechazar"] as const)("%s preserva cero comandos", async (resultadoProveedor) => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: resultadoProveedor, mensaje: "Mensaje", comandos: [] })) }
    const resultado = await interpretarInstruccionModelado({ instruccion: "Solicitud", modelo, revision: 2 }, proveedor)
    expect(resultado.comandos).toEqual([])
  })

  it("una relación semánticamente ambigua solicita aclaración sin mutar el modelo", async () => {
    const original = structuredClone(modelo)
    const proveedor: ProveedorModeloLenguaje = {
      interpretarCambiosUML: vi.fn(async () => ({
        resultado: "aclarar",
        mensaje: "¿Cuál clase es el Todo y cuál es la Parte?",
        comandos: [],
      })),
    }

    const resultado = await interpretarInstruccionModelado({
      instruccion: "Agrega una agregación entre dos clases.",
      modelo,
      revision: 3,
    }, proveedor)

    expect(resultado).toMatchObject({ resultado: "aclarar", comandos: [] })
    expect(modelo).toEqual(original)
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
    const api = await prepararApi({ interpretarCambiosUML })
    await api.enviar({ instruccion: "", modelo, revision: -1 }).expect(400); await api.cerrar()
    expect(interpretarCambiosUML).not.toHaveBeenCalled()
  })

  it("devuelve la revisión y los comandos validados", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => ({ resultado: "aplicar", mensaje: "Clase creada.", comandos: [{ tipo: "crear_clase", refTemporal: "tmp_factura", nombre: "Factura", abstracta: false }] })) }
    const api = await prepararApi(proveedor); const respuesta = await api.enviar({ instruccion: "Crea Factura", modelo, revision: 8 }).expect(200); await api.cerrar()
    expect(respuesta.body.plan).toMatchObject({ resultado: "aplicar", revision: 8 })
  })

  it("mapea el límite del proveedor sin filtrar detalles", async () => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => { throw new ErrorProveedorIA("limite", "detalle privado") }) }
    const api = await prepararApi(proveedor); const respuesta = await api.enviar({ instruccion: "Crea Factura", modelo, revision: 0 }).expect(429); await api.cerrar()
    expect(respuesta.body.error).not.toContain("detalle privado")
    expect(respuesta.body.tipo).toBe("limite")
    expect(respuesta.body.error).toContain("El modelo no fue modificado")
  })

  it.each([
    ["configuracion", 503],
    ["autenticacion", 503],
    ["timeout", 504],
    ["respuesta_invalida", 502],
    ["no_disponible", 503],
  ] as const)("normaliza el error de proveedor %s sin filtrar detalles", async (tipo, estado) => {
    const proveedor: ProveedorModeloLenguaje = { interpretarCambiosUML: vi.fn(async () => { throw new ErrorProveedorIA(tipo, "detalle privado") }) }
    const api = await prepararApi(proveedor); const respuesta = await api.enviar({ instruccion: "Crea Factura", modelo, revision: 0 }).expect(estado); await api.cerrar()
    expect(respuesta.body).toMatchObject({ tipo })
    expect(respuesta.body.error).not.toContain("detalle privado")
    expect(respuesta.body.error).toContain("El modelo no fue modificado")
  })

  it("distingue el timeout del límite y conserva el modelo de la solicitud", async () => {
    const original = structuredClone(modelo)
    const interpretarCambiosUML = vi.fn(async () => { throw new ErrorProveedorIA("timeout", "detalle privado") })
    const api = await prepararApi({ interpretarCambiosUML })
    const respuesta = await api.enviar({ instruccion: "Agrega correo", modelo, revision: 0 }).expect(504); await api.cerrar()

    expect(respuesta.body).toEqual({
      tipo: "timeout",
      error: "La IA tardó demasiado en responder. Intenta nuevamente. El modelo no fue modificado.",
    })
    expect(interpretarCambiosUML).toHaveBeenCalledOnce()
    expect(modelo).toEqual(original)
  })
})
