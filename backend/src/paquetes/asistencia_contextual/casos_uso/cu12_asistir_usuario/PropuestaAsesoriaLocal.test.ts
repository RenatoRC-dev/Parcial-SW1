import { describe, expect, it } from "vitest"
import type { MensajeProyecto } from "../../../mensajeria_colaborativa/compartido/MensajeProyecto.js"
import type { ComandoModeloUML } from "../../../asistencia_ia/compartido/contrato/ComandoModeloUML.js"
import { consejoDeAdicionesCompatible, instruccionAsesoria, planAcotadoAlConsejo, referenciarAsesoria } from "./PropuestaAsesoriaLocal.js"

const mensaje = { contenido: "Cliente: id Long, nombre String. Venta: total Double." } as MensajeProyecto
const modelo = { id: "m", nombre: "M", version: "1", clases: [], relaciones: [] }
const clase: ComandoModeloUML = { tipo: "crear_clase", refTemporal: "tmp_cliente", nombre: "Cliente", abstracta: false }
const atributo: ComandoModeloUML = { tipo: "agregar_atributo", claseRef: "tmp_cliente", refTemporal: "tmp_id", nombre: "id", tipoDato: "Long", visibilidad: "privada" }
describe("límite de la autorización contextual sobre consejo libre", () => {
  it("conserva el consejo íntegro y no lo trunca para hacerlo ejecutable", () => {
    expect(instruccionAsesoria(mensaje)).toContain(mensaje.contenido)
    expect(instruccionAsesoria({ ...mensaje, contenido: "a".repeat(2400) })).toBeNull()
  })
  it("acepta las adiciones exactas", () => expect(planAcotadoAlConsejo({ ...mensaje, contenido: "Cliente: id Long." }, modelo, [clase, atributo])).toBe(true))
  it("referencia el consejo concreto sin depender de las palabras de la pregunta", () => {
    expect(referenciarAsesoria("que clases me recominedas", "Clase: Cliente (id: Long).", modelo, 3)).toMatchObject({ fuente: "asesoria_local", revisionEditor: 3 })
    expect(planAcotadoAlConsejo({ ...mensaje, contenido: "Clase: Cliente (id: Long)." }, modelo, [clase, atributo])).toBe(true)
    expect(planAcotadoAlConsejo({ ...mensaje, contenido: "Clase: Cliente (id: Long). Sin otros atributos ni relaciones." }, modelo, [clase, atributo])).toBe(true)
    expect(referenciarAsesoria("Recomiéndame algo", "Necesito más reglas del negocio.", modelo, 3)).toBeNull()
  })
  it("el formato con parentesis no permite omitir atributos ni convertir tipos ajenos en relaciones", () => {
    expect(planAcotadoAlConsejo({ ...mensaje, contenido: "Clase: Cliente (id: Long, nombre: String)." }, modelo, [clase, atributo])).toBe(false)
    expect(consejoDeAdicionesCompatible({ ...mensaje, contenido: "Clase: Cliente (id: Long, venta: Venta)." })).toBe(false)
    expect(consejoDeAdicionesCompatible({ ...mensaje, contenido: "Clase: Cliente (nombre)." })).toBe(false)
  })
  it("rechaza un subconjunto silencioso de clases o atributos", () => {
    expect(planAcotadoAlConsejo(mensaje, modelo, [clase, atributo])).toBe(false)
    expect(planAcotadoAlConsejo({ ...mensaje, contenido: "Cliente: id Long." }, modelo, [clase])).toBe(false)
  })
  it("un tipo mencionado no se convierte en una clase adicional", () => {
    expect(planAcotadoAlConsejo({ ...mensaje, contenido: "Cliente: id Long." }, modelo, [clase, atributo, { ...clase, refTemporal: "tmp_long", nombre: "Long" }])).toBe(false)
  })
  it.each([
    [[clase, { ...atributo, tipoDato: "String" }]],
    [[clase, { ...atributo, nombre: "total", tipoDato: "Double" }]],
    [[{ ...clase, abstracta: true }]],
    [[clase, { tipo: "eliminar_clase", claseId: "cliente" }]],
    [[clase, { tipo: "crear_clase", refTemporal: "tmp_venta", nombre: "Venta", abstracta: false }, { tipo: "crear_relacion", refTemporal: "tmp_rel", tipoRelacion: "asociacion", claseOrigenRef: "tmp_cliente", claseDestinoRef: "tmp_venta", cantidadDestinoPorOrigen: "0..*", cantidadOrigenPorDestino: "1", rolOrigen: null, rolDestino: null }]],
  ] as Array<[ComandoModeloUML[]]>)("rechaza tipos, dueños, semántica o relaciones no autorizadas %#", (comandos) => {
    expect(planAcotadoAlConsejo(mensaje, modelo, comandos)).toBe(false)
  })
})
