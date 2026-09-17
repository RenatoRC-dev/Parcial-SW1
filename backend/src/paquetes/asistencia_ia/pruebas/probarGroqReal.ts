import { interpretarInstruccionModelado } from "../casos_uso/cu04_modelar_con_ia/interpretarInstruccionModelado.js"
import { ProveedorGroq } from "../compartido/proveedores/groq/ProveedorGroq.js"

if (!process.env.GROQ_API_KEY) {
  console.error("Prerequisito ausente: configure GROQ_API_KEY en el proceso para ejecutar la aceptación real de Groq.")
  process.exitCode = 2
} else {
  const proveedor = new ProveedorGroq()
  const resultado = await interpretarInstruccionModelado({
    instruccion: "Agrega un atributo correo de tipo String a Cliente",
    revision: 1,
    modelo: {
      id: "modelo-prueba-groq",
      nombre: "Prueba Groq",
      version: "4.2.0",
      clases: [{
        id: "cliente",
        nombre: "Cliente",
        abstracta: false,
        posicion: { x: 100, y: 100 },
        atributos: [{ id: "nombre", nombre: "nombre", tipo: "String", visibilidad: "privada" }],
      }],
      relaciones: [],
    },
  }, proveedor)

  const comando = resultado.comandos.find((actual) => actual.tipo === "agregar_atributo")
  if (resultado.resultado !== "aplicar" || !comando || comando.claseRef !== "cliente" || comando.nombre !== "correo" || comando.tipoDato !== "String") {
    throw new Error("Groq no produjo el cambio incremental esperado para la prueba Cliente/correo.")
  }
  console.log(JSON.stringify({ realGroqUsed: true, model: proveedor.modelo, structuredOutput: true, semanticValidation: true, expectedCommandReceived: true }, null, 2))
}
