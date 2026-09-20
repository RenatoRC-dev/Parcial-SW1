import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { generarProyectoSpring } from "./GeneradorSpringBoot.js"
import { prepararProyectoSpring } from "./PrepararProyectoSpring.js"
import { fixtureInscripcion, fixtureUsuarioRol } from "./fixtureClaseAsociativa.js"

const temporales: string[] = []
async function salidaTemporal() {
  const salida = await mkdtemp(join(tmpdir(), "sw1-asociativa-"))
  temporales.push(salida)
  return salida
}
afterEach(async () => Promise.all(temporales.splice(0).map((ruta) => rm(ruta, { recursive: true, force: true }))))

describe("generación de clase asociativa", () => {
  it("deriva dos FK como clave compuesta sin id sustituto", async () => {
    const salida = await salidaTemporal()
    await generarProyectoSpring(fixtureUsuarioRol, salida)
    const leer = (archivo: string) => readFile(join(salida, "src/main/java/com/sw1/generated", archivo), "utf8")
    const clave = await leer("modelo/UsuarioRolId.java")
    const entidad = await leer("modelo/UsuarioRol.java")
    const repositorio = await leer("repositorio/UsuarioRolRepository.java")
    const servicio = await leer("servicio/UsuarioRolService.java")
    const controlador = await leer("controlador/UsuarioRolController.java")

    expect(clave).toContain("@Embeddable")
    expect(clave).toContain("implements Serializable")
    expect(clave).toContain("public UsuarioRolId()")
    expect(clave).toContain("boolean equals(Object otro)")
    expect(clave).toContain("int hashCode()")
    expect(clave).toContain("private Long usuarioId;")
    expect(clave).toContain("private Long rolId;")
    expect(entidad.match(/@EmbeddedId/g)).toHaveLength(1)
    expect(entidad).toContain("private UsuarioRolId id = new UsuarioRolId();")
    const propiedadesClave = [...clave.matchAll(/private Long ([a-z][A-Za-z0-9]*);/g)].map((coincidencia) => coincidencia[1]).sort()
    const propiedadesMapsId = [...entidad.matchAll(/@MapsId\("([a-z][A-Za-z0-9]*)"\)/g)].map((coincidencia) => coincidencia[1]).sort()
    expect(propiedadesClave).toEqual(["rolId", "usuarioId"])
    expect(propiedadesMapsId).toEqual(propiedadesClave)
    expect(propiedadesMapsId).toHaveLength(2)
    expect(entidad.match(/@ManyToOne/g)).toHaveLength(2)
    expect(entidad).not.toContain("@GeneratedValue")
    expect(entidad).not.toContain("private Long id;")
    expect(repositorio).toContain("JpaRepository<UsuarioRol, UsuarioRolId>")
    expect(servicio).toContain("obtenerPorId(UsuarioRolId id)")
    expect(controlador).toContain('@GetMapping("/{usuarioId}/{rolId}")')
    expect(controlador).toContain("UsuarioRolId id = new UsuarioRolId();")
    expect(controlador).toContain("id.setUsuarioId(usuarioId);")
    expect(controlador).toContain("id.setRolId(rolId);")
  })

  it("conserva atributos de negocio junto con la identidad compuesta", async () => {
    const salida = await salidaTemporal()
    await generarProyectoSpring(fixtureInscripcion, salida)
    const entidad = await readFile(join(salida, "src/main/java/com/sw1/generated/modelo/Inscripcion.java"), "utf8")
    expect(entidad).toContain("private InscripcionId id = new InscripcionId();")
    expect(entidad).toContain("private LocalDate fecha;")
    expect(entidad).not.toContain("@GeneratedValue")
  })

  it("rechaza perfiles asociativos ambiguos y conserva N:M directo como no generable", () => {
    const unaRelacion = { ...fixtureUsuarioRol, relaciones: fixtureUsuarioRol.relaciones.slice(0, 1) }
    expect(() => prepararProyectoSpring(unaRelacion)).toThrow("exactamente dos clases principales")

    const multiplicidadIncorrecta = { ...fixtureUsuarioRol, relaciones: fixtureUsuarioRol.relaciones.map((relacion, indice) => indice === 0 ? { ...relacion, multiplicidadDestino: "1" as const } : relacion) }
    expect(() => prepararProyectoSpring(multiplicidadIncorrecta)).toThrow("extremo 0..*")

    const directa = {
      ...fixtureUsuarioRol,
      clases: fixtureUsuarioRol.clases.filter((clase) => clase.tipoClase !== "asociativa"),
      relaciones: [{ id: "usuario-rol-directa", tipo: "asociacion" as const, claseOrigenId: "usuario", claseDestinoId: "rol", multiplicidadOrigen: "0..*" as const, multiplicidadDestino: "0..*" as const }],
    }
    expect(() => prepararProyectoSpring(directa)).toThrow("convertirla explícitamente en una clase asociativa")
  })

  it("explica identidades, tipos y colisiones no soportadas", () => {
    const mismaPrincipal = {
      ...fixtureUsuarioRol,
      relaciones: fixtureUsuarioRol.relaciones.map((relacion, indice) => indice === 1 ? { ...relacion, claseDestinoId: "usuario" } : relacion),
    }
    expect(() => prepararProyectoSpring(mismaPrincipal)).toThrow("dos clases principales distintas")

    const identidadIncorrecta = {
      ...fixtureUsuarioRol,
      clases: fixtureUsuarioRol.clases.map((clase) => clase.id === "usuario" ? { ...clase, atributos: [{ id: "usuario-id", nombre: "id", tipo: "String" }] } : clase),
    }
    expect(() => prepararProyectoSpring(identidadIncorrecta)).toThrow("debe utilizar identidad Long")

    const tipoNoSoportado = {
      ...fixtureUsuarioRol,
      clases: fixtureUsuarioRol.clases.map((clase) => clase.id === "usuario-rol" ? { ...clase, atributos: [{ id: "saldo", nombre: "saldo", tipo: "Money" }] } : clase),
    }
    expect(() => prepararProyectoSpring(tipoNoSoportado)).toThrow("Tipo no soportado para UsuarioRol.saldo")

    const colision = {
      ...fixtureUsuarioRol,
      clases: fixtureUsuarioRol.clases.map((clase) => clase.id === "usuario-rol" ? { ...clase, atributos: [{ id: "usuario-id-negocio", nombre: "usuarioId", tipo: "Long" }] } : clase),
    }
    expect(() => prepararProyectoSpring(colision)).toThrow("columna derivada usuario_id colisiona")
  })

  it("mantiene las entidades normales con identidad Long", () => {
    const proyecto = prepararProyectoSpring(fixtureUsuarioRol)
    expect(proyecto.entidades.find((entidad) => entidad.nombreClase === "Usuario")).toMatchObject({ tipoId: "Long", esAsociativa: false })
    expect(proyecto.entidades.find((entidad) => entidad.nombreClase === "UsuarioRol")).toMatchObject({ tipoId: "UsuarioRolId", esAsociativa: true })
  })
})
