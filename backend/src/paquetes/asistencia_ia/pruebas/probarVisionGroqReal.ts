import { readFile } from "node:fs/promises"
import { extname, basename } from "node:path"
import { analizarImagenUML } from "../casos_uso/cu05_modelar_desde_imagen/analizarImagenUML.js"
import { ProveedorVisionGroq } from "../compartido/proveedores/vision/groq/ProveedorVisionGroq.js"

const ruta = process.env.SW1_IMAGE_FIXTURE
if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY no está configurada.")
if (!ruta) throw new Error("SW1_IMAGE_FIXTURE no está configurada.")
const extension = extname(ruta).toLowerCase()
const mimeType = extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : null
if (!mimeType) throw new Error("SW1_IMAGE_FIXTURE debe ser PNG o JPEG.")

const proveedor = new ProveedorVisionGroq()
const resultado = await analizarImagenUML({ datos: await readFile(ruta), mimeType, nombreArchivo: basename(ruta) }, proveedor)
const factura = resultado.candidato?.clases.find((clase) => clase.nombre.trim().toLowerCase() === "factura")
const numero = factura?.atributos.find((atributo) => atributo.nombre.trim().toLowerCase() === "numero")
const total = factura?.atributos.find((atributo) => atributo.nombre.trim().toLowerCase() === "total")
const numeroTypeRecognized = numero?.tipoDato?.trim() === "String"
const totalTypeRecognized = total?.tipoDato?.trim() === "Double"
const evidencia = {
  realGroqVisionUsed: true,
  model: proveedor.modelo,
  candidateReceived: resultado.resultado === "candidato",
  containsClassFactura: Boolean(factura),
  containsNumero: Boolean(numero),
  containsTotal: Boolean(total),
  numeroTypeRecognized,
  totalTypeRecognized,
  semanticCondition: Boolean(factura) && Boolean(numero) && Boolean(total) && numeroTypeRecognized && totalTypeRecognized,
}
console.log(JSON.stringify(evidencia, null, 2))
if (!evidencia.semanticCondition) process.exitCode = 1
