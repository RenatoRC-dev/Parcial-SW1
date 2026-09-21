# Iteración 19 — Profesionalización UX/UI

## Estado

PASS. La interfaz web de SW1 adopta una arquitectura visual de aplicación CASE de escritorio sin modificar la lógica de negocio, el modelo UML canónico ni las integraciones existentes.

## Problemas de partida

La pantalla de modelado concentraba el lienzo y todas las funciones secundarias en una columna estrecha y una barra lateral extensa. IA, imagen, validación, XMI, generación, colaboración y diagnósticos competían permanentemente por espacio. En monitores anchos quedaban márgenes improductivos, el flujo principal exigía desplazamiento vertical de página y el tema oscuro mezclaba superficies claras y oscuras.

La lista de proyectos, por su parte, se presentaba como un formulario aislado con poco aprovechamiento del espacio disponible. La cabecera tampoco distinguía con suficiente claridad el producto, el proyecto activo, el estado de guardado y las acciones principales.

## Arquitectura de información: antes y después

Antes, el editor presentaba simultáneamente casi todas las capacidades. Después, el espacio se organiza por prioridad de trabajo:

1. una barra superior identifica SW1 Modeler, el proyecto activo, el estado de guardado y las acciones principales;
2. un rail izquierdo abre las herramientas Modelo, Asistente IA, Desde imagen, Validación, XMI y Generar;
3. el lienzo UML ocupa la zona flexible y dominante;
4. el inspector derecho contiene propiedades del elemento seleccionado y colaboración;
5. una barra inferior resume validez, cantidades del modelo y aptitud de generación;
6. la evidencia de desarrollo permanece disponible dentro de Diagnóstico técnico, plegado inicialmente.

Las herramientas secundarias se muestran en un panel contextual superpuesto al lienzo. Sus componentes continúan montados para conservar el estado transitorio existente, pero solo la herramienta elegida está visible. No se unificaron contratos ni proveedores de IA: texto/voz, imagen y asistencia contextual comparten únicamente el espacio visual.

## Decisiones de layout

El shell usa todo el ancho y la altura útil del viewport. En escritorio amplio emplea tres áreas: rail compacto, lienzo flexible e inspector de 300–340 px. El documento ya no necesita desplazarse para alcanzar XMI o generación; el contenido extenso se desplaza dentro del panel correspondiente o del inspector.

El contenedor real de Apollon conserva su montaje, selección y flujo canónico existente. Solo cambió su contenedor de presentación para crecer con el viewport. No se modificaron Apollon, Yjs, adaptadores ni semánticas UML.

## Barra superior y proyectos

La barra superior prioriza:

- identidad del producto;
- nombre del proyecto;
- Guardado o Cambios sin guardar;
- Mis proyectos y Guardar;
- idioma y tema como controles secundarios.

Mis proyectos ahora cuenta con cabecera de producto, acción primaria integrada, formulario compacto y una cuadrícula adaptable de proyectos con nombre, última actualización y acción Abrir. El estado vacío ofrece una indicación concisa en vez de dejar una superficie sin propósito.

## Inspector contextual

Propiedades continúa reutilizando el inspector guiado aceptado. Con una clase o relación seleccionada prioriza sus controles existentes; sin selección muestra una instrucción breve para seleccionar un elemento. Colaboración conserva su funcionamiento y queda separada de IA, XMI, generación y JSON técnico.

## IA, XMI, validación y generación

Estas capacidades se abren desde el rail sin desplazamiento global:

- Asistente IA reúne visualmente texto/voz y ayuda contextual;
- Desde imagen conserva análisis, candidato y confirmación;
- Validación ofrece un resumen focalizado;
- XMI mantiene importación, exportación y estados;
- Generar conserva aptitud, advertencias y descarga Spring Boot.

La reorganización es exclusivamente presentacional. Los casos de uso, proveedores, validaciones y callbacks permanecen sin cambios.

## Diagnóstico técnico

El inspector de desarrollo, métricas, modelo Apollon y JSON canónico no fue eliminado. Se trasladó a un bloque `details` denominado Diagnóstico técnico, cerrado por defecto. Así sigue disponible para desarrollo y defensa académica sin dominar la operación normal.

## Estrategia de tema

Las superficies del shell usan variables semánticas compartidas para fondo de aplicación, superficies, elevación, bordes, texto, acento y estados de éxito, advertencia y error. El tema oscuro redefine esas variables de forma coherente, eliminando tarjetas blancas incrustadas en el entorno oscuro. Los controles conservan foco visible, contraste, etiquetas y estados deshabilitados reconocibles.

