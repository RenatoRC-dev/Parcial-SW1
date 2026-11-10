import { mkdir, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { exportarXmi, importarXmi } from "../compartido/crunch_uml/AdaptadorCrunchUML.js"
import { fixtureInteroperabilidad } from "../compartido/crunch_uml/fixtureInteroperabilidad.js"
import type { ModeloUMLCanonicoIntercambio } from "../compartido/crunch_uml/ContratoInteroperabilidadXmi.js"
import { fixtureUsuarioRol } from "../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/fixtureClaseAsociativa.js"

function semantica(modelo: ModeloUMLCanonicoIntercambio) {
  const porId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  return {
    ...modelo,
    clases: modelo.clases.map((clase) => ({ ...clase, tipoClase: clase.tipoClase ?? "normal", atributos: [...clase.atributos].sort(porId) })).sort(porId),
    relaciones: [...modelo.relaciones].sort(porId),
  }
}

const salida = resolve("generated-test-output/xmi-proof")
await rm(salida, { recursive: true, force: true })
await mkdir(salida, { recursive: true })

const xmi = await exportarXmi(fixtureInteroperabilidad)
await writeFile(resolve(salida, "exported-modelo.xmi"), xmi)
const importado = await importarXmi(xmi.toString("utf8"))
await writeFile(resolve(salida, "imported-model.json"), JSON.stringify(importado, null, 2), "utf8")

// Los métodos XMI siguen fuera del perfil; los IDs de parámetros se prueban en Apollon.
const modeloAsociativo: ModeloUMLCanonicoIntercambio = {
  ...fixtureUsuarioRol, version: "4.2.0",
  clases: fixtureUsuarioRol.clases.map((clase, indice) => ({ ...clase, posicion: { x: indice * 300, y: 100 } })),
  relaciones: fixtureUsuarioRol.relaciones.map((relacion, indice) => ({ ...relacion, nombre: indice === 0 ? "asigna & autoriza" : "tiene rol" })),
}
const xmiAsociativo = await exportarXmi(modeloAsociativo)
await writeFile(resolve(salida, "exported-asociativa.xmi"), xmiAsociativo)
const asociativoImportado = await importarXmi(xmiAsociativo.toString("utf8"))
await writeFile(resolve(salida, "imported-asociativa.json"), JSON.stringify(asociativoImportado, null, 2), "utf8")

const clasesEsperadas = new Map(fixtureInteroperabilidad.clases.map((clase) => [clase.nombre, clase]))
const clasesActuales = new Map(importado.modelo.clases.map((clase) => [clase.nombre, clase]))
const atributosPreservados = [...clasesEsperadas].every(([nombre, esperada]) => {
  const actual = clasesActuales.get(nombre)
  return actual && esperada.atributos.every((atributo) =>
    actual.atributos.some((candidato) => candidato.nombre === atributo.nombre && candidato.tipo === atributo.tipo))
})
const relacion = importado.modelo.relaciones[0]
const evidencia = {
  exportSuccess: xmi.length > 0,
  importSuccess: true,
  classCountPreserved: importado.modelo.clases.length === fixtureInteroperabilidad.clases.length,
  attributesPreserved: Boolean(atributosPreservados),
  associationPreserved: importado.modelo.relaciones.length === 1 && relacion?.tipo === "asociacion",
  multiplicitiesPreserved: relacion?.multiplicidadOrigen === "1" && relacion?.multiplicidadDestino === "0..*",
  rolesPreserved: relacion?.rolOrigen === "cliente" && relacion?.rolDestino === "pedidos",
  baseRoundtripSemanticallyEquivalent: isDeepStrictEqual(semantica(importado.modelo), semantica(fixtureInteroperabilidad)),
  legacyClassesRemainUnmarked: importado.modelo.clases.every((clase) => clase.tipoClase === undefined),
  associativeClassMarkersPreserved: modeloAsociativo.clases.every((clase) =>
    asociativoImportado.modelo.clases.find((actual) => actual.id === clase.id)?.tipoClase === (clase.tipoClase === "asociativa" ? "asociativa" : undefined)),
  associationNamesPreserved: modeloAsociativo.relaciones.every((esperada) =>
    asociativoImportado.modelo.relaciones.find((actual) => actual.id === esperada.id)?.nombre === esperada.nombre),
  associativeRoundtripSemanticallyEquivalent: isDeepStrictEqual(semantica(asociativoImportado.modelo), semantica(modeloAsociativo)),
  realEnterpriseArchitectUsed: false,
}
if (Object.entries(evidencia).some(([clave, valor]) => clave !== "realEnterpriseArchitectUsed" && valor !== true)) {
  throw new Error(`La prueba XMI perdió semántica: ${JSON.stringify(evidencia)}`)
}
await writeFile(resolve(salida, "roundtrip-evidence.json"), JSON.stringify(evidencia, null, 2), "utf8")
console.log(JSON.stringify(evidencia, null, 2))
