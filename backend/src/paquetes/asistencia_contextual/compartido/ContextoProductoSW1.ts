export interface ContextoProductoSW1 {
  version: string
  producto: string
  responsabilidadesIa: {
    iaModelado: string
    desdeImagen: string
    asistenteContextual: string
  }
  capacidades: {
    proyectos: { disponible: true; crear: true; abrir: true; guardarExplicitamente: true; acceso: string; unionPorCodigo: true; recientesPorDispositivo: true }
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
  version: "2026.11",
  producto: "NexoCASE",
  responsabilidadesIa: {
    iaModelado: "CU04 interpreta instrucciones UML incrementales sobre el modelo canónico actual y aplica automáticamente los cambios claros y válidos; no usa confirmación. Valida UML con las reglas de CU08; la aptitud Spring se evalúa aparte en CU09. Los tipos nuevos del canal IA siguen acotados; conserva los tipos conceptuales existentes.",
    desdeImagen: "CU05 analiza una imagen y produce un candidato; el modelo canónico solo cambia cuando el usuario elige Agregar al diagrama.",
    asistenteContextual: "CU12 es el Asistente colaborativo compartido: enseña, explica, revisa y recomienda usando identidad, modelo, validación, conversación y actividad reales. Si una persona solicita un cambio claro, la orquestación lo deriva de forma controlada a CU04, que es el único ejecutor UML. Los diagnósticos se recalculan sobre un mismo modelo canónico: CU08 determina validez UML y CU09 aptitud Spring.",
  },
  capacidades: {
    proyectos: { disponible: true, crear: true, abrir: true, guardarExplicitamente: true, acceso: "Crear proyecto, Unirse con código, Proyectos recientes y Guardar en la barra superior", unionPorCodigo: true, recientesPorDispositivo: true },
    modeladoManual: { disponible: true, acceso: "Espacio de modelado UML e inspector Propiedades UML", permite: ["clases", "atributos", "operaciones", "relaciones", "multiplicidades", "roles"] },
    iaModelado: { disponible: true, acceso: "Abrir Asistente en el área de modelado: Asistente de modelado", texto: "Escribir preguntas, recomendaciones o instrucciones UML en el único chat y pulsar Enviar. Una propuesta propia pendiente puede mostrar Aplicar cambio; el backend valida antes de ejecutarlo mediante CU04.", voz: "Pulsar Hablar, grabar y Detener o Cancelar grabación. La transcripción queda editable en el compositor; revisarla y pulsar Enviar. Terminar de grabar nunca ejecuta cambios. También se puede adjuntar una imagen UML: Enviar analiza solo la imagen mediante CU05 y conserva el texto para otro envío. La imagen y su candidato son locales, no contexto visual de CU12 ni adjuntos durables del hilo. Desde imagen conserva el flujo dedicado.", aplicaCambiosValidosAutomaticamente: true, requiereConfirmacion: false },
    imagenUml: { disponible: true, acceso: "Desde imagen en la barra izquierda o Adjuntar imagen en el asistente de modelado (PNG/JPEG, hasta 10 MB)", flujo: ["Seleccionar imagen y revisar vista previa", "Analizar imagen o Enviar el adjunto", "revisar Modelo UML candidato local", "Agregar al diagrama o Cancelar"], produceCandidato: true, requiereConfirmacion: true },
    validacion: { disponible: true, acceso: "Validación en la barra izquierda", analizaModeloCanonico: true },
    xmi: { disponible: true, acceso: "XMI en la barra izquierda", importar: "Importar XMI permite seleccionar .xmi o .xml; NexoCASE solicita confirmación porque reemplazará el diagrama actual y, si se confirma, importa el modelo canónico y muestra advertencias cuando corresponda", exportar: "Exportar XMI descarga el modelo actual como modelo.xmi para interoperabilidad con herramientas compatibles; XMI no es un requisito ni el flujo de generación Spring. La marca de clase asociativa se conserva entre archivos NexoCASE mediante una extensión propia; otras herramientas pueden omitirla. Los métodos UML siguen fuera del perfil XMI", archivoExportado: "modelo.xmi", produceCandidato: false },
    generacionSpring: { disponible: true, acceso: "Generar en la barra izquierda", requiereModeloApto: true, accionVisible: "Generar backend Spring Boot", descargaBackend: true },
    colaboracion: { disponible: true, descripcion: "Participantes autorizados del mismo proyecto comparten cambios del diagrama y la conversación del Asistente colaborativo. El modelo se guarda explícitamente; la conversación se persiste al enviarse." },
    diagnosticoTecnico: { disponible: true, acceso: "Diagnóstico técnico en el inspector derecho", uso: "evidencia y diagnóstico; no es el flujo principal" },
  },
}
