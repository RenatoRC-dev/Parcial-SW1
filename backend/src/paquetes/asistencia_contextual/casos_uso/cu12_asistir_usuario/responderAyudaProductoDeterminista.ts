import type { AccionAsistenteContextual, RespuestaAsistenteContextual, SolicitudAsistenteContextual } from "../../compartido/ContratoAsistenteContextual.js"
import { CONTEXTO_PRODUCTO_SW1 } from "../../compartido/ContextoProductoSW1.js"

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.*]+/g, " ").trim()
}

function crearRespuesta(respuesta: string, accionSugerida: AccionAsistenteContextual = "NINGUNA", nivel: RespuestaAsistenteContextual["nivel"] = "informacion"): RespuestaAsistenteContextual {
  return { respuesta, accionSugerida, elementoRelacionadoId: null, nivel, categoriaRecomendacion: "INFORMATIVO", origen: "determinista" }
}

function resumenEstado(solicitud: SolicitudAsistenteContextual): string {
  const { contexto } = solicitud
  if (contexto.idioma === "en") {
    const uml = contexto.estadoUml.estado === "valido" ? "The UML is structurally valid." : contexto.estadoUml.estado === "incompleto" ? "The UML is editable but incomplete." : `The UML has errors: ${contexto.estadoUml.errores.join("; ") || contexto.estadoUml.problemas.join("; ")}.`
    const spring = contexto.generacion.estado === "apto" ? "It is ready for Spring generation." : `It is not ready for Spring generation: ${contexto.generacion.bloqueos.join("; ")}.`
    return `${uml} ${spring}`
  }
  const uml = contexto.estadoUml.estado === "valido" ? "El UML es estructuralmente válido." : contexto.estadoUml.estado === "incompleto" ? "El UML es editable, pero está incompleto." : `El UML tiene errores: ${contexto.estadoUml.errores.join("; ") || contexto.estadoUml.problemas.join("; ")}.`
  const spring = contexto.generacion.estado === "apto" ? "Está listo para generar Spring Boot." : `No está listo para generar Spring Boot: ${contexto.generacion.bloqueos.join("; ")}.`
  return `${uml} ${spring}`
}