## Estrategia responsive

- Desde 1440 px: rail rotulado, lienzo dominante e inspector completo.
- Entre 1024 y 1439 px: rail más compacto e inspector más estrecho.
- Por debajo de 1024 px: el inspector adopta disposición superpuesta y las herramientas permanecen en drawer.
- En anchos pequeños se simplifican etiquetas y superficies; no se pretende convertir el modelador web en un editor UML móvil.

## Archivos principales

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/src/configuracion/PreferenciasUI.tsx`
- `frontend/src/paquetes/gestion_proyectos/casos_uso/cu01_crear_abrir_proyecto/PanelProyectos.tsx`
- `frontend/src/paquetes/gestion_proyectos/casos_uso/cu11_guardar_recuperar_trabajo/BarraProyectoActivo.tsx`
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases.tsx`
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/InspectorPropiedadesUML.tsx`
- pruebas E2E afectadas por la navegación explícita de herramientas y diagnósticos.

## Verificación

- Tests unitarios frontend: 187/187 PASS.
- Typecheck frontend: PASS.
- Build frontend: PASS; permanece la advertencia histórica de tamaño de chunk de Vite.
- Playwright: 20/20 PASS, incluida la regresión completa de los accesos reorganizados.

## Deuda visual restante

- Apollon mantiene su estilo visual propio y solo puede tematizarse mediante su superficie pública aceptada.
- El drawer de herramientas prioriza escritorio; una experiencia de modelado móvil completa sigue fuera de alcance.
- El chunk principal continúa siendo grande. Su división requiere una iteración técnica separada y no forma parte de esta profesionalización visual.
- Una evaluación visual posterior puede afinar espaciados en resoluciones y escalas de sistema menos frecuentes sin alterar esta arquitectura.

## Contextual AI quality patch

### Context contract

CU12 ahora recibe una representación semántica acotada del UML canónico actual, no solo cantidades. El payload contiene hasta 50 clases con sus atributos y operaciones, hasta 80 relaciones con tipo, roles y multiplicidades de extremo, la selección actual, errores/advertencias de CU08 separados, bloqueos/advertencias de CU09, idioma activo y revisión del modelo. No se envían posiciones, JSON crudo de Apollon, estado Yjs, imágenes ni diagnósticos de desarrollo.

La clase seleccionada incluye sus propiedades y relaciones conectadas. Una relación seleccionada incluye ambos extremos con nombres, roles y multiplicidades. Así, preguntas como «Explícame esta clase» o «¿Está bien esta cardinalidad?» se refieren a la selección real.

### Continuity and current-state precedence

El panel conserva en memoria como máximo ocho mensajes recientes —cuatro intercambios usuario/asistente— durante la página del proyecto actual. Las preguntas de seguimiento preservan referencias como «¿Qué atributos tendría?», «¿Por qué?» o «¿Y su cardinalidad?». El historial no se persiste ni se envía sin límites.

Cada pregunta vuelve a enviar el resumen canónico y la revisión más recientes. La instrucción de sistema de Groq establece este orden de autoridad:

1. modelo canónico actual;
2. elemento seleccionado actual;
3. estado actual de validación y generación;
4. conversación reciente.

Por ello, un cambio UML reemplaza cualquier supuesto conversacional anterior incompatible, evitando repetir recomendaciones obsoletas.

### Recommendation severity and business-scope safety

La respuesta estructurada clasifica la orientación como `INFORMATIVO`, `OBLIGATORIO`, `RECOMENDADO` u `OPCIONAL`. `OBLIGATORIO` se reserva para un problema concreto de corrección o validación. Las clases, atributos o relaciones nuevas sin evidencia actual deben presentarse como `OPCIONAL` e indicar la condición de negocio que las justificaría. Toda recomendación de multiplicidad debe explicar su significado de negocio y las alternativas cuando la regla del dominio no esté definida.

El prompt exige analizar en este orden: errores, advertencias, inconsistencias UML, multiplicidades dudosas, redundancias, aptitud Spring, mejoras sustentadas y, finalmente, extensiones opcionales del dominio. CU12 sigue siendo exclusivamente orientativo: no recibe callbacks de mutación ni puede ejecutar comandos de CU04.

### State-aware quick questions and answer presentation

El panel presenta tres o cuatro preguntas concisas según el estado:

- modelo inválido: problemas, correcciones y bloqueos de generación;
- modelo válido sin selección: aptitud, mejoras, posibles vacíos de dominio y cardinalidades;
- clase seleccionada: explicación, atributos y relaciones;
- relación seleccionada: explicación, cardinalidad y regla de negocio representada.

El área de respuestas conserva saltos de línea, muestra la clasificación estructurada y ofrece aproximadamente 8–10 líneas legibles antes de su desplazamiento interno. Las etiquetas en español e inglés permanecen centralizadas en `PreferenciasUI`.

### Patch verification

- Pruebas frontend: 193/193 PASS, incluidos payload canónico, selección, historial acotado, continuidad, precedencia del modelo actualizado, preguntas por estado y ES/EN.
- Pruebas backend: 196/196 PASS, incluidos el límite request/response de CU12, la lista permitida de acciones y la clasificación de recomendaciones.
- Typecheck frontend y backend: PASS.
- Build frontend y backend: PASS.
- Regresión Playwright relevante: 7/7 PASS para modelado asistido, edición UML canónica y comportamiento ES/EN/tema.

## Product-grounded contextual assistant patch

### Root cause and authoritative product context

CU12 already received the current canonical UML, selection, validation/generation state and bounded conversation, but it lacked an authoritative description of SW1 itself. Consequently, a language model could complete product-help gaps with generic CASE-tool conventions. A typed, source-controlled `ContextoProductoSW1` is now attached server-side to every Groq request. It contains only verified visible capabilities and flows; it excludes Apollon/Yjs internals, credentials, filesystem details and internal navigation identifiers.

Truth precedence is now explicit: current canonical UML, current selection, current validation/generation state, verified product capabilities, then recent conversation. Product questions are answered from the product context; model questions are answered from the canonical summary. Conversation may resolve a follow-up, but cannot override either authority.

### Clear AI responsibility boundaries

- CU04, exposed as **Asistente IA**, interprets text instructions against the current UML and automatically applies clear, valid incremental changes. **Hablar** transcribes into that same flow; CU04 has no confirmation step.
- CU05, exposed as **Desde imagen**, produces a candidate. The canonical model changes only after **Agregar al diagrama**; cancelling leaves it unchanged.
- CU12, labelled **Asistente contextual** in conversation, explains the product and analyzes the current model. It never mutates, saves, imports, exports or generates by itself.

### Product-help and model-analysis grounding

The prompt forbids inventing menus, icons, dialogs, views, gestures or XMI text editors and forbids showing internal actions such as `IR_A_GENERACION`. The response validator also rejects any visible answer containing a non-public action identifier. Suggested actions remain a strict internal whitelist and are rendered through translated visible UI labels. `MOSTRAR_IMAGEN_CANDIDATA` is only available when an image candidate actually exists.

For domain advice, CU12 must first verify what is already present, must not suggest an existing attribute as missing and must not confuse generated CRUD responsibilities with UML domain operations. UML validity and Spring readiness are reportable facts; business completeness is not asserted without requirements. Unsupported domain hypotheses are limited and labelled `OPCIONAL`, each with the business condition under which it would apply.

### Degraded-service UX and quick questions

Provider unavailability and rate limits now return a safe machine-readable type. The panel shows one persistent amber degraded-service notice while deterministic validation/orientation remains available, instead of appending repeated red failures to the conversation. Invalid structured output and unexpected internal failures remain true error states.

For a valid model without selection, primary quick questions now prioritize generation readiness, problems/risks, multiplicities and how to use modeling AI. This avoids leading users toward speculative domain expansion. Spanish and English labels distinguish the conversational **Asistente contextual** from the editing assistant.

### Verification for this final patch

Focused deterministic tests cover product-context inclusion and contents, absence of implementation details, internal-ID rejection, image-action availability, contextual speaker naming, bounded/current model payload, typed degraded errors, ES/EN quick questions and non-destructive CU12 behavior. The optional real Groq proof now exercises product help, XMI help, an existing `Cliente.correo`, optional-scope qualification and current-model precedence after conversation, while retaining the direct N:M and no-mutation gates.

- Frontend tests: 199/199 PASS.
- Backend tests: 204/204 PASS.
- Frontend/backend typecheck and build: PASS; the historical Vite chunk-size warning remains non-blocking.
- Relevant Playwright regression: 9/9 PASS across CU04 text, CU04 voice and CU05 image flows.
- Real Groq proof (`openai/gpt-oss-20b`): PASS with `semanticCondition=true`. It confirmed grounded IA/XMI help, no duplicate `correo` recommendation, qualified optional scope, current-model precedence, hidden internal actions, whitelisted suggestions and zero model mutation.

### Product-help factual precision correction

Manual acceptance identified two wording ambiguities in the otherwise grounded product help. The authoritative capability context now states that **Hablar** records and transcribes the instruction and then sends it automatically through the existing CU04 modeling flow; the user does not press **Enviar** after successful voice recognition.

XMI help now states precisely that **Importar XMI** selects a `.xmi` or `.xml` file, requests confirmation because the operation replaces the current diagram, imports the canonical model after confirmation and may show import warnings. It does not describe an intermediate preview: reviewed candidate confirmation remains exclusive to **Desde imagen**. **Exportar XMI** downloads the current model as `modelo.xmi` for interoperability and is neither required by nor part of Spring generation.

Deterministic tests assert these voice/import/export facts in the typed product context. The optional real Groq proof also rejects instructions that require pressing **Enviar** after **Hablar**, XMI candidate/preview claims, and claims that XMI is required for Spring generation.

The live Groq rerun for this micro-correction was attempted, but the provider returned the controlled `no_disponible` state after earlier acceptance calls. Therefore the previous product-grounded Groq acceptance remains historical evidence, while the two new factual assertions are covered deterministically and remain ready for a later optional live rerun; normal test suites do not depend on provider availability.

## CU12 scope realignment

### Corrected responsibility

CU12 had begun to drift from contextual help toward speculative domain design. Its final responsibility is now **product guidance plus contextual explanation**. It teaches verified SW1 workflows and explains facts already present in the canonical UML, selected element, CU08 validation and CU09 generation readiness. It remains advisory and cannot mutate UML, projects, persistence, XMI or generated backends.

CU12 no longer treats questions such as «¿Qué podría faltar en mi dominio?» as permission to invent entities, attributes, actors, modules or workflows. Without supplied requirements or use cases, it explains that SW1 can establish structural UML validity and Spring readiness, but cannot prove functional/business completeness. If the user explicitly requests an idea, the Groq prompt permits at most one clearly hypothetical `OPCIONAL` example with its business condition.

### Deterministic product help

A small application-owned matcher now answers high-value product topics before Groq: modeling AI, voice, From image, manual UML editing, validation, XMI, Spring generation, projects/save and the contextual assistant role. It uses the typed `ContextoProductoSW1` facts and the current validation/generation context. This is bounded keyword normalization, not a second chatbot, semantic classifier or domain engine.

The deterministic layer preserves the verified distinctions: CU04 text uses **Enviar** and automatically applies clear valid changes; CU04 voice transcribes and automatically sends without another click; CU05 alone produces a candidate requiring **Agregar al diagrama** or **Cancelar**; XMI import confirms replacement directly; XMI export downloads `modelo.xmi`; generation depends on the current CU09 profile.

### Degraded and recovery behavior

Responses identify whether their origin is deterministic or Groq. A `no_disponible`/rate-limit failure creates one amber degraded notice and no repeated conversation failure. Deterministic product help continues working while that notice remains truthful. Only a later successful Groq response clears it; malformed provider contracts continue to produce a real error.

### Final quick actions

The valid-model actions focus on Spring readiness, SW1-detected risks, multiplicities and how to use modeling AI. A selected class offers editing, explanation, attribute modification and relationship review. A selected relationship offers explanation, cardinality editing, multiplicity meaning and generation impact. Invalid models focus on errors, correction and generation blockers. Speculative domain completion is not a primary action.

### Final scope verification

Focused tests cover deterministic operation without Groq, factual voice/image/XMI help, state-aware Spring help, the business-completeness boundary, ES/EN, non-speculative quick actions, single degraded notice, deterministic help during degradation, recovery after later Groq success, invalid-provider errors, no mutation and the pre-existing bounded context/conversation contract.

- Frontend tests: 200/200 PASS.
- Backend tests: 208/208 PASS.
- Frontend/backend typecheck and build: PASS; the historical Vite chunk-size warning remains non-blocking.
- Relevant CU12/UX Playwright: 5/5 PASS, including factual offline product help and the business-completeness boundary.
- The optional real Groq proof was attempted once for this final closure, but the configured provider returned the controlled `no_disponible` state. Product help and objective state guidance remain operational through the deterministic layer; the normal regression does not depend on live Groq.
