import { interpretarInstruccionModelado } from "../casos_uso/cu04_modelar_con_ia/interpretarInstruccionModelado.js"
import { ProveedorGroq } from "../compartido/proveedores/groq/ProveedorGroq.js"

if (!process.env.GROQ_API_KEY) {
  console.error("Prerequisito ausente: configure GROQ_API_KEY en el proceso para ejecutar la aceptación real de Groq.")
  process.exitCode = 2
} else {
  const proveedor = new ProveedorGroq()
  const modelo = {
    id: "modelo-prueba-groq",
    nombre: "Prueba Groq",
    version: "4.2.0",
    clases: [
      {
        id: "cliente", nombre: "Cliente", abstracta: false, posicion: { x: 100, y: 100 },
        atributos: [{ id: "cliente-id", nombre: "id", tipo: "Long", visibilidad: "privada" as const }],
      },
      {
        id: "pedido", nombre: "Pedido", abstracta: false, posicion: { x: 400, y: 100 },
        atributos: [
          { id: "pedido-id", nombre: "id", tipo: "Long", visibilidad: "privada" as const },
          { id: "pedido-fecha", nombre: "fecha", tipo: "LocalDate", visibilidad: "privada" as const },
        ],
      },
    ],
    relaciones: [{
      id: "cliente-pedidos", tipo: "asociacion" as const, claseOrigenId: "cliente", claseDestinoId: "pedido",
      multiplicidadOrigen: "1" as const, multiplicidadDestino: "0..*" as const,
    }],
  }
  const resultado = await interpretarInstruccionModelado({
    instruccion: "Añade el atributo correo de tipo String a la clase Cliente y añade el atributo total de tipo Double a la clase Pedido.",
    revision: 1,
    modelo,
  }, proveedor)

  const atributos = resultado.comandos.filter((actual) => actual.tipo === "agregar_atributo")
  if (resultado.resultado !== "aplicar"
    || !atributos.some((actual) => actual.claseRef === "cliente" && actual.nombre === "correo" && actual.tipoDato === "String")
    || !atributos.some((actual) => actual.claseRef === "pedido" && actual.nombre === "total" && actual.tipoDato === "Double")) {
    throw new Error("Groq no produjo los cambios incrementales esperados para Cliente/correo y Pedido/total.")
  }

  await new Promise((resolve) => setTimeout(resolve, 750))
  const creacion = await interpretarInstruccionModelado({
    instruccion: "Crea una clase Producto con los atributos id de tipo Long, nombre de tipo String y precio de tipo Double.",
    revision: 1,
    modelo,
  }, proveedor)
  if (creacion.resultado !== "aplicar"
    || !creacion.comandos.some((actual) => actual.tipo === "crear_clase" && actual.nombre === "Producto")
    || creacion.comandos.filter((actual) => actual.tipo === "agregar_atributo" && actual.claseRef.startsWith("tmp_")).length !== 3) {
    throw new Error("Groq no produjo la creación incremental esperada para Producto.")
  }
  console.log(JSON.stringify({ realGroqUsed: true, model: proveedor.modelo, structuredOutput: true, semanticValidation: true, multiAttributeChange: true, incrementalClassCreation: true }, null, 2))
}
