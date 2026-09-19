import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { generarProyectoSpring } from "./GeneradorSpringBoot.js"
import { fixtureCliente } from "./fixtureCliente.js"
import { fixtureClientePedido } from "./fixtureClientePedido.js"
import {
  convertirASnakeCase,
  mapearTipoJava,
  prepararProyectoSpring,
} from "./PrepararProyectoSpring.js"

const temporales: string[] = []

async function directorioTemporal(): Promise<string> {
  const directorio = await mkdtemp(join(tmpdir(), "sw1-generador-"))
  temporales.push(directorio)
  return directorio
}

async function leer(salida: string, ruta: string): Promise<string> {
  return readFile(join(salida, ruta), "utf8")
}

afterEach(async () => {
  await Promise.all(
    temporales.splice(0).map((directorio) =>
      rm(directorio, { recursive: true, force: true })
    )
  )
})

describe("GeneradorSpringBoot", () => {
  it("genera todos los archivos del proyecto Cliente", async () => {
    const salida = await directorioTemporal()
    const archivos = await generarProyectoSpring(fixtureCliente, salida)

    expect(archivos).toEqual(
      expect.arrayContaining([
        "pom.xml",
        "src/main/java/com/sw1/generated/BackendGeneradoApplication.java",
        "src/main/java/com/sw1/generated/modelo/Cliente.java",
        "src/main/java/com/sw1/generated/repositorio/ClienteRepository.java",
        "src/main/java/com/sw1/generated/servicio/ClienteService.java",
        "src/main/java/com/sw1/generated/servicio/impl/ClienteServiceImpl.java",
        "src/main/java/com/sw1/generated/controlador/ClienteController.java",
        "src/main/resources/application.properties",
      ])
    )
  })

  it("genera una entidad JPA con identidad y atributos escalares", async () => {
    const salida = await directorioTemporal()
    await generarProyectoSpring(fixtureCliente, salida)
    const entidad = await leer(
      salida,
      "src/main/java/com/sw1/generated/modelo/Cliente.java"
    )

    expect(entidad).toContain("@Entity")
    expect(entidad).toContain("private Long id;")
    expect(entidad).toContain("private String nombre;")
    expect(entidad).toContain("private String email;")
    expect(entidad).toContain("private Integer edad;")
  })

  it("reutiliza id Long explícito sin duplicar la identidad generada", async () => {
    const salida = await directorioTemporal()
    const modelo = {
      ...fixtureCliente,
      clases: fixtureCliente.clases.map((clase) => ({
        ...clase,
        atributos: [
          { id: "cliente-id", nombre: "id", tipo: "Long" },
          ...clase.atributos,
        ],
      })),
    }
    await generarProyectoSpring(modelo, salida)
    const entidad = await leer(salida, "src/main/java/com/sw1/generated/modelo/Cliente.java")

    expect(entidad.match(/@Id\b/g)).toHaveLength(1)
    expect(entidad.match(/private Long id;/g)).toHaveLength(1)
    expect(entidad).toContain("private String nombre;")
  })

  it("rechaza un id explícito cuyo tipo no sea Long", () => {
    const modelo = {
      ...fixtureCliente,
      clases: fixtureCliente.clases.map((clase) => ({
        ...clase,
        atributos: [{ id: "cliente-id", nombre: "id", tipo: "String" }],
      })),
    }

    expect(() => prepararProyectoSpring(modelo)).toThrow("debe utilizar el tipo Long")
  })

  it("genera Repository, Service, ServiceImpl y Controller CRUD", async () => {
    const salida = await directorioTemporal()
    await generarProyectoSpring(fixtureCliente, salida)
    const repository = await leer(
      salida,
      "src/main/java/com/sw1/generated/repositorio/ClienteRepository.java"
    )
    const servicio = await leer(
      salida,
      "src/main/java/com/sw1/generated/servicio/ClienteService.java"
    )
    const implementacion = await leer(
      salida,
      "src/main/java/com/sw1/generated/servicio/impl/ClienteServiceImpl.java"
    )
    const controlador = await leer(
      salida,
      "src/main/java/com/sw1/generated/controlador/ClienteController.java"
    )

    expect(repository).toContain("extends JpaRepository<Cliente, Long>")
    expect(servicio).toContain("List<Cliente> listar()")
    expect(implementacion).toContain("implements ClienteService")
    expect(controlador).toContain('@RequestMapping("/api/cliente")')
    expect(controlador).toContain("@PostMapping")
    expect(controlador).toContain("@GetMapping")
    expect(controlador).toContain("@PutMapping")
    expect(controlador).toContain("@DeleteMapping")
  })

  it("genera el pom con el perfil Spring y PostgreSQL requerido", async () => {
    const salida = await directorioTemporal()
    await generarProyectoSpring(fixtureCliente, salida)
    const pom = await leer(salida, "pom.xml")

    expect(pom).toContain("spring-boot-starter-web")
    expect(pom).toContain("spring-boot-starter-data-jpa")
    expect(pom).toContain("spring-boot-starter-validation")
    expect(pom).toContain("postgresql")
    expect(pom).toContain("spring-boot-starter-test")
    expect(pom).toContain("<java.version>21</java.version>")
  })

  it("aplica nombres snake_case deterministas", () => {
    expect(convertirASnakeCase("DetallePedido")).toBe("detalle_pedido")
    expect(convertirASnakeCase("fechaCreacion")).toBe("fecha_creacion")
  })

  it.each([
    ["String", "String"],
    ["int", "Integer"],
    ["Decimal", "BigDecimal"],
    ["Date", "LocalDate"],
    ["DateTime", "LocalDateTime"],
    ["UUID", "UUID"],
  ])("mapea el tipo %s a %s", (canonico, java) => {
    expect(mapearTipoJava(canonico)).toBe(java)
  })

  it("rechaza tipos desconocidos antes de renderizar", () => {
    expect(() =>
      prepararProyectoSpring({
        ...fixtureCliente,
        clases: [
          {
            ...fixtureCliente.clases[0],
            atributos: [{ id: "saldo", nombre: "saldo", tipo: "Money" }],
          },
        ],
      })
    ).toThrow("Tipo no soportado")
  })

  it("rechaza relaciones 1 a 1 para no reinterpretarlas silenciosamente", () => {
    expect(() =>
      prepararProyectoSpring({
        ...fixtureClientePedido,
        relaciones: [
          {
            id: "r1",
            tipo: "asociacion",
            claseOrigenId: "cliente",
            claseDestinoId: "pedido",
            multiplicidadOrigen: "1",
            multiplicidadDestino: "1",
          },
        ],
      })
    ).toThrow("multiplicidades 1 y 0..*")
  })
})
