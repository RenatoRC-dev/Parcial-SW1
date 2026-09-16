import request from "supertest"
import { describe, expect, it } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import { exportarXmi, importarXmi } from "./AdaptadorCrunchUML.js"
import { fixtureInteroperabilidad } from "./fixtureInteroperabilidad.js"

function leerBinario(respuesta: NodeJS.ReadableStream, callback: (error: Error | null, body?: Buffer) => void) {
  const fragmentos: Buffer[] = []
  respuesta.on("data", (fragmento: Buffer) => fragmentos.push(fragmento))
  respuesta.on("end", () => callback(null, Buffer.concat(fragmentos)))
}

describe("AdaptadorCrunchUML", () => {
  it("preserva clases, atributos, asociación, multiplicidades, roles, ids y posiciones", async () => {
    const xmi = await exportarXmi(fixtureInteroperabilidad)
    const resultado = await importarXmi(xmi.toString("utf8"))

    expect(resultado.modelo.id).toBe(fixtureInteroperabilidad.id)
    expect(resultado.modelo.clases.map((clase) => clase.nombre).sort()).toEqual(["Cliente", "Pedido"])
    expect(resultado.modelo.clases.find((clase) => clase.nombre === "Cliente")?.atributos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "EAID_CLIENTE_NOMBRE", nombre: "nombre", tipo: "String" }),
        expect.objectContaining({ id: "EAID_CLIENTE_EMAIL", nombre: "email", tipo: "String" }),
      ]),
    )
    expect(resultado.modelo.clases.find((clase) => clase.nombre === "Pedido")?.posicion).toEqual({ x: 450, y: 100 })
    expect(resultado.modelo.relaciones).toEqual([
      expect.objectContaining({
        id: "EAID_CLIENTE_PEDIDOS",
        tipo: "asociacion",
        claseOrigenId: "EAID_CLIENTE",
        claseDestinoId: "EAID_PEDIDO",
        multiplicidadOrigen: "1",
        multiplicidadDestino: "0..*",
        rolOrigen: "cliente",
        rolDestino: "pedidos",
      }),
    ])
  }, 30_000)

  it("rechaza XML malformado de forma controlada", async () => {
    await expect(importarXmi("<xmi:roto>")).rejects.toMatchObject({ tipo: "entrada" })
  }, 30_000)

  it("rechaza semántica canónica no soportada al exportar", async () => {
    await expect(
      exportarXmi({ ...fixtureInteroperabilidad, relaciones: [{ ...fixtureInteroperabilidad.relaciones[0], tipo: "composicion" }] }),
    ).rejects.toThrow(/no soportado/)
  }, 30_000)

  it("importa una clase independiente", async () => {
    const independiente = { ...fixtureInteroperabilidad, clases: [fixtureInteroperabilidad.clases[0]], relaciones: [] }
    const resultado = await importarXmi((await exportarXmi(independiente)).toString("utf8"))
    expect(resultado.modelo.clases).toHaveLength(1)
    expect(resultado.modelo.clases[0]).toMatchObject({ id: "EAID_CLIENTE", nombre: "Cliente" })
  }, 30_000)

  it("advierte y omite una enumeración fuera del perfil", async () => {
    const xmi = `<?xml version="1.0" encoding="UTF-8"?>
      <xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
        <uml:Model xmi:type="uml:Model" name="EA_Model">
          <packagedElement xmi:type="uml:Package" xmi:id="EAPK_TEST" name="Test">
            <packagedElement xmi:type="uml:Enumeration" xmi:id="EAID_ENUM" name="Estado" />
          </packagedElement>
        </uml:Model>
      </xmi:XMI>`
    const resultado = await importarXmi(xmi)
    expect(resultado.advertencias).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: "ENUMERACION_OMITIDA" }),
    ]))
    expect(resultado.modelo.clases).toEqual([])
  }, 30_000)
})

describe("API XMI", () => {
  const aplicacion = crearAplicacionGeneracionBackend()

  it("exporta XML descargable e importa el mismo XMI", async () => {
    const exportado = await request(aplicacion)
      .post("/api/interoperabilidad/xmi/exportar")
      .send(fixtureInteroperabilidad)
      .buffer(true)
      .parse(leerBinario)
      .expect(200)
      .expect("Content-Type", /application\/xml/)
      .expect("Content-Disposition", /modelo\.xmi/)

    const importado = await request(aplicacion)
      .post("/api/interoperabilidad/xmi/importar")
      .set("Content-Type", "application/xml")
      .send((exportado.body as Buffer).toString("utf8"))
      .expect(200)
    expect(importado.body.modelo.clases).toHaveLength(2)
    expect(importado.body.modelo.relaciones).toHaveLength(1)
  }, 30_000)

  it("devuelve 400 para XMI malformado", async () => {
    await request(aplicacion)
      .post("/api/interoperabilidad/xmi/importar")
      .set("Content-Type", "application/xml")
      .send("<xmi:roto>")
      .expect(400)
  }, 30_000)

  it("rechaza una carga mayor a 5 MB", async () => {
    const respuesta = await request(aplicacion)
      .post("/api/interoperabilidad/xmi/importar")
      .set("Content-Type", "application/xml")
      .send("x".repeat(5 * 1024 * 1024 + 1))
      .expect(413)

    expect(respuesta.body).toEqual({
      error: "El contenido de la solicitud supera el límite permitido.",
    })
  })
})
