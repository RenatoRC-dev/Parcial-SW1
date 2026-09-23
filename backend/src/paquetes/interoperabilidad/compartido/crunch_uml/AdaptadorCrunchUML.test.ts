import request from "supertest"
import { describe, expect, it } from "vitest"
import { crearAplicacionGeneracionBackend } from "../../../generacion_backend/api/ServidorGeneracionBackend.js"
import { exportarXmi, importarXmi, validarAptitudExportacionXmi } from "./AdaptadorCrunchUML.js"
import { fixtureInteroperabilidad } from "./fixtureInteroperabilidad.js"

function leerBinario(respuesta: NodeJS.ReadableStream, callback: (error: Error | null, body?: Buffer) => void) {
  const fragmentos: Buffer[] = []
  respuesta.on("data", (fragmento: Buffer) => fragmentos.push(fragmento))
  respuesta.on("end", () => callback(null, Buffer.concat(fragmentos)))
}

describe("AdaptadorCrunchUML", () => {
  it("preserva clases, atributos, asociación, multiplicidades, roles, ids y posiciones", async () => {
    const xmi = await exportarXmi(fixtureInteroperabilidad)
    expect(xmi.toString("utf8")).not.toMatch(/isNavigable="true"/)
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

  it("preserva visibilidad UML explícita en exportación e importación XMI", async () => {
    const modelo = {
      ...fixtureInteroperabilidad,
      clases: fixtureInteroperabilidad.clases.map((clase) => clase.id === "EAID_CLIENTE" ? {
        ...clase,
        atributos: [
          { ...clase.atributos[0], visibilidad: "publica" as const },
          { ...clase.atributos[1], visibilidad: "protegida" as const },
        ],
      } : {
        ...clase,
        atributos: [{ ...clase.atributos[0], visibilidad: "paquete" as const }],
      }),
    }
    const xmi = (await exportarXmi(modelo)).toString("utf8")
    expect(xmi).toMatch(/xmi:id="EAID_CLIENTE_NOMBRE"[^>]*visibility="public"/)
    expect(xmi).toMatch(/xmi:id="EAID_CLIENTE_EMAIL"[^>]*visibility="protected"/)
    expect(xmi).toMatch(/xmi:id="EAID_PEDIDO_FECHA"[^>]*visibility="package"/)

    const resultado = await importarXmi(xmi)
    expect(resultado.modelo.clases.find((clase) => clase.id === "EAID_CLIENTE")?.atributos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "EAID_CLIENTE_NOMBRE", visibilidad: "publica" }),
      expect.objectContaining({ id: "EAID_CLIENTE_EMAIL", visibilidad: "protegida" }),
    ]))
    expect(resultado.modelo.clases.find((clase) => clase.id === "EAID_PEDIDO")?.atributos[0]).toEqual(expect.objectContaining({ visibilidad: "paquete" }))
  }, 30_000)

  it("no inventa visibilidad al exportar atributos históricos sin valor", async () => {
    const xmi = (await exportarXmi(fixtureInteroperabilidad)).toString("utf8")
    const atributoNombre = xmi.match(/<ownedAttribute[^>]*xmi:id="EAID_CLIENTE_NOMBRE"[^>]*>/)?.[0]
    expect(atributoNombre).toBeDefined()
    expect(atributoNombre).not.toContain("visibility=")
  }, 30_000)

  it("rechaza métodos fuera del perfil XMI en lugar de descartarlos silenciosamente", async () => {
    const conMetodo = {
      ...fixtureInteroperabilidad,
      clases: fixtureInteroperabilidad.clases.map((clase, indice) => indice === 0 ? {
        ...clase,
        metodos: [{ id: "descuento", nombre: "calcularDescuento", visibilidad: "publica" as const, tipoRetorno: "Double", parametros: [{ id: "total", nombre: "total", tipo: "Double" }] }],
      } : clase),
    }
    expect(validarAptitudExportacionXmi(conMetodo)).toEqual(expect.arrayContaining([expect.stringContaining("métodos UML")]))
    await expect(exportarXmi(conMetodo)).rejects.toThrow(/métodos UML/)
  }, 30_000)

  it("advierte cuando una importación XMI contiene métodos no soportados", async () => {
    const exportado = (await exportarXmi({ ...fixtureInteroperabilidad, relaciones: [] })).toString("utf8")
    const conMetodo = exportado.replace(
      "</packagedElement>",
      '<ownedOperation xmi:type="uml:Operation" xmi:id="OP_DESCUENTO" name="calcularDescuento"/></packagedElement>',
    )
    const resultado = await importarXmi(conMetodo)
    expect(resultado.advertencias).toContainEqual(expect.objectContaining({ codigo: "METODOS_OMITIDOS" }))
    expect(resultado.modelo.clases.flatMap((clase) => clase.metodos ?? [])).toEqual([])
  }, 30_000)

  it("rechaza XML malformado de forma controlada", async () => {
    await expect(importarXmi("<xmi:roto>")).rejects.toMatchObject({ tipo: "entrada" })
  }, 30_000)

  it("rechaza semántica canónica no soportada al exportar", async () => {
    const modelo = { ...fixtureInteroperabilidad, relaciones: [{ ...fixtureInteroperabilidad.relaciones[0], id: "relacion-uuid-interna", tipo: "composicion" as const }] }
    const mensaje = validarAptitudExportacionXmi(modelo).join(" ")
    expect(mensaje).toMatch(/Cliente \(1\) ↔ Pedido \(0\.\.\*\).*perfil XMI/)
    expect(mensaje).not.toContain("relacion-uuid-interna")
    await expect(
      exportarXmi(modelo),
    ).rejects.toThrow(/Cliente \(1\) ↔ Pedido \(0\.\.\*\).*perfil XMI/)
  }, 30_000)

  it("exporta e importa Factura 1 — 1..* DetalleFactura sin aplicar el perfil Spring", async () => {
    const modelo = {
      ...fixtureInteroperabilidad,
      clases: fixtureInteroperabilidad.clases.map((clase) => clase.id === "EAID_CLIENTE"
        ? { ...clase, nombre: "Factura" }
        : { ...clase, nombre: "DetalleFactura" }),
      relaciones: [{
        ...fixtureInteroperabilidad.relaciones[0],
        nombre: "contiene",
        multiplicidadOrigen: "1" as const,
        multiplicidadDestino: "1..*" as const,
      }],
    }
    const resultado = await importarXmi((await exportarXmi(modelo)).toString("utf8"))
    expect(resultado.modelo.relaciones[0]).toMatchObject({
      claseOrigenId: "EAID_CLIENTE",
      claseDestinoId: "EAID_PEDIDO",
      multiplicidadOrigen: "1",
      multiplicidadDestino: "1..*",
    })
  }, 30_000)

  it("mantiene exportable un N:M directo aunque CU09 no lo genere", async () => {
    const modelo = {
      ...fixtureInteroperabilidad,
      relaciones: [{ ...fixtureInteroperabilidad.relaciones[0], multiplicidadOrigen: "0..*" as const }],
    }
    const resultado = await importarXmi((await exportarXmi(modelo)).toString("utf8"))
    expect(resultado.modelo.relaciones[0]).toMatchObject({ multiplicidadOrigen: "0..*", multiplicidadDestino: "0..*" })
  }, 30_000)

  it("importa una clase independiente", async () => {
    const independiente = { ...fixtureInteroperabilidad, clases: [fixtureInteroperabilidad.clases[0]], relaciones: [] }
    const resultado = await importarXmi((await exportarXmi(independiente)).toString("utf8"))
    expect(resultado.modelo.clases).toHaveLength(1)
    expect(resultado.modelo.clases[0]).toMatchObject({ id: "EAID_CLIENTE", nombre: "Cliente" })
  }, 30_000)

  it("conserva atributos sin tipo y emite una sola advertencia resumida", async () => {
    const incompleto = {
      ...fixtureInteroperabilidad,
      clases: [{ ...fixtureInteroperabilidad.clases[0], atributos: [
        { id: "EAID_CLIENTE_NOMBRE", nombre: "nombre", tipo: null },
        { id: "EAID_CLIENTE_EMAIL", nombre: "email", tipo: null },
      ] }],
      relaciones: [],
    }
    const resultado = await importarXmi((await exportarXmi(incompleto)).toString("utf8"))

    expect(resultado.modelo.clases[0].atributos).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: "nombre", tipo: null }),
      expect.objectContaining({ nombre: "email", tipo: null }),
    ]))
    expect(resultado.advertencias.filter((item) => item.codigo === "ATRIBUTOS_SIN_TIPO")).toEqual([
      expect.objectContaining({ mensaje: expect.stringContaining("2 atributos sin tipo definido") }),
    ])
    expect(resultado.advertencias.map((item) => item.mensaje).join(" ")).not.toContain("EAID_")
  }, 30_000)

  it.each([
    ["shared", "agregacion"],
    ["composite", "composicion"],
  ] as const)("importa aggregation=%s con el Todo en destino canónico", async (aggregation, tipo) => {
    const exportado = (await exportarXmi(fixtureInteroperabilidad)).toString("utf8")
    const xmiTodoCliente = exportado.replace(
      'association="EAID_CLIENTE_PEDIDOS">',
      `association="EAID_CLIENTE_PEDIDOS" aggregation="${aggregation}">`,
    )
    const resultado = await importarXmi(xmiTodoCliente)

    expect(resultado.modelo.relaciones).toEqual([
      expect.objectContaining({
        tipo,
        claseOrigenId: "EAID_PEDIDO",
        claseDestinoId: "EAID_CLIENTE",
        multiplicidadOrigen: "0..*",
        multiplicidadDestino: "1",
        rolOrigen: "pedidos",
        rolDestino: "cliente",
      }),
    ])
  }, 30_000)

  it("conserva una generalización UML aunque CU09 no pueda generarla", async () => {
    const exportado = (await exportarXmi({ ...fixtureInteroperabilidad, relaciones: [] })).toString("utf8")
    const conGeneralizacion = exportado.replace(
      "</packagedElement>",
      '<generalization xmi:type="uml:Generalization" xmi:id="GEN_CLIENTE_PEDIDO" general="EAID_PEDIDO"/></packagedElement>',
    )
    const resultado = await importarXmi(conGeneralizacion)

    expect(resultado.modelo.relaciones).toContainEqual(expect.objectContaining({
      id: "GEN_CLIENTE_PEDIDO",
      tipo: "generalizacion",
      claseOrigenId: "EAID_CLIENTE",
      claseDestinoId: "EAID_PEDIDO",
    }))
  }, 30_000)

  it("preserva la abstracción declarada por una clase EA", async () => {
    const exportado = (await exportarXmi({ ...fixtureInteroperabilidad, relaciones: [] })).toString("utf8")
    const abstracto = exportado.replace(
      'xmi:id="EAID_CLIENTE" name="Cliente" visibility="public"',
      'xmi:id="EAID_CLIENTE" name="Cliente" visibility="public" isAbstract="true"',
    )
    const resultado = await importarXmi(abstracto)

    expect(resultado.modelo.clases.find((clase) => clase.id === "EAID_CLIENTE")?.abstracta).toBe(true)
  }, 30_000)

  it("rechaza como corrupción estructural una relación hacia una clase inexistente", async () => {
    const exportado = (await exportarXmi(fixtureInteroperabilidad)).toString("utf8")
    const corrupto = exportado.replace(
      '<type xmi:idref="EAID_PEDIDO"/>',
      '<type xmi:idref="EAID_INEXISTENTE"/>',
    )

    await expect(importarXmi(corrupto)).rejects.toMatchObject({ tipo: "entrada" })
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
