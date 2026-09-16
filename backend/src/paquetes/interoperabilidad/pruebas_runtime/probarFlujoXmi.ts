import { mkdir, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { exportarXmi, importarXmi } from "../compartido/crunch_uml/AdaptadorCrunchUML.js"
import { fixtureInteroperabilidad } from "../compartido/crunch_uml/fixtureInteroperabilidad.js"

const salida = resolve("generated-test-output/xmi-proof")
await rm(salida, { recursive: true, force: true })
await mkdir(salida, { recursive: true })

const xmi = await exportarXmi(fixtureInteroperabilidad)
await writeFile(resolve(salida, "exported-modelo.xmi"), xmi)
const importado = await importarXmi(xmi.toString("utf8"))
await writeFile(resolve(salida, "imported-model.json"), JSON.stringify(importado, null, 2), "utf8")

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
  realEnterpriseArchitectUsed: false,
}
if (Object.entries(evidencia).some(([clave, valor]) => clave !== "realEnterpriseArchitectUsed" && valor !== true)) {
  throw new Error(`La prueba XMI perdió semántica: ${JSON.stringify(evidencia)}`)
}
await writeFile(resolve(salida, "roundtrip-evidence.json"), JSON.stringify(evidencia, null, 2), "utf8")
console.log(JSON.stringify(evidencia, null, 2))
