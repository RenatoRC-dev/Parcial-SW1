import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { RepositorioProyectosArchivos } from "../infraestructura/RepositorioProyectosArchivos.js"

describe("API CU01/CU11 de proyectos", () => {
  let directorio: string
  beforeEach(async () => { directorio = await mkdtemp(join(tmpdir(), "sw1-proyectos-test-")) })
  afterEach(async () => { await rm(directorio, { recursive: true, force: true }) })

  const app = () => crearAplicacionGeneracionBackend({ repositorioProyectos: new RepositorioProyectosArchivos(directorio) })

  it("crea, lista, guarda borrador y recupera tras reinstanciar el repositorio", async () => {
    const creado = await request(app()).post("/api/proyectos").send({ nombre: "  Ventas  " }).expect(201)
    expect(creado.body.nombre).toBe("Ventas")
    expect(creado.body.modelo.clases).toEqual([])

    const listado = await request(app()).get("/api/proyectos").expect(200)
    expect(listado.body).toHaveLength(1)
    expect(listado.body[0].modelo).toBeUndefined()

    const modelo = { ...creado.body.modelo, clases: [{ id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 1, y: 2 }, atributos: [{ id: "nombre", nombre: "nombre", tipo: null }] }] }
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo }).expect(200)
    const recuperado = await request(app()).get(`/api/proyectos/${creado.body.id}`).expect(200)
    expect(recuperado.body.modelo.clases[0].atributos[0].tipo).toBeNull()
    expect(await readdir(directorio)).toEqual([`${creado.body.id}.json`])
  })

  it("preserva métodos y parámetros y acepta proyectos heredados sin metodos", async () => {
    const creado = await request(app()).post("/api/proyectos").send({ nombre: "Operaciones" }).expect(201)
    const claseLegacy = { id: "persona", nombre: "Persona", abstracta: false, posicion: { x: 1, y: 2 }, atributos: [] }
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo: { ...creado.body.modelo, clases: [claseLegacy] } }).expect(200)
    const metodo = { id: "m1", nombre: "cambiarNombre", visibilidad: "publica", tipoRetorno: "void", parametros: [{ id: "p1", nombre: "nombre", tipo: "String" }] }
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo: { ...creado.body.modelo, clases: [{ ...claseLegacy, metodos: [metodo] }] } }).expect(200)
    const recuperado = await request(app()).get(`/api/proyectos/${creado.body.id}`).expect(200)
    expect(recuperado.body.modelo.clases[0].metodos).toEqual([metodo])
    expect(recuperado.body.modelo.clases[0].tipoClase).toBe("normal")
  })

  it("preserva la clase asociativa y sus extremos al guardar y reabrir", async () => {
    const creado = await request(app()).post("/api/proyectos").send({ nombre: "Roles" }).expect(201)
    const usuario = { id: "usuario", nombre: "Usuario", tipoClase: "normal", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }
    const rol = { id: "rol", nombre: "Rol", tipoClase: "normal", abstracta: false, posicion: { x: 400, y: 0 }, atributos: [] }
    const usuarioRol = { id: "usuario-rol", nombre: "UsuarioRol", tipoClase: "asociativa", abstracta: false, posicion: { x: 200, y: 140 }, atributos: [] }
    const relaciones = [
      { id: "r-usuario", tipo: "asociacion", claseOrigenId: "usuario", claseDestinoId: "usuario-rol", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
      { id: "r-rol", tipo: "asociacion", claseOrigenId: "usuario-rol", claseDestinoId: "rol", multiplicidadOrigen: "0..*", multiplicidadDestino: "1" },
    ]
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({
      modelo: { ...creado.body.modelo, clases: [usuario, usuarioRol, rol], relaciones },
    }).expect(200)

    const recuperado = await request(app()).get(`/api/proyectos/${creado.body.id}`).expect(200)
    expect(recuperado.body.modelo.clases.find((clase: { id: string }) => clase.id === "usuario-rol")).toMatchObject({ tipoClase: "asociativa", atributos: [] })
    expect(recuperado.body.modelo.relaciones).toEqual(relaciones)
  })

  it("preserva métodos, visibilidad y los cuatro tipos de relación al guardar y reabrir", async () => {
    const creado = await request(app()).post("/api/proyectos").send({ nombre: "Modelo integrado" }).expect(201)
    const clase = (id: string, nombre: string) => ({ id, nombre, tipoClase: "normal", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] })
    const clases = [clase("persona", "Persona"), {
      ...clase("cliente", "Cliente"),
      atributos: [{ id: "correo", nombre: "correo", tipo: "String", visibilidad: "privada" }],
      metodos: [{ id: "descuento", nombre: "calcularDescuento", visibilidad: "publica", tipoRetorno: "Double", parametros: [{ id: "total", nombre: "total", tipo: "Double" }] }],
    }, clase("pedido", "Pedido"), clase("detalle", "DetallePedido"), clase("biblioteca", "Biblioteca"), clase("libro", "Libro")]
    const relaciones = [
      { id: "g", tipo: "generalizacion", claseOrigenId: "cliente", claseDestinoId: "persona", multiplicidadOrigen: null, multiplicidadDestino: null },
      { id: "a", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "pedido", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
      { id: "c", tipo: "composicion", claseOrigenId: "detalle", claseDestinoId: "pedido", multiplicidadOrigen: "1..*", multiplicidadDestino: "1" },
      { id: "ag", tipo: "agregacion", claseOrigenId: "libro", claseDestinoId: "biblioteca", multiplicidadOrigen: "0..*", multiplicidadDestino: "1" },
    ]
    const modelo = { ...creado.body.modelo, clases, relaciones }
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo }).expect(200)
    const recuperado = await request(app()).get(`/api/proyectos/${creado.body.id}`).expect(200)
    expect(recuperado.body.modelo).toEqual(modelo)
  })

  it("rechaza nombre duplicado sin distinguir mayúsculas", async () => {
    await request(app()).post("/api/proyectos").send({ nombre: "Ventas" }).expect(201)
    await request(app()).post("/api/proyectos").send({ nombre: "ventas" }).expect(409)
  })

  it("rechaza UUID inválido, proyecto ausente y modelo estructuralmente inválido", async () => {
    await request(app()).get("/api/proyectos/no-es-uuid").expect(400)
    await request(app()).get("/api/proyectos/11111111-1111-4111-8111-111111111111").expect(404)
    const creado = await request(app()).post("/api/proyectos").send({ nombre: "Válido" }).expect(201)
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo: { ...creado.body.modelo, clases: [{ id: "x" }] } }).expect(400)
  })

  it("rechaza ids duplicados, extremos inexistentes y posiciones no finitas", async () => {
    const creado = await request(app()).post("/api/proyectos").send({ nombre: "Estructura" }).expect(201)
    const base = creado.body.modelo
    const clase = { id: "c", nombre: "C", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [] }
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo: { ...base, clases: [clase, clase] } }).expect(400)
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo: { ...base, clases: [clase], relaciones: [{ id: "r", tipo: "asociacion", claseOrigenId: "c", claseDestinoId: "ausente", multiplicidadOrigen: null, multiplicidadDestino: null }] } }).expect(400)
    await request(app()).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo: { ...base, clases: [{ ...clase, posicion: { x: "NaN", y: 0 } }] } }).expect(400)
  })

  it("responde de forma controlada ante un archivo corrupto", async () => {
    await writeFile(join(directorio, "11111111-1111-4111-8111-111111111111.json"), "{invalido")
    const respuesta = await request(app()).get("/api/proyectos").expect(500)
    expect(respuesta.body.error).not.toContain(directorio)
  })
})
