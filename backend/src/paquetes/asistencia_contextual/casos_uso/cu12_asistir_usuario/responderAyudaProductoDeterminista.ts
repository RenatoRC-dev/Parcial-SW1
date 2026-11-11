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
  // Pedir una propuesta completa no equivale a preguntar si el negocio está completo.
  if (/^(propon|recomienda|sugiere|dame una propuesta)\b/.test(pregunta) && /\b(modelo|diagrama|clases|relaciones|atributos)\b/.test(pregunta)) return null

  if (!ingles && /^(que (es|significa)|define|explica(me)?|cual es la diferencia)\b/.test(pregunta)) {
    const conceptos = [
      ["composicion", "Composición: relación todo-parte con pertenencia exclusiva de la parte y ciclo de vida ligado al todo."],
      ["agregacion", "Agregación: relación todo-parte compartida; la parte puede existir independientemente del todo."],
      ["multiplicidad", "Multiplicidad: cantidad de instancias permitidas en un extremo de una relación UML. Sus valores dependen de las reglas del negocio, no se deducen del nombre de las clases."],
      ["generalizacion", "Generalización: una subclase especializa a una superclase y hereda sus características."],
    ].filter(([termino]) => pregunta.includes(termino)).map(([, definicion]) => definicion)
    if (conceptos.length) return crearRespuesta(conceptos.join("\n\n"))
  }

  if (/(voz|hablar|dictar|audio|voice|speak|dictate)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "How to use it:\n1. Open Modeling AI from the left rail.\n2. Press Speak and dictate the UML instruction.\n3. NexoCASE transcribes the audio and automatically sends the recognized instruction through the same CU04 modeling flow.\n4. A clear, valid change is applied to the current model. You do not press Send after successful voice recognition."
      : `Cómo hacerlo:\n1. Abre ${CONTEXTO_PRODUCTO_SW1.capacidades.iaModelado.acceso}.\n2. Pulsa Hablar y dicta la instrucción UML.\n3. NexoCASE transcribe el audio y envía automáticamente la instrucción reconocida por el mismo flujo CU04.\n4. Si el cambio es claro y válido, se aplica al modelo actual. No debes pulsar Enviar después de una transcripción correcta.`)
  }

  if (/(desde imagen|imagen|foto|image|photo)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "Attach a PNG/JPEG image in this assistant, write your instruction and press Send. NexoCASE analyzes image and instruction together, and shows a candidate for review. Choose Add to diagram to add the validated elements, or Cancel to leave the current model unchanged. From image remains available as a manual alternative."
      : "Adjunta una imagen PNG/JPEG en este asistente, escribe tu instrucción y pulsa Enviar. Se analizan imagen e instrucción juntas y se muestra un modelo UML candidato. Pulsa Agregar al diagrama para agregar los elementos validados o Cancelar para conservar el modelo actual. Desde imagen sigue disponible como alternativa manual.")
  }

  if (/(xmi|importar|exportar|import|export)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "Attach a .xmi or .xml file (up to 5 MB) and ask to import it in this chat. Review the summary and warnings, then explicitly confirm replacement of the current diagram. To export, request Export my model to XMI; the actual interoperability service must be available before the downloadable modelo.xmi is offered here. XMI is not required for Spring generation and exporting does not synchronize Enterprise Architect."
      : "Importar XMI: adjunta un archivo .xmi o .xml (hasta 5 MB) y pide importarlo en este chat. Revisa la vista previa y las advertencias; NexoCASE pide confirmación porque reemplazará el diagrama actual. Exportar XMI: pide Exporta mi modelo a XMI; cuando el servicio real de interoperabilidad esté disponible se ofrecerá modelo.xmi en esta conversación. XMI no es necesario para generar Spring y exportar no sincroniza Enterprise Architect.", "IR_A_XMI")
  }

  if (/(spring|generar|generacion|backend|generate|generation)/.test(pregunta)) {
    const estado = resumenEstado(solicitud)
    return crearRespuesta(ingles
      ? `Result:\n${estado}\n\nRequest Generate Spring Boot backend in this chat. NexoCASE checks the supported generation profile and offers a ZIP only after generation and packaging complete. Generate remains available as a manual alternative.`
      : `Resultado:\n${estado}\n\nPide Genera el backend Spring Boot en este chat. Se comprueba el perfil soportado y se ofrece el ZIP solo después de generar y empaquetar. Generar permanece disponible como alternativa manual.`, "IR_A_GENERACION", solicitud.contexto.generacion.estado === "apto" ? "informacion" : "advertencia")
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

  if (/(asistente contextual|asistente colaborativo|contextual assistant|collaborative assistant|que puedes hacer|what can you do)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "The assistant explains and reviews the current UML. Clear text changes go through CU04. You can attach image plus instruction for a confirmed additive candidate, attach XMI for a confirmed replacement, request XMI export or generate a Spring ZIP in this same chat. Existing services validate and execute; Save remains explicit. This does not synchronize Enterprise Architect."
      : CONTEXTO_PRODUCTO_SW1.responsabilidadesIa.asistenteContextual)
  }

  if (/(guardar|proyectos recientes|crear proyecto|abrir proyecto|unirse|codigo|save|recent projects|join|projects|create project|open project)/.test(pregunta)) {
    return crearRespuesta(ingles
      ? "Use Create project, Join with code or Recent projects. In the modeling workspace, use Save in the top bar to persist current UML changes."
      : `Usa ${CONTEXTO_PRODUCTO_SW1.capacidades.proyectos.acceso}. Un dispositivo nuevo necesita el código; un acceso local válido puede reabrirse desde Proyectos recientes.`)
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
