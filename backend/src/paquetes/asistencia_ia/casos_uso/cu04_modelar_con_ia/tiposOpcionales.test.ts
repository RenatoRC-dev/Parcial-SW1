import { mkdtemp, rm, access } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"
import type { ComandoModeloUML, ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"
import { esComandoModeloUML, esRespuestaInterpretacionUML, validarPlanCambiosUML } from "./validarPlanCambiosUML.js"
import { ejecutarComandosUML } from "./EjecutorComandosUML.js"
import { interpretarInstruccionModelado } from "./interpretarInstruccionModelado.js"
import { normalizarComandosAsistidos } from "./normalizarSemanticaAsistida.js"
import { ESQUEMA_RESPUESTA_GROQ } from "../../compartido/proveedores/groq/EsquemaRespuestaGroq.js"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"
import { evaluarAptitudGeneracionSpring, prepararProyectoSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import { generarProyectoSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/GeneradorSpringBoot.js"
import { RepositorioProyectosArchivos } from "../../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { fixtureTiposOpcionales } from "../../../interoperabilidad/pruebas_runtime/fixtureTiposOpcionales.js"

const vacio: ModeloUMLCanonicoIA = { id: "m", nombre: "Conceptual", version: "4.2.0", clases: [], relaciones: [] }
const atributo = { tipo: "agregar_atributo" as const, claseRef: "tmp_cliente", refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: null, visibilidad: null }
const crear: ComandoModeloUML = { tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente", abstracta: false }

describe("tipos opcionales: contrato CU04, UML, persistencia y Spring independientes", () => {
  it("admite una clase vacía sin inventar atributos", () => {
    validarPlanCambiosUML(vacio, [crear])
    const model = ejecutarComandosUML(vacio, [crear], () => "cliente")
    expect(model.clases[0].atributos).toEqual([])
    expect(validarModelo(model).valido).toBe(true)
  })

  it("procesa la instrucción Cliente con tres atributos sin tipo por el pipeline completo (proveedor simulado)", async () => {
    const comandos: ComandoModeloUML[] = [crear, ...["nombre", "correo", "telefono"].map((nombre) => ({ ...atributo, nombre, refTemporal: `tmp_${nombre}` }))]
    const response = { resultado: "aplicar" as const, mensaje: "Cliente conceptual", comandos }
    expect(esRespuestaInterpretacionUML(response)).toBe(true)
    const result = await interpretarInstruccionModelado({ instruccion: "Crea Cliente con los atributos nombre, correo y telefono, sin definir sus tipos.", modelo: vacio, revision: 4 }, { interpretarCambiosUML: async () => response })
    expect(result.resultado).toBe("aplicar"); expect(result.revision).toBe(4)
    let n = 0
    const model = ejecutarComandosUML(vacio, result.comandos, (tipo) => `${tipo}-${++n}`)
    expect(model.clases).toHaveLength(1)
    expect(model.clases[0].atributos.map(({ nombre, tipo }) => ({ nombre, tipo }))).toEqual(["nombre", "correo", "telefono"].map((nombre) => ({ nombre, tipo: null })))
    expect(new Set(model.clases[0].atributos.map((a) => a.id)).size).toBe(3)
    expect(vacio.clases).toEqual([])
  })

  it("el esquema del proveedor exige tipoDato explícito pero nullable y prohíbe campos inventados", () => {
    const schema = ESQUEMA_RESPUESTA_GROQ.properties.comandos.items.anyOf.find((s) => s.properties.tipo.const === "agregar_atributo")!
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toContain("tipoDato")
    expect(schema.properties).toMatchObject({ tipoDato: { type: ["string", "null"] } })
    expect(normalizarComandosAsistidos(vacio, [atributo])[0]).toMatchObject({ tipoDato: null })
  })

  it.each([undefined, 1, {}, [], true])("rechaza tipoDato inválido %j sin inferir uno", (tipoDato) => {
    expect(esComandoModeloUML({ ...atributo, tipoDato })).toBe(false)
  })

  it("rechaza campos de tipo inventados incluso si tipoDato es null", () => {
    const invalid = { ...atributo, dataType: "String" }
    expect(esComandoModeloUML(invalid)).toBe(false)
    expect(() => validarPlanCambiosUML(vacio, [crear, invalid])).toThrow("contrato UML")
  })

  it.each(["", "   ", "Object", "void", "varchar", "TipoInventado"])("rechaza tipo CU04 no soportado %j", (tipoDato) => {
    expect(() => validarPlanCambiosUML(vacio, [crear, { ...atributo, tipoDato }])).toThrow("no soportado")
  })

  it.each(["", "nombre-invalido"])("mantiene rechazo de nombre %j sin tipo", (nombre) => {
    expect(() => validarPlanCambiosUML(vacio, [crear, { ...atributo, nombre }])).toThrow()
  })

  it("mantiene validación de duplicados y referencias malformadas con tipos opcionales", () => {
    expect(() => validarPlanCambiosUML(vacio, [crear, atributo, { ...atributo, refTemporal: "tmp_otro" }])).toThrow("duplicados")
    expect(() => validarPlanCambiosUML(vacio, [crear, { ...atributo, refTemporal: "not-a-valid-ref" }])).toThrow("temporal inválida")
  })

  it("preserva atributos tipados y la semántica previa nuevoTipo:null = no cambiar", () => {
    const [typed] = normalizarComandosAsistidos(vacio, [{ ...atributo, tipoDato: "string" }])
    const model = ejecutarComandosUML(vacio, [crear, typed], (t) => t)
    const changed = ejecutarComandosUML(model, [{ tipo: "modificar_atributo", atributoId: "atributo", nuevoNombre: "correo", nuevoTipo: null, nuevaVisibilidad: null }], () => "unused")
    expect(changed.clases[0].atributos[0]).toMatchObject({ id: "atributo", nombre: "correo", tipo: "String" })
  })

  it("CU08 acepta el modelo mixto/asociación y CU09 bloquea campos sin tipo con diagnóstico localizado", async () => {
    const validacion = validarModelo(fixtureTiposOpcionales)
    expect(validacion.valido).toBe(true)
    const aptitud = evaluarAptitudGeneracionSpring(fixtureTiposOpcionales, validacion)
    expect(aptitud.apto).toBe(false)
    expect(aptitud.motivos.join(" ")).toMatch(/Cliente.nombre.*ausente/)
    expect(aptitud.motivos.join(" ")).toMatch(/Cliente.telefono.*ausente/)
    expect(() => prepararProyectoSpring(fixtureTiposOpcionales)).toThrow("Tipo no soportado")
    const dir = await mkdtemp(join(tmpdir(), "optional-spring-"))
    try {
      const output = join(dir, "generated")
      await expect(generarProyectoSpring(fixtureTiposOpcionales, output)).rejects.toThrow("Cliente.nombre")
      await expect(access(output)).rejects.toThrow() // No generated source/ZIP with fictional defaults.
    } finally { await rm(dir, { recursive: true, force: true }) }
  })

  it("JSON y repositorio con Guardar explícito preservan null, tipos e IDs al recargar", async () => {
    const dir = await mkdtemp(join(tmpdir(), "optional-storage-"))
    try {
      const repo = new RepositorioProyectosArchivos(dir), fecha = new Date().toISOString()
      await repo.crear({ id: "project", nombre: "Conceptual", creadoEn: fecha, actualizadoEn: fecha, revisionModelo: 0, modelo: vacio }, null)
      const model = JSON.parse(JSON.stringify(fixtureTiposOpcionales))
      await repo.guardarModeloConRevision("project", model, 0, fecha)
      const reloaded = await new RepositorioProyectosArchivos(dir).obtenerPorId("project")
      expect(reloaded?.revisionModelo).toBe(1)
      expect(reloaded?.modelo).toEqual(model)
      expect(reloaded?.modelo.clases[1].atributos).toEqual([])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
