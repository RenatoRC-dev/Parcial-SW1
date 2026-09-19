import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"
import { fixtureClientePedido } from "./fixtureClientePedido.js"
import { fixturePersonaAuto } from "./fixturePersonaAuto.js"
import { generarProyectoSpring } from "./GeneradorSpringBoot.js"
import { prepararProyectoSpring } from "./PrepararProyectoSpring.js"

const temporales: string[] = []
afterEach(async () => Promise.all(temporales.splice(0).map((ruta) => rm(ruta, { recursive: true, force: true }))))

function conRelacion(
  cambios: Partial<ModeloUMLCanonicoEntrada["relaciones"][number]>
): ModeloUMLCanonicoEntrada {
  return {
    ...fixtureClientePedido,
    relaciones: [{ ...fixtureClientePedido.relaciones[0], ...cambios }],
  }
}

describe("generación determinista de asociación uno-a-muchos", () => {
  it("mantiene Persona 1 — 0..* Auto y ubica la FK en Auto", async () => {
    const proyecto = prepararProyectoSpring(fixturePersonaAuto)
    const persona = proyecto.entidades.find((entidad) => entidad.nombreClase === "Persona")!
    const auto = proyecto.entidades.find((entidad) => entidad.nombreClase === "Auto")!
    expect(persona.relacionesUnoAMuchos).toEqual([{
      nombreCampo: "autos", entidadObjetivo: "Auto", mappedBy: "persona",
    }])
    expect(auto.relacionesMuchosAUno).toEqual([{
      nombreCampo: "persona", entidadObjetivo: "Persona", nombreColumna: "persona_id",
    }])

    const salida = await mkdtemp(join(tmpdir(), "sw1-persona-auto-"))
    temporales.push(salida)
    await generarProyectoSpring(fixturePersonaAuto, salida)
    const fuentePersona = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Persona.java"), "utf8")
    const fuenteAuto = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Auto.java"), "utf8")
    expect(fuentePersona).toContain('@OneToMany(mappedBy = "persona")')
    expect(fuentePersona).toContain("private List<Auto> autos = new ArrayList<>();")
    expect(fuenteAuto).toContain("@ManyToOne(optional = false)")
    expect(fuenteAuto).toContain('@JoinColumn(name = "persona_id", nullable = false)')
    expect(fuenteAuto).toContain("private Persona persona;")
  })

  it("prepara roles en la clase opuesta y asigna la FK al lado muchos", () => {
    const proyecto = prepararProyectoSpring(fixtureClientePedido)
    const cliente = proyecto.entidades.find((entidad) => entidad.nombreClase === "Cliente")!
    const pedido = proyecto.entidades.find((entidad) => entidad.nombreClase === "Pedido")!
    expect(cliente.relacionesUnoAMuchos).toEqual([{
      nombreCampo: "pedidos", entidadObjetivo: "Pedido", mappedBy: "cliente",
    }])
    expect(pedido.relacionesMuchosAUno).toEqual([{
      nombreCampo: "cliente", entidadObjetivo: "Cliente", nombreColumna: "cliente_id",
    }])
  })

  it("interpreta igual la orientación de extremos invertida", () => {
    const proyecto = prepararProyectoSpring(conRelacion({
      claseOrigenId: "pedido", claseDestinoId: "cliente",
      multiplicidadOrigen: "0..*", multiplicidadDestino: "1",
      rolOrigen: "pedidos", rolDestino: "cliente",
    }))
    const pedido = proyecto.entidades.find((entidad) => entidad.nombreClase === "Pedido")!
    expect(pedido.relacionesMuchosAUno[0]).toMatchObject({ nombreCampo: "cliente", entidadObjetivo: "Cliente" })
  })

  it("aplica nombres predeterminados deterministas sin roles", () => {
    const proyecto = prepararProyectoSpring(conRelacion({ rolOrigen: undefined, rolDestino: undefined }))
    const cliente = proyecto.entidades.find((entidad) => entidad.nombreClase === "Cliente")!
    const pedido = proyecto.entidades.find((entidad) => entidad.nombreClase === "Pedido")!
    expect(cliente.relacionesUnoAMuchos[0].nombreCampo).toBe("pedidos")
    expect(pedido.relacionesMuchosAUno[0].nombreCampo).toBe("cliente")
  })

  it("renderiza ManyToOne, JoinColumn, OneToMany y JsonIgnore sin cascada", async () => {
    const salida = await mkdtemp(join(tmpdir(), "sw1-relacion-"))
    temporales.push(salida)
    await generarProyectoSpring(fixtureClientePedido, salida)
    const cliente = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Cliente.java"), "utf8")
    const pedido = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Pedido.java"), "utf8")
    expect(cliente).toContain("@JsonIgnore")
    expect(cliente).toContain('@OneToMany(mappedBy = "cliente")')
    expect(cliente).toContain("private List<Pedido> pedidos = new ArrayList<>();")
    expect(pedido).toContain("@ManyToOne(optional = false)")
    expect(pedido).toContain('@JoinColumn(name = "cliente_id", nullable = false)')
    expect(pedido).toContain("private Cliente cliente;")
    expect(`${cliente}\n${pedido}`).not.toContain("CascadeType")
    expect(`${cliente}\n${pedido}`).not.toContain("orphanRemoval")
  })

  it("actualiza la relación propietaria en el servicio del lado muchos", async () => {
    const salida = await mkdtemp(join(tmpdir(), "sw1-relacion-servicio-"))
    temporales.push(salida)
    await generarProyectoSpring(fixtureClientePedido, salida)
    const servicio = await readFile(join(salida, "src/main/java/com/sw1/generated/servicio/impl/PedidoServiceImpl.java"), "utf8")
    expect(servicio).toContain("existente.setCliente(pedido.getCliente());")
  })

  it.each([
    ["uno a uno", conRelacion({ multiplicidadDestino: "1" })],
    ["muchos a muchos", conRelacion({ multiplicidadOrigen: "0..*" })],
    ["mínimo uno", conRelacion({ multiplicidadDestino: "1..*" })],
  ])("rechaza multiplicidad no soportada: %s", (_nombre, modelo) => {
    expect(() => prepararProyectoSpring(modelo)).toThrow("multiplicidades 1 y 0..*")
  })

  it.each(["agregacion", "composicion", "generalizacion"] as const)(
    "rechaza el tipo %s",
    (tipo) => expect(() => prepararProyectoSpring(conRelacion({ tipo }))).toThrow("no está soportada")
  )

  it("rechaza autorrelaciones", () => {
    expect(() => prepararProyectoSpring(conRelacion({ claseDestinoId: "cliente" }))).toThrow("autorreferente")
  })

  it("rechaza colisión con un atributo escalar", () => {
    const modelo: ModeloUMLCanonicoEntrada = {
      ...fixtureClientePedido,
      clases: fixtureClientePedido.clases.map((clase) =>
        clase.id === "pedido"
          ? { ...clase, atributos: [...clase.atributos, { id: "cliente-campo", nombre: "cliente", tipo: "String" }] }
          : clase
      ),
    }
    expect(() => prepararProyectoSpring(modelo)).toThrow("campo de relación cliente colisiona en Pedido")
  })

  it("rechaza colisión entre campos producidos por dos relaciones", () => {
    const modelo: ModeloUMLCanonicoEntrada = {
      ...fixtureClientePedido,
      relaciones: [
        fixtureClientePedido.relaciones[0],
        { ...fixtureClientePedido.relaciones[0], id: "cliente-pedidos-duplicada" },
      ],
    }
    expect(() => prepararProyectoSpring(modelo)).toThrow("campo de relación cliente colisiona en Pedido")
  })
})