export function responderAyudaProductoDeterminista(solicitud: SolicitudAsistenteContextual): RespuestaAsistenteContextual | null {
  const pregunta = normalizar(solicitud.pregunta)
  const ingles = solicitud.contexto.idioma === "en"

  if (/(voz|hablar|dictar|audio|voice|speak|dictate)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "How to use it:\n1. Open Modeling AI from the left rail.\n2. Press Speak and dictate the UML instruction.\n3. NexoCASE transcribes the audio and automatically sends the recognized instruction through the same CU04 modeling flow.\n4. A clear, valid change is applied to the current model. You do not press Send after successful voice recognition."
      : `Cómo hacerlo:\n1. Abre ${CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.acceso}.\n2. Pulsa Hablar y dicta la instrucción UML.\n3. NexoCASE transcribe el audio y envía automáticamente la instrucción reconocida por el mismo flujo CU04.\n4. Si el cambio es claro y válido, se aplica al modelo actual. No debes pulsar Enviar después de una transcripción correcta.`)
  }

  if (/(desde imagen|imagen|foto|image|photo)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "How to use it:\n1. Open From image from the left rail.\n2. Select an image and run Analyze image.\n3. NexoCASE creates a UML candidate for review.\n4. Choose Add to diagram to apply it, or Cancel to leave the current model unchanged."
      : `Cómo hacerlo:\n1. Abre ${CONTEXTO_PRODUCTO_SW1.capacidades.imagenUml.acceso}.\n2. Selecciona una imagen y pulsa Analizar imagen.\n3. NexoCASE crea un modelo UML candidato para revisión.\n4. Pulsa Agregar al diagrama para aplicarlo o Cancelar para conservar el modelo actual.`)
  }

  if (/(xmi|importar|exportar|import|export)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "How it works:\nImport XMI: open XMI from the left rail, choose Import XMI and select a .xmi or .xml file. NexoCASE asks for confirmation because the import replaces the current diagram; after confirmation it imports the model and may show warnings.\nExport XMI: choose Export XMI to download the current model as modelo.xmi for interoperability. XMI is not required for Spring generation."
      : `Cómo funciona:\nImportar XMI: abre ${CONTEXTO_PRODUCTO_SW1.capacidades.xmi.acceso}, pulsa Importar XMI y selecciona un archivo .xmi o .xml. NexoCASE pide confirmación porque reemplazará el diagrama actual; si confirmas, importa el modelo y puede mostrar advertencias.\nExportar XMI: pulsa Exportar XMI para descargar el modelo actual como ${CONTEXTO_PRODUCTO_SW1.capacidades.xmi.archivoExportado} para interoperabilidad. XMI no es necesario para generar Spring.`, "IR_A_XMI")
  }

  if (/(spring|generar|generacion|backend|generate|generation)/.test(pregunta)) {
    const estado = resumenEstado(solicitud)
    return crearRespuesta(ingles
      ? `Result:\n${estado}\n\nHow to do it:\nOpen Generate from the left rail. NexoCASE only enables Spring Boot generation when the current model satisfies its generation profile.`
      : `Resultado:\n${estado}\n\nCómo hacerlo:\nAbre ${CONTEXTO_PRODUCTO_SW1.capacidades.generacionSpring.acceso}. NexoCASE habilita la generación Spring Boot únicamente cuando el modelo actual cumple su perfil de generación.`, "IR_A_GENERACION", solicitud.contexto.generacion.estado === "apto" ? "informacion" : "advertencia")
  }

  if (/(validar|validacion|errores del modelo|modelo valido|corregir.*error|(error|problema|riesgo).*modelo|modelo.*(error|problema|riesgo)|structurally valid|validation|validate|fix.*error)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? `Result:\n${resumenEstado(solicitud)}\n\nHow to do it:\nOpen Validation from the left rail to review current errors and warnings.`
      : `Resultado:\n${resumenEstado(solicitud)}\n\nCómo hacerlo:\nAbre ${CONTEXTO_PRODUCTO_SW1.capacidades.validacion.acceso} para revisar los errores y advertencias actuales.`, "IR_A_VALIDACION", solicitud.contexto.estadoUml.estado === "invalido" ? "advertencia" : "informacion")
  }

  if (/(completo|completitud|que podria faltar|que falta|que mas.*(agregar|anadir)|otras entidades|que atributos (deberia|tendria|le faltan)|complete|completeness|what is missing|what else.*add|other entities|what attributes.*(should|would))/.test(pregunta)) {
    return crearRespuesta(ingles
      ? `Result:\n${resumenEstado(solicitud)}\n\nBusiness completeness cannot be proven from the UML diagram alone. NexoCASE can determine structural validity and Spring readiness. To evaluate functional completeness, provide the business requirements or use cases.`
      : `Resultado:\n${resumenEstado(solicitud)}\n\nLa completitud del negocio no puede demostrarse solo con el diagrama UML. NexoCASE puede determinar validez estructural y aptitud para Spring. Para evaluar completitud funcional, proporciona los requisitos del negocio o casos de uso.`)
  }

  if (/(asistente contextual|contextual assistant|que puedes hacer|what can you do)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "The Contextual assistant teaches how to use NexoCASE and explains objective facts from the current UML, selection, validation and generation status. It is advisory: it never changes or saves the model, imports or exports XMI, or generates the backend by itself."
      : CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.asistenteContextual)
  }

  if (/(guardar|mis proyectos|crear proyecto|abrir proyecto|save|projects|create project|open project)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "Use My projects to create or open a project. In the modeling workspace, use Save in the top bar to persist current changes."
      : `Usa ${CONTEXTO_PRODUCTO_SW1.capacidades.proyectos.acceso} para crear o abrir proyectos. En el espacio de modelado, pulsa Guardar en la barra superior para persistir los cambios actuales.`)
  }

  if (/(asistente ia|ia de modelado|crear clase con ia|modificar.* ia|modeling ai|create.*with ai|use ai)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "How to use it:\n1. Open Modeling AI from the left rail.\n2. Write a UML instruction, for example: Create a Cliente class with id Long and correo String.\n3. Press Send.\n4. NexoCASE interprets it against the current canonical UML and automatically applies a clear, valid incremental change."
      : `Cómo hacerlo:\n1. Abre ${CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.acceso}.\n2. Escribe una instrucción UML, por ejemplo: Crea una clase Cliente con id Long y correo String.\n3. Pulsa Enviar.\n4. NexoCASE la interpreta sobre el UML canónico actual y aplica automáticamente un cambio incremental claro y válido.`)
  }

  if (/(editar.*clase|crear.*clase|modificar.*atribut|cambiar.*cardinalidad|cambiar.*multiplicidad|manual uml|edit.*class|create.*class|modify.*attribute|change.*multiplicity)/.test(pregunta)) {
    const seleccionado = solicitud.contexto.elementoSeleccionado
    return crearRespuesta(ingles
      ? `How to do it:\nUse the UML modeling workspace and the UML Properties inspector. Select the ${seleccionado?.tipo === "relacion" ? "relationship" : "class or relationship"} on the canvas, then edit only its displayed properties.`
      : `Cómo hacerlo:\nUsa ${CONTEXTO_PRODUCTO_SW1.capacidades.modeladoManual.acceso}. Selecciona ${seleccionado?.tipo === "relacion" ? "la relación" : "la clase o relación"} en el lienzo y modifica sus propiedades visibles.`)
  }

  return null
}
