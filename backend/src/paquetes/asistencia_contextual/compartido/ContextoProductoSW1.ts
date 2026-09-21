export interface ContextoProductoSW1 {
  version: string
  producto: string
  responsabilidadesIa: {
    iaModelado: string
    desdeImagen: string
    asistenteContextual: string
  }
  capacidades: {
    proyectos: { disponible: true; crear: true; abrir: true; guardarExplicitamente: true; acceso: string }
    modeladoManual: { disponible: true; acceso: string; permite: string[] }
    iaModelado: { disponible: true; acceso: string; texto: string; voz: string; aplicaCambiosValidosAutomaticamente: true; requiereConfirmacion: false }
    imagenUml: { disponible: true; acceso: string; flujo: string[]; produceCandidato: true; requiereConfirmacion: true }
    validacion: { disponible: true; acceso: string; analizaModeloCanonico: true }
    xmi: { disponible: true; acceso: string; importar: string; exportar: string; archivoExportado: "modelo.xmi"; produceCandidato: false }
    generacionSpring: { disponible: true; acceso: string; requiereModeloApto: true; accionVisible: string; descargaBackend: true }
    colaboracion: { disponible: true; descripcion: string }
    diagnosticoTecnico: { disponible: true; acceso: string; uso: string }
  }
}

export const CONTEXTO_PRODUCTO_SW1: ContextoProductoSW1 = {
  version: "2026.09",
  producto: "SW1 Modeler",
  responsabilidadesIa: {
    iaModelado: "CU04 interpreta instrucciones UML incrementales sobre el modelo canónico actual y aplica automáticamente los cambios claros y válidos; no usa confirmación.",
    desdeImagen: "CU05 analiza una imagen y produce un candidato; el modelo canónico solo cambia cuando el usuario elige Agregar al diagrama.",
    asistenteContextual: "CU12 explica el producto y analiza el modelo actual; nunca modifica, guarda, importa, exporta ni genera por sí mismo.",
  },
  capacidades: {
    proyectos: { disponible: true, crear: true, abrir: true, guardarExplicitamente: true, acceso: "Mis proyectos y barra superior" },
    modeladoManual: { disponible: true, acceso: "Espacio de modelado UML e inspector Propiedades UML", permite: ["clases", "atributos", "operaciones", "relaciones", "multiplicidades", "roles"] },
    iaModelado: { disponible: true, acceso: "Asistente IA en la barra izquierda", texto: "Escribir una Instrucción UML y pulsar Enviar", voz: "Pulsar Hablar y dictar la instrucción; SW1 transcribe el audio y envía automáticamente la instrucción por el mismo flujo CU04, sin pulsar Enviar después", aplicaCambiosValidosAutomaticamente: true, requiereConfirmacion: false },
    imagenUml: { disponible: true, acceso: "Desde imagen en la barra izquierda", flujo: ["Seleccionar imagen", "Analizar imagen", "revisar Modelo UML candidato", "Agregar al diagrama o Cancelar"], produceCandidato: true, requiereConfirmacion: true },
    validacion: { disponible: true, acceso: "Validación en la barra izquierda", analizaModeloCanonico: true },
    xmi: { disponible: true, acceso: "XMI en la barra izquierda", importar: "Importar XMI permite seleccionar .xmi o .xml; SW1 solicita confirmación porque reemplazará el diagrama actual y, si se confirma, importa el modelo canónico y muestra advertencias cuando corresponda", exportar: "Exportar XMI descarga el modelo actual como modelo.xmi para interoperabilidad con herramientas compatibles; XMI no es un requisito ni el flujo de generación Spring", archivoExportado: "modelo.xmi", produceCandidato: false },
    generacionSpring: { disponible: true, acceso: "Generar en la barra izquierda", requiereModeloApto: true, accionVisible: "Generar backend Spring Boot", descargaBackend: true },
    colaboracion: { disponible: true, descripcion: "Participantes del mismo proyecto comparten cambios del diagrama en vivo; el guardado durable sigue siendo explícito." },
    diagnosticoTecnico: { disponible: true, acceso: "Diagnóstico técnico en el inspector derecho", uso: "evidencia y diagnóstico; no es el flujo principal" },
  },
}
