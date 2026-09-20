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

  it("deriva propiedades y FK desde las clases, nunca desde el nombre de asociación", async () => {
    const clase = (id: string, nombre: string) => ({
      id, nombre, abstracta: false, atributos: [{ id: `${id}-id`, nombre: "id", tipo: "Long" as const }],
    })
    const modelo: ModeloUMLCanonicoEntrada = {
      id: "ventas", nombre: "Ventas", version: "1",
      clases: [
        clase("cliente", "Cliente"), clase("metodo", "MetodoPago"), clase("factura", "Factura"),
        clase("detalle", "DetalleFactura"), clase("categoria", "Categoria"), clase("producto", "Producto"),
      ],
      relaciones: [
        { id: "r1", nombre: "tiene", tipo: "asociacion", claseOrigenId: "cliente", claseDestinoId: "factura", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
        { id: "r2", nombre: "utiliza", tipo: "asociacion", claseOrigenId: "metodo", claseDestinoId: "factura", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
        { id: "r3", nombre: "contiene", tipo: "asociacion", claseOrigenId: "factura", claseDestinoId: "detalle", multiplicidadOrigen: "1", multiplicidadDestino: "1..*" },
        { id: "r4", nombre: "clasifica", tipo: "asociacion", claseOrigenId: "categoria", claseDestinoId: "producto", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
        { id: "r5", nombre: "apareceEn", tipo: "asociacion", claseOrigenId: "producto", claseDestinoId: "detalle", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" },
      ],
    }
    const salida = await mkdtemp(join(tmpdir(), "sw1-nombres-relacion-"))
    temporales.push(salida)
    await generarProyectoSpring(modelo, salida)
    const factura = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Factura.java"), "utf8")
    const detalle = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/DetalleFactura.java"), "utf8")
    const producto = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Producto.java"), "utf8")
    const fuentes = `${factura}\n${detalle}\n${producto}`

    expect(factura).toContain("private Cliente cliente;")
    expect(factura).toContain("private MetodoPago metodoPago;")
    expect(detalle).toContain("private Factura factura;")
    expect(detalle).toContain("private Producto producto;")
    expect(producto).toContain("private Categoria categoria;")
    expect(fuentes).toContain('@JoinColumn(name = "cliente_id", nullable = false)')
    expect(fuentes).toContain('@JoinColumn(name = "metodo_pago_id", nullable = false)')
    expect(fuentes).toContain('@JoinColumn(name = "factura_id", nullable = false)')
    expect(fuentes).toContain('@JoinColumn(name = "producto_id", nullable = false)')
    expect(fuentes).toContain('@JoinColumn(name = "categoria_id", nullable = false)')
    expect(fuentes).not.toMatch(/(?:tiene|contiene|aparece_en|clasifica)_id/)
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

  it("genera Factura 1 — 1..* DetalleFactura con la FK en DetalleFactura", async () => {
    const modelo = conRelacion({
      id: "relacion-uuid-interna", nombre: "contiene", multiplicidadDestino: "1..*",
      rolOrigen: "factura", rolDestino: "detalles",
    })
    modelo.clases = modelo.clases.map((clase) => clase.id === "cliente"
      ? { ...clase, nombre: "Factura" }
      : { ...clase, nombre: "DetalleFactura" })
    const proyecto = prepararProyectoSpring(modelo)
    expect(proyecto.entidades.find((entidad) => entidad.nombreClase === "Factura")?.relacionesUnoAMuchos).toEqual([{
      nombreCampo: "detalles", entidadObjetivo: "DetalleFactura", mappedBy: "factura",
    }])
    expect(proyecto.entidades.find((entidad) => entidad.nombreClase === "DetalleFactura")?.relacionesMuchosAUno).toEqual([{
      nombreCampo: "factura", entidadObjetivo: "Factura", nombreColumna: "factura_id",
    }])

    const salida = await mkdtemp(join(tmpdir(), "sw1-factura-detalle-"))
    temporales.push(salida)
    await generarProyectoSpring(modelo, salida)
    const factura = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Factura.java"), "utf8")
    const detalle = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/DetalleFactura.java"), "utf8")
    expect(factura).toContain('@OneToMany(mappedBy = "factura")')
    expect(factura).toContain("private List<DetalleFactura> detalles = new ArrayList<>();")
    expect(detalle).toContain("@ManyToOne(optional = false)")
    expect(detalle).toContain('@JoinColumn(name = "factura_id", nullable = false)')
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
  ])("rechaza multiplicidad no soportada: %s", (_nombre, modelo) => {
    expect(() => prepararProyectoSpring(modelo)).toThrow("Actualmente se soportan 1 ↔ 0..* y 1 ↔ 1..*")
  })

  it("explica un N:M directo sin exponer el id interno", () => {
    const modelo = conRelacion({ id: "relacion-uuid-interna", multiplicidadOrigen: "0..*", multiplicidadDestino: "0..*" })
    expect(() => prepararProyectoSpring(modelo)).toThrow("Cliente (0..*) ↔ Pedido (0..*) representa un N:M directo")
    try {
      prepararProyectoSpring(modelo)
    } catch (error) {
      expect(String(error)).toContain("convertirla explícitamente en una clase asociativa")
      expect(String(error)).not.toContain("relacion-uuid-interna")
    }
  })

  it.each(["agregacion", "composicion", "generalizacion"] as const)(
    "rechaza el tipo %s",
    (tipo) => expect(() => prepararProyectoSpring(conRelacion({ tipo }))).toThrow("no pertenece al perfil de generación Spring")
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
