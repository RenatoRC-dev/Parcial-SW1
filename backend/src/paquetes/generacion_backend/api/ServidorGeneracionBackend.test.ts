import JSZip from "jszip"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { fixtureCliente } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureCliente.js"
import { fixtureClientePedido } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureClientePedido.js"
import { crearAplicacionGeneracionBackend } from "./ServidorGeneracionBackend.js"

function leerBinario(respuesta: NodeJS.ReadableStream, callback: (error: Error | null, body?: Buffer) => void) {
  const fragmentos: Buffer[] = []
  respuesta.on("data", (fragmento: Buffer) => fragmentos.push(fragmento))
  respuesta.on("end", () => callback(null, Buffer.concat(fragmentos)))
}

describe("API de generación", () => {
  const aplicacion = crearAplicacionGeneracionBackend()

  it("expone salud", async () => {
    await request(aplicacion).get("/api/health").expect(200, { estado: "ok" })
    await request(aplicacion).get("/health").expect(200, { status: "ok" })
  })

  it("habilita CORS sólo para localhost o el origen configurado", async () => {
    const original = process.env.FRONTEND_ORIGIN
    process.env.FRONTEND_ORIGIN = "https://nexocase.onrender.com"
    try {
      const configurada = crearAplicacionGeneracionBackend()
      await request(configurada)
        .options("/api/proyectos")
        .set("Origin", "https://nexocase.onrender.com")
        .expect(204)
        .expect("Access-Control-Allow-Origin", "https://nexocase.onrender.com")
      await request(configurada)
        .options("/api/proyectos")
        .set("Origin", "https://origen-no-permitido.example")
        .expect(403)
    } finally {
      if (original === undefined) delete process.env.FRONTEND_ORIGIN
      else process.env.FRONTEND_ORIGIN = original
    }
  })

  it("rechaza cuerpos malformados", async () => {
    await request(aplicacion).post("/api/generacion/spring").send({ clases: "no" }).expect(400)
  })

  it("responde con un mensaje genérico ante JSON sobredimensionado", async () => {
    const respuesta = await request(aplicacion)
      .post("/api/generacion/spring")
      .send({ contenido: "x".repeat(1024 * 1024) })
      .expect(413)

    expect(respuesta.body).toEqual({
      error: "El contenido de la solicitud supera el límite permitido.",
    })
  })

  it("rechaza atributos anidados malformados con 400", async () => {
    const atributoNulo = {
      ...fixtureCliente,
      clases: [{ ...fixtureCliente.clases[0], atributos: [null] }],
    }
    const tipoInvalido = {
      ...fixtureCliente,
      clases: [{ ...fixtureCliente.clases[0], atributos: [{ id: "a", nombre: "dato", tipo: 42 }] }],
    }
    await request(aplicacion).post("/api/generacion/spring").send(atributoNulo).expect(400)
    await request(aplicacion).post("/api/generacion/spring").send(tipoInvalido).expect(400)
  })

  it("acepta métodos UML válidos como semántica de diseño y rechaza su estructura inválida", async () => {
    const conMetodo = { ...fixtureCliente, clases: fixtureCliente.clases.map((clase) => ({ ...clase, metodos: [{ id: "m1", nombre: "cambiarNombre", visibilidad: "publica", tipoRetorno: "void", parametros: [{ id: "p1", nombre: "nombre", tipo: "String" }] }] })) }
    const respuesta = await request(aplicacion).post("/api/generacion/spring").send(conMetodo).buffer(true).parse(leerBinario).expect(200)
    const zip = await JSZip.loadAsync(respuesta.body as Buffer)
    const entidad = await zip.file("backend-generado/src/main/java/com/sw1/generated/modelo/Cliente.java")!.async("string")
    expect(entidad).not.toContain("cambiarNombre")

    const invalido = { ...fixtureCliente, clases: fixtureCliente.clases.map((clase) => ({ ...clase, metodos: [{ id: "m1", nombre: "x", visibilidad: "publica", tipoRetorno: "void", parametros: [null] }] })) }
    await request(aplicacion).post("/api/generacion/spring").send(invalido).expect(400)
  })

  it("rechaza relaciones anidadas malformadas con 400", async () => {
    const tipoDesconocido = {
      ...fixtureCliente,
      relaciones: [{ id: "r", tipo: "dependencia", claseOrigenId: "cliente", claseDestinoId: "cliente" }],
    }
    await request(aplicacion).post("/api/generacion/spring").send(tipoDesconocido).expect(400)

    const multiplicidadMalformada = {
      ...fixtureClientePedido,
      relaciones: [{ ...fixtureClientePedido.relaciones[0], multiplicidadDestino: "*" }],
    }
    const rolMalformado = {
      ...fixtureClientePedido,
      relaciones: [{ ...fixtureClientePedido.relaciones[0], rolOrigen: 42 }],
    }
    await request(aplicacion).post("/api/generacion/spring").send(multiplicidadMalformada).expect(400)
    await request(aplicacion).post("/api/generacion/spring").send(rolMalformado).expect(400)
  })

  it("rechaza relaciones y clases abstractas con 400", async () => {
    const relacion = { ...fixtureCliente, relaciones: [{ id: "r", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "cliente", multiplicidadOrigen: "1", multiplicidadDestino: "1" }] }
    const abstracta = { ...fixtureCliente, clases: [{ ...fixtureCliente.clases[0], abstracta: true }] }
    await request(aplicacion).post("/api/generacion/spring").send(relacion).expect(400)
    await request(aplicacion).post("/api/generacion/spring").send(abstracta).expect(400)
  })

  it("rechaza ids canónicos duplicados con 400 y no con 500", async () => {
    const idsDuplicados = {
      ...fixtureClientePedido,
      clases: fixtureClientePedido.clases.map((clase, indice) =>
        indice === 1 ? { ...clase, id: "cliente" } : clase
      ),
    }
    const respuesta = await request(aplicacion)
      .post("/api/generacion/spring")
      .send(idsDuplicados)
      .expect(400)
    expect(respuesta.body.error).toBe("Modelo no apto para generación.")
    expect(respuesta.body.errores).toContain("Id de clase duplicado: cliente.")
  })

  it("genera por HTTP una asociación 1 a 0..* y entrega las dos entidades JPA", async () => {
    const respuesta = await request(aplicacion)
      .post("/api/generacion/spring")
      .send(fixtureClientePedido)
      .buffer(true)
      .parse(leerBinario)
      .expect(200)
    const zip = await JSZip.loadAsync(respuesta.body as Buffer)
    const cliente = await zip.file("backend-generado/src/main/java/com/sw1/generated/modelo/Cliente.java")!.async("string")
    const pedido = await zip.file("backend-generado/src/main/java/com/sw1/generated/modelo/Pedido.java")!.async("string")
    expect(cliente).toContain('@OneToMany(mappedBy = "cliente")')
    expect(cliente).toContain("private List<Pedido> pedidos")
    expect(cliente).toContain("@JsonIgnore")
    expect(pedido).toContain("@ManyToOne(optional = false)")
    expect(pedido).toContain('@JoinColumn(name = "cliente_id", nullable = false)')
    expect(pedido).toContain("private Cliente cliente")
  })

  it("rechaza por dominio una agregación bien formada con 400", async () => {
    const agregacion = {
      ...fixtureClientePedido,
      relaciones: [{ ...fixtureClientePedido.relaciones[0], tipo: "agregacion" }],
    }
    const respuesta = await request(aplicacion).post("/api/generacion/spring").send(agregacion).expect(400)
    expect(respuesta.body.error).toBe("Modelo no apto para generación.")
  })

  it("devuelve un ZIP descargable con el proyecto Spring", async () => {
    const respuesta = await request(aplicacion)
      .post("/api/generacion/spring")
      .send(fixtureCliente)
      .buffer(true)
      .parse(leerBinario)
      .expect(200)
      .expect("Content-Type", /application\/zip/)
      .expect("Content-Disposition", /backend-generado\.zip/)
    const zip = await JSZip.loadAsync(respuesta.body as Buffer)
    const nombres = Object.keys(zip.files)
    expect(nombres).toContain("backend-generado/pom.xml")
    expect(nombres).toContain("backend-generado/src/main/java/com/sw1/generated/modelo/Cliente.java")
    expect(nombres.some((nombre) => nombre.includes("/target/"))).toBe(false)
  })
})
