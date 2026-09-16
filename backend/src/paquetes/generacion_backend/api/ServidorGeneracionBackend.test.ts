import JSZip from "jszip"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { fixtureCliente } from "../casos_uso/cu09_generar_backend_spring_boot/fixtureCliente.js"
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
  })

  it("rechaza cuerpos malformados", async () => {
    await request(aplicacion).post("/api/generacion/spring").send({ clases: "no" }).expect(400)
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

  it("rechaza relaciones anidadas malformadas con 400", async () => {
    const tipoDesconocido = {
      ...fixtureCliente,
      relaciones: [{ id: "r", tipo: "dependencia", claseOrigenId: "cliente", claseDestinoId: "cliente" }],
    }
    await request(aplicacion).post("/api/generacion/spring").send(tipoDesconocido).expect(400)
  })

  it("rechaza relaciones y clases abstractas con 400", async () => {
    const relacion = { ...fixtureCliente, relaciones: [{ id: "r", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "cliente" }] }
    const abstracta = { ...fixtureCliente, clases: [{ ...fixtureCliente.clases[0], abstracta: true }] }
    await request(aplicacion).post("/api/generacion/spring").send(relacion).expect(400)
    await request(aplicacion).post("/api/generacion/spring").send(abstracta).expect(400)
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
