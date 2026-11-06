import type { RespuestaAsistenteContextual, SolicitudAsistenteContextual } from "../compartido/ContratoAsistenteContextual.js"
import type { ProveedorAsistenteContextual } from "../compartido/ProveedorAsistenteContextual.js"

export class ProveedorAsistenteContextualDeterministaE2E implements ProveedorAsistenteContextual {
  async responder(solicitud: SolicitudAsistenteContextual): Promise<RespuestaAsistenteContextual> {
    const nombre = solicitud.contexto.participanteActual?.nombreVisible ?? "Diseñador"
    const foco = solicitud.contexto.elementoSeleccionado
    const pregunta = solicitud.pregunta.toLocaleLowerCase()
    let respuesta: string
    if (pregunta.includes("composición") || pregunta.includes("composicion")) {
      respuesta = `${nombre}, una composición representa una relación fuerte de todo-parte: la parte depende del ciclo de vida del todo.`
    } else if (pregunta.includes("métodos") || pregunta.includes("metodos")) {
      const ultimaClase = foco?.tipo === "clase" ? foco : solicitud.contexto.modeloActual.clases[0]
      respuesta = ultimaClase ? `${nombre}, ${ultimaClase.nombre} tiene ${ultimaClase.operaciones.length} métodos en la vista actual.` : `${nombre}, no hay una clase actual que permita revisar métodos.`
    } else if (foco?.tipo === "clase") {
      respuesta = `${nombre}, ${foco.nombre} tiene ${foco.atributos.length} atributos y ${foco.operaciones.length} métodos en la vista actual.`
    } else {
      respuesta = `${nombre}, revisé el modelo y el contexto compartido. Puedo explicar el diseño y recomendar ajustes sin modificar el UML.`
    }
    return {
      respuesta, accionSugerida: "NINGUNA", elementoRelacionadoId: foco?.id ?? null,
      nivel: "informacion", categoriaRecomendacion: "INFORMATIVO",
    }
  }
}
