import assert from "node:assert/strict"
import type { SolicitudAsistenteContextual } from "../compartido/ContratoAsistenteContextual.js"
import { PlanificadorOllama, leerConfiguracionOllama } from "../compartido/proveedores/ollama/PlanificadorOllama.js"

// Prueba explícita local: no descarga modelos, no invoca Groq ni ejecuta herramientas.
const config = leerConfiguracionOllama({ ...process.env, AI_ORCHESTRATOR_MODE: "hybrid_local" })!
const proveedor = new PlanificadorOllama(config)
assert.equal(await proveedor.comprobarEstado(), "disponible", "Ollama debe tener qwen3:8b instalado")
const contexto: SolicitudAsistenteContextual["contexto"] = {
  proyecto: { id: "smoke", nombre: "Prueba local" }, area: "modelado_uml", idioma: "es", revisionModelo: 0,
  modeloActual: { id: "uml", nombre: "Prueba", version: "1", clases: [], relaciones: [], truncado: false },
  elementoSeleccionado: null, elementosRelevantes: [], resumenModelo: { clases: 0, relaciones: 0 },
  estadoUml: { estado: "valido", problemas: [], errores: [], advertencias: [] }, generacion: { estado: "no_apto", bloqueos: ["No hay clases"], advertencias: [] },
  cambiosSinGuardar: false, candidatoImagenPendiente: false, accionesDisponibles: ["NINGUNA"],
  participanteActual: { id: "local", nombreVisible: "Diseñador" }, conversacionCompartida: [],
}
const casos = [
  ["¿Qué significa composición en UML?", "conversar"],
  ["Crea una clase Cliente con id Long", "modificar_uml"],
  ["Analiza una imagen de un diagrama UML", "analizar_imagen"],
  ["Valida el modelo UML actual", "validar_uml"],
  ["Importa un archivo XMI", "importar_xmi"],
  ["Exporta el modelo a XMI", "exportar_xmi"],
  ["Genera el backend Spring Boot", "generar_spring"],
  ["Lleva este modelo a Enterprise Architect", "automatizar_ea"],
] as const
let aciertos = 0
for (const [pregunta, esperado] of casos) {
  const inicio = performance.now()
  const resultado = await proveedor.planificar({ requestId: crypto.randomUUID(), pregunta, contexto, conversacion: [] })
  console.log(JSON.stringify({ esperado, obtenido: resultado.operacion, duracionMs: Math.round(performance.now() - inicio), modelo: config.modelo }))
  if (resultado.operacion === esperado) aciertos++
}
assert.equal(aciertos, casos.length, "El smoke debe clasificar todas las rutas correctamente")
console.log("Ollama: 8 rutas estructuradas verificadas; ninguna herramienta ejecutada.")
