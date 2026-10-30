# NexoCASE — Segundo Parcial de SW1
## Fase 2 — Diseño funcional de la experiencia colaborativa con IA

**Estado:** Documento funcional de referencia para implementación  
**Prerequisito:** Fase 1 — Consolidación del alcance y línea base aprobada  
**Equipo:** 2 integrantes  
**Producto:** NexoCASE  
**Actor funcional único:** Diseñador de software  
**Proveedor IA previsto:** Groq  
**Persistencia prevista:** MongoDB  
**Siguiente fase:** Fase 3 — Arquitectura objetivo y diseño de persistencia MongoDB

---

# 1. Propósito de la fase

La Fase 2 define **cómo debe comportarse NexoCASE desde el punto de vista funcional** después de incorporar la nueva experiencia de inteligencia artificial colaborativa requerida para el segundo parcial.

Esta fase no tiene como objetivo decidir todavía colecciones definitivas de MongoDB, clases concretas, endpoints finales, librerías, índices, DTO, esquemas físicos ni detalles de despliegue. Tampoco es una fase de programación.

Su propósito es responder antes de implementar a preguntas como:

- ¿Cómo entra un Diseñador de software a un proyecto?
- ¿Cómo se identifica dentro de ese proyecto sin crear cuentas?
- ¿Qué ocurre cuando varios diseñadores están conectados al mismo tiempo?
- ¿Qué información es compartida?
- ¿Qué información debe persistir cuando todos se desconectan?
- ¿Qué puede consultar a la IA?
- ¿Qué diferencia existe entre preguntar, revisar y solicitar una modificación?
- ¿Cómo entiende la IA referencias como “esa clase”, “agrégale”, “corrígelo” o “lo que hizo Carlos”? 
- ¿Cuándo puede actuar sin volver a preguntar y cuándo debe solicitar aclaración?
- ¿Cómo se conserva quién hizo qué?
- ¿Cómo se mantiene la función pedagógica de CU12?
- ¿Cómo se utiliza CU04 como mecanismo controlado para ejecutar cambios?
- ¿Cómo se evita que Groq invente hechos que NexoCASE ya puede conocer de forma determinista?

La salida de esta fase debe ser lo suficientemente precisa para que otro agente o desarrollador pueda implementar el comportamiento sin reinterpretar el producto.

---

# 2. Punto de partida aprobado en Fase 1

## 2.1. Principio general

El segundo parcial **evoluciona NexoCASE; no lo reemplaza**.

Todo lo funcional del primer parcial debe continuar disponible salvo los ajustes expresamente documentados en esta fase.

La nueva capacidad central será una **IA colaborativa integrada al proyecto**, capaz de enseñar, explicar, revisar, mantener contexto compartido y ejecutar modificaciones UML únicamente cuando un Diseñador de software lo solicite.

## 2.2. Decisiones congeladas heredadas

Se mantienen como decisiones del equipo:

- React como frontend actual.
- Node.js + TypeScript + Express como backend actual de NexoCASE.
- Apollon como editor visual.
- Modelo UML canónico como fuente semántica central.
- Yjs/WebSocket como base existente para colaboración en tiempo real.
- Groq como proveedor de IA.
- MongoDB como persistencia no relacional objetivo para NexoCASE.
- Sin IA local.
- Sin entrenamiento o fine-tuning como requisito.
- Sin login.
- Sin correo.
- Sin contraseña.
- Sin OAuth.
- Sin roles complejos.
- Sin aplicación móvil obligatoria.
- Sin conversaciones privadas dentro del proyecto.
- Sin creación artificial de nuevos casos de uso por cada operación técnica.
- Se mantienen **12 casos de uso funcionales**.

## 2.3. Casos de uso que evolucionan

Los casos de uso con impacto directo en el segundo parcial son:

- **CU01 — Crear o acceder a proyecto.**
- **CU03 — Colaborar en el modelado.**
- **CU04 — Modelar con IA mediante texto/voz.**
- **CU11 — Guardar y recuperar proyecto.**
- **CU12 — Asistir colaborativamente al equipo.**

Los demás casos de uso se conservan y deberán pasar pruebas de regresión posteriormente.

## 2.4. Casos de uso que se conservan funcionalmente

- CU02 — Modelar diagrama de clases manualmente.
- CU05 — Modelar desde imagen.
- CU06 — Importar XMI.
- CU07 — Exportar XMI.
- CU08 — Validar modelo UML.
- CU09 — Generar backend Spring Boot.
- CU10 — Descargar backend generado.

---

# 3. Modelo conceptual de la nueva experiencia

## 3.1. Proyecto colaborativo

Un **proyecto colaborativo** es el espacio lógico donde uno o más Diseñadores de software trabajan sobre un mismo modelo UML y comparten:

- modelo actual;
- presencia de participantes conectados;
- conversación colaborativa;
- respuestas de IA;
- actividad relevante del proyecto;
- continuidad entre sesiones;
- información necesaria para que CU12 y CU04 actúen en contexto.

Cada proyecto debe estar **aislado** de cualquier otro proyecto.

Un Diseñador de software que accedió al Proyecto A no obtiene por ello acceso al Proyecto B.

## 3.2. Participante

Un **participante** es la representación funcional de un Diseñador de software dentro de un proyecto.

No constituye una cuenta autenticada.

Debe poseer, como mínimo:

- un identificador técnico no visible o secundario;
- un nombre visible o apodo;
- referencia al proyecto al que accedió;
- estado de presencia cuando corresponda;
- información suficiente para asociar acciones, mensajes y consultas.

## 3.3. Conversación compartida

La **conversación compartida** contiene los mensajes realizados dentro del proyecto relacionados con la interacción colaborativa y la IA.

Características:

- todos los participantes autorizados del proyecto pueden verla;
- las preguntas a la IA no son privadas;
- las respuestas de IA tampoco son privadas;
- debe conservar el autor real de cada mensaje;
- debe persistir para permitir continuidad;
- puede utilizarse como una fuente de contexto, pero no debe ser la única fuente de verdad.

## 3.4. Actividad del proyecto

La **actividad del proyecto** registra hechos relevantes ocurridos en el trabajo colaborativo.

Ejemplos:

- Carlos creó la clase `Venta`.
- Renato agregó `total: Double` a `Venta`.
- Ana cambió una multiplicidad.
- Renato solicitó a la IA crear `Producto`.
- La IA ejecutó una modificación solicitada por Renato.
- Se importó un archivo XMI.

La actividad no debe confundirse con la conversación.

Una conversación expresa lo que alguien dijo.

Una actividad expresa lo que efectivamente ocurrió en el sistema.

## 3.5. Modelo UML actual

El modelo UML canónico continúa siendo la fuente de verdad del estado actual del diseño.

La conversación no puede contradecirlo.

Si un mensaje antiguo habla de una clase que después fue eliminada, la IA debe considerar el **modelo actual** antes de asumir que dicha clase sigue existiendo.

## 3.6. Contexto compartido

El contexto compartido es la información relevante que permite a la IA interpretar correctamente una consulta.

Puede incluir:

- proyecto actual;
- participante actual;
- modelo UML actual;
- elemento seleccionado;
- foco conversacional;
- conversación reciente;
- actividad relacionada;
- estado de validación;
- aptitud Spring;
- información autoritativa sobre las capacidades de NexoCASE.

No implica enviar toda la base de datos ni toda la conversación a Groq en cada solicitud.

## 3.7. Diferencia entre tres fuentes fundamentales

Ejemplo:

```text
Mensaje:
"¿Quién creó Venta?"

Actividad:
"Carlos creó la clase Venta"

Modelo actual:
Clase Venta
```

La IA debe usar cada fuente para el propósito correcto.

---

# 4. Actor funcional y responsabilidades

## 4.1. Actor único: Diseñador de software

Para el modelo funcional del segundo parcial se establece **un único actor funcional**:

> **Diseñador de software**

No se crean actores separados para “administrador”, “propietario”, “invitado”, “observador”, “anfitrión” o “usuario IA”.

El Diseñador de software puede:

- crear un proyecto;
- acceder a un proyecto mediante código;
- reabrir proyectos previamente autorizados en su dispositivo;
- modelar manualmente;
- colaborar con otros diseñadores;
- consultar a la IA;
- solicitar modificaciones mediante IA;
- importar y exportar XMI;
- validar el modelo;
- generar el backend soportado;
- guardar y recuperar el trabajo.

## 4.2. IA como capacidad del sistema, no como actor funcional principal

La IA colaborativa no se modelará como un segundo actor funcional del negocio.

Se considera una capacidad interna/externa integrada a NexoCASE que presta asistencia al Diseñador de software.

Groq es un proveedor externo técnico, pero no representa un actor funcional adicional en el diagrama general de casos de uso del producto.

## 4.3. Responsabilidades de la IA

La IA puede:

- enseñar a utilizar NexoCASE;
- explicar conceptos UML;
- explicar elementos del modelo actual;
- revisar el estado del modelo;
- explicar errores y advertencias reales;
- explicar aptitud de generación Spring;
- consultar actividad del proyecto;
- identificar, cuando exista evidencia, quién realizó una acción;
- mantener contexto conversacional;
- resolver referencias contextuales claras;
- recomendar mejoras fundamentadas;
- delegar a CU04 una modificación solicitada explícitamente.

## 4.4. Responsabilidades que NO corresponden a la IA

La IA no debe:

- modificar el modelo por iniciativa propia;
- inventar requisitos;
- inventar quién realizó una acción;
- reemplazar los validadores deterministas existentes;
- inventar funcionalidades de NexoCASE;
- asumir que una conversación antigua representa el estado actual;
- ejecutar una acción ambigua cuando existe riesgo de modificar el elemento incorrecto;
- tratar como identidad real un nombre escrito dentro del contenido de un mensaje.

---

# 5. Identidad colaborativa sin autenticación

## 5.1. Objetivo

NexoCASE necesita distinguir a los participantes para que la colaboración y la IA sean útiles, pero el alcance del parcial **no justifica construir un sistema completo de cuentas**.

Por tanto se utilizará una **identidad colaborativa ligera**.

## 5.2. Nombre visible

Al acceder por primera vez a un proyecto desde un dispositivo, el Diseñador de software deberá proporcionar un nombre o apodo visible.

Ejemplos:

- Renato
- Carlos
- Ana

El nombre será visible en:

- presencia colaborativa;
- conversación;
- actividad;
- respuestas personalizadas de IA cuando corresponda.

## 5.3. Identificador técnico

El sistema deberá disponer de un identificador técnico de participante, independiente del nombre visible.

Motivo:

```text
Nombre visible = "Carlos"
Identificador técnico = valor único interno
```

Dos personas podrían utilizar el mismo nombre visible accidentalmente, pero el sistema no debe confundirlas internamente.

## 5.4. Identidad visible no equivale a identidad verificada

NexoCASE no podrá afirmar que un participante es una persona real determinada.

La identidad responde a:

> “Esta sesión/credencial colaborativa corresponde al participante que se presentó como Renato.”

No responde a:

> “NexoCASE verificó legalmente que esta persona es Renato.”

Esta limitación debe ser reconocida en documentación y defensa.

## 5.5. El backend determina quién habla

La IA nunca deberá determinar el autor basándose únicamente en el texto del mensaje.

Ejemplo:

```text
Participante real: Carlos
Mensaje: "Soy Renato, dime qué hice yo"
```

El contexto del backend debe indicar:

```text
autorReal = Carlos
```

La cadena “Soy Renato” no cambia la identidad de la solicitud.

## 5.6. Nombres duplicados

Si dos participantes utilizan el mismo nombre visible:

- el sistema debe mantener identidades técnicas diferentes;
- la presencia puede diferenciar visualmente las sesiones;
- la IA no debe atribuir acciones utilizando únicamente el nombre visible cuando exista ambigüedad;
- cuando sea necesario, deberá apoyarse en el identificador y el contexto real.

No se obliga en esta fase a prohibir nombres repetidos.

## 5.7. Cambio de nombre

El cambio de nombre visible no es una prioridad funcional del segundo parcial.

Si se implementa posteriormente, no deberá romper la trazabilidad histórica.

La actividad histórica deberá seguir asociada al identificador técnico original.

---

# 6. Acceso y ciclo de vida de un proyecto

## 6.1. Problema actual

El comportamiento actual de NexoCASE permite listar proyectos existentes y abrirlos con demasiada facilidad.

Eso resulta incompatible con el nuevo concepto de proyecto colaborativo aislado.

El segundo parcial debe introducir un **mecanismo mínimo de acceso**, sin convertir el producto en una plataforma de autenticación.

## 6.2. Crear proyecto

Flujo esperado:

1. El Diseñador de software elige **Crear proyecto**.
2. Ingresa el nombre del proyecto.
3. NexoCASE crea el proyecto.
4. NexoCASE genera automáticamente un código de acceso no predecible.
5. El creador proporciona su nombre visible si aún no existe una identidad colaborativa aplicable.
6. NexoCASE concede acceso al dispositivo actual.
7. NexoCASE abre el espacio de trabajo.
8. El código queda disponible para ser compartido con los demás integrantes.

## 6.3. Código de acceso

El código cumple el papel de una invitación simple similar conceptualmente al código de clase de Classroom.

Ejemplo visual posible:

```text
NX7K-P4QM
```

El formato exacto se decidirá técnicamente después.

Reglas funcionales:

- debe ser generado por el sistema;
- no debe ser el mismo valor que el `proyectoId` interno;
- no debe ser fácilmente predecible;
- debe ser único entre proyectos activos;
- poseer el identificador interno del proyecto no debe ser suficiente para acceder;
- debe validarse en backend, no únicamente en frontend.

## 6.4. Unirse mediante código

Flujo esperado:

1. El Diseñador de software selecciona **Unirse a proyecto**.
2. Ingresa el código recibido.
3. NexoCASE valida el código.
4. Si es válido, solicita el nombre visible cuando sea necesario.
5. Registra/recupera la identidad colaborativa del dispositivo para ese acceso.
6. Concede acceso al proyecto.
7. Carga el estado persistido.
8. Conecta la colaboración en tiempo real.

## 6.5. Código inválido

**Given** un Diseñador de software intenta ingresar a un proyecto,  
**When** proporciona un código que no corresponde a un proyecto accesible,  
**Then** NexoCASE debe rechazar el acceso sin revelar información innecesaria sobre proyectos existentes.

Mensaje esperado conceptualmente:

> “El código de proyecto no es válido.”

No se debe mostrar una lista de posibles proyectos para ayudar a adivinarlo.

## 6.6. Proyectos recientes

Como no existen cuentas, el concepto actual de **“Mis proyectos”** no es correcto.

Se reemplazará conceptualmente por:

> **Proyectos recientes**

Representa proyectos a los que **ese dispositivo/navegador** ya obtuvo acceso previamente.

No significa propiedad ni pertenencia asociada a una cuenta.

## 6.7. Reingreso desde el mismo dispositivo

El objetivo es evitar que el equipo tenga que escribir el código cada vez que abre NexoCASE.

Por tanto:

**Given** un Diseñador de software ya accedió correctamente al Proyecto A desde un navegador/dispositivo,  
**When** vuelve posteriormente y la credencial local de acceso continúa válida,  
**Then** el proyecto debe aparecer en **Proyectos recientes** y podrá reabrirse sin volver a ingresar el código.

La implementación exacta de la credencial local se define en Fase 3.

Puede ser, por ejemplo, una credencial opaca asociada al proyecto; **no se congela en esta fase almacenar el código en texto plano**.

## 6.8. Reingreso desde otro dispositivo o navegador

**Given** el mismo Diseñador de software intenta ingresar desde otro dispositivo, otro navegador o un almacenamiento local limpio,  
**When** NexoCASE no dispone de una credencial previa válida,  
**Then** deberá introducir nuevamente el código del proyecto.

Debido a la ausencia de cuentas, NexoCASE no puede reconocer automáticamente que ambas máquinas pertenecen a la misma persona.

## 6.9. Qué ocurre cuando el último usuario se desconecta

Esta regla debe quedar totalmente explícita.

> **Un proyecto NO depende de que exista un anfitrión conectado.**

Cuando el último Diseñador de software abandona o pierde conexión:

1. La presencia en tiempo real pasa a cero participantes conectados.
2. La conexión colaborativa WebSocket/Yjs asociada a clientes puede finalizar.
3. El proyecto **continúa existiendo**.
4. El modelo guardado debe continuar disponible.
5. La conversación persistida debe continuar disponible.
6. La actividad registrada debe continuar disponible.
7. La credencial de acceso previamente concedida al dispositivo continúa según su política de validez.
8. No se elimina ni reinicia el proyecto.
9. No es necesario mantener una computadora de un participante encendida.
10. El siguiente participante que ingrese recuperará la continuidad desde persistencia.

El estado “cero usuarios conectados” significa únicamente:

> **No existe presencia activa en este momento.**

No significa:

> **La sesión/proyecto fue destruido.**

## 6.10. Reinicio de la colaboración después de estar vacío

Cuando un Diseñador de software entra a un proyecto que llevaba un tiempo sin participantes:

1. NexoCASE valida su acceso.
2. Recupera el proyecto persistido.
3. Recupera el modelo UML persistido.
4. Recupera la conversación relevante.
5. Recupera la actividad necesaria.
6. Establece la presencia del nuevo participante.
7. Inicializa nuevamente la colaboración en tiempo real.
8. Los siguientes participantes se sincronizan con ese estado vigente.

No se considera una “nueva versión” del proyecto ni otro proyecto diferente.

## 6.11. Aislamiento de proyectos

Todos los recursos colaborativos deben pertenecer explícitamente a un proyecto.

Conceptualmente:

```text
Proyecto A
├── modelo
├── participantes
├── conversación
├── actividad
└── contexto

Proyecto B
├── modelo
├── participantes
├── conversación
├── actividad
└── contexto
```

Ninguna consulta de IA en Proyecto A debe recuperar accidentalmente hechos de Proyecto B.

## 6.12. Regeneración del código

No se declara como requisito obligatorio en esta fase.

Motivo:

Sin cuentas ni propiedad verificada, introducir una operación de “regenerar código” obliga a definir quién posee autoridad para hacerlo.

Se deja como mejora futura o decisión de arquitectura si aparece un mecanismo mínimo y claro de control.

---

# 7. Experiencia colaborativa — evolución de CU03

## 7.1. Objetivo actualizado

CU03 deja de representar únicamente “dos navegadores editan el mismo diagrama”.

Debe representar una experiencia de trabajo donde varios Diseñadores de software autorizados comparten el mismo proyecto.

## 7.2. Capacidades de colaboración

Dentro del proyecto, los participantes deben poder:

- ver el mismo modelo;
- observar cambios sincronizados;
- conocer quiénes están conectados;
- utilizar la conversación compartida;
- observar preguntas de otros participantes a la IA;
- observar respuestas de la IA;
- observar cambios resultantes de solicitudes realizadas a la IA;
- recuperar el trabajo después de una desconexión o jornada posterior.

## 7.3. Presencia

La presencia representa participantes actualmente conectados.

No representa todos los participantes históricos del proyecto.

Ejemplo:

```text
Participantes conectados ahora:
- Renato
- Carlos
```

Ana pudo haber participado ayer, aparecer en actividad histórica y no estar conectada actualmente.

## 7.4. Sincronización inicial

Cuando un participante se incorpora a un proyecto activo debe recibir un estado coherente del modelo antes de comenzar a trabajar.

No deberá aparecer temporalmente con un diagrama vacío si existe un proyecto persistido y activo.

## 7.5. Cambios concurrentes

La colaboración en tiempo real existente seguirá siendo responsable de sincronizar los cambios visuales compatibles.

La Fase 2 no redefine internamente el algoritmo de Yjs.

Sí establece la regla funcional:

> Todos los participantes autorizados deben converger hacia un estado de modelo coherente.

## 7.6. Desconexión temporal

Una desconexión de red no debe interpretarse automáticamente como eliminación del participante o del proyecto.

Cuando un cliente se reconecte:

- debe recuperar el estado vigente;
- debe evitar sobrescribir el trabajo nuevo con un estado obsoleto;
- debe restablecer presencia.

Los detalles de resolución técnica pertenecen a fases posteriores.

## 7.7. Tiempo real y persistencia no son lo mismo

Se congela la siguiente separación:

```text
Yjs / WebSocket
= sincronización mientras existen clientes conectados

MongoDB
= continuidad persistente del proyecto y su contexto relevante
```

No se considerará correcto utilizar exclusivamente la memoria del WebSocket como persistencia.

---

# 8. Diseño de la conversación colaborativa

## 8.1. Objetivo

La conversación será el espacio visible donde los Diseñadores de software interactúan con la IA dentro del proyecto.

No pretende reemplazar WhatsApp, Slack o Discord.

Su propósito es soportar el proceso de modelado y asistencia contextual.

## 8.2. Tipos conceptuales de mensajes

Como mínimo se diferenciarán conceptualmente:

### Mensaje de diseñador

Ejemplo:

> Renato: ¿Quién creó la clase Venta?

### Respuesta de IA

Ejemplo:

> IA: Renato, la clase Venta fue creada por Carlos.

### Mensaje de sistema cuando sea útil

Ejemplo:

> Sistema: Carlos se ha conectado.

No es obligatorio inundar la conversación con eventos técnicos.

## 8.3. Visibilidad

Toda conversación con IA realizada dentro del proyecto es compartida.

No existen chats privados con la IA dentro del alcance del segundo parcial.

## 8.4. Autoría

Cada mensaje de diseñador debe conservar:

- participante real que lo originó;
- nombre visible al momento de presentarlo;
- proyecto;
- momento aproximado/fecha-hora;
- contenido.

La IA no debe inferir esta autoría desde el texto.

## 8.5. Persistencia

La conversación debe persistir para soportar:

- continuidad entre días;
- contexto posterior;
- incorporación tardía;
- preguntas sobre conversaciones previas cuando resulten relevantes.

## 8.6. Conversación larga

Persistir toda la conversación no implica enviar todo a Groq en cada mensaje.

Se deberá distinguir entre:

```text
historial persistido completo
≠
contexto enviado al modelo en cada consulta
```

El backend seleccionará información relevante según el diseño posterior.

## 8.7. Incorporación tardía

Un participante que accede a un proyecto después de que otros trabajaron debe poder recuperar una vista suficiente de la conversación y actividad para comprender el contexto.

Esto habilita consultas como:

> “¿Qué hicieron antes de que entrara?”

La respuesta debe basarse en actividad registrada y contexto real, no en una invención del modelo.

---

# 9. Evolución funcional de CU12 — Asistir colaborativamente al equipo

## 9.1. Nombre funcional actualizado

> **CU12 — Asistir colaborativamente al equipo**

## 9.2. Actor

Diseñador de software.

## 9.3. Objetivo

Permitir que un Diseñador de software solicite orientación, explicación, revisión o información contextual a una IA integrada al proyecto, utilizando el estado real de NexoCASE y el contexto compartido del equipo.

## 9.4. CU12 conserva su función pedagógica

CU12 **seguirá enseñando a utilizar NexoCASE**.

Ejemplos:

- “¿Cómo importo un XMI?”
- “¿Cómo exporto el diagrama?”
- “¿Dónde valido el modelo?”
- “¿Cómo genero el backend?”
- “¿Cómo funciona el modelado desde imagen?”
- “¿Cómo utilizo la voz?”

Las respuestas deben basarse en información autoritativa del propio producto.

## 9.5. Mentor conceptual UML

CU12 podrá responder preguntas teóricas pertinentes al modelado.

Ejemplos:

- “¿Qué significa 0..*?”
- “¿Qué es una clase asociativa?”
- “¿Qué diferencia hay entre agregación y composición?”
- “¿Qué es un atributo derivado?”

El objetivo es funcionar como mentor dentro del contexto del trabajo.

## 9.6. Explicación del modelo actual

CU12 podrá explicar hechos del modelo canónico actual.

Ejemplos:

- “¿Qué atributos tiene Venta?”
- “¿Con qué clases está relacionada Cliente?”
- “¿Qué significa esta multiplicidad?”
- “Explícame esta clase.”

## 9.7. Revisión

CU12 podrá revisar el modelo utilizando:

- modelo actual;
- CU08/validador cuando aplique;
- aptitud de generación Spring cuando aplique;
- reglas autoritativas del producto.

Ejemplo:

> “¿Por qué no puedo generar?”

CU12 no deberá inventar una causa si el evaluador de generación ya dispone de la respuesta real.

## 9.8. Consultas sobre actividad

CU12 podrá responder preguntas sobre hechos registrados.

Ejemplos:

- “¿Quién creó Venta?”
- “¿Qué modificó Carlos?”
- “¿Quién cambió esta relación?”
- “¿Qué se hizo mientras no estaba?”

Cuando el sistema no posea evidencia suficiente, CU12 deberá reconocerlo.

## 9.9. Respuesta dirigida al interlocutor

La IA debe conocer qué participante realizó la consulta.

Ejemplo:

```text
Renato: ¿Qué problema tiene Venta?
IA: Renato, actualmente Venta...
```

No es obligatorio repetir el nombre en absolutamente cada respuesta si ello vuelve antinatural la conversación, pero el sistema debe demostrar que conoce al interlocutor y debe utilizar esa identidad cuando aporta claridad.

## 9.10. Conversación encadenada

CU12 debe comprender continuaciones contextualmente claras.

Ejemplo:

```text
Renato: ¿Qué problema tiene Venta?
IA: Venta no tiene relación con Cliente.
Renato: ¿Eso bloquea la generación?
```

“Eso” debe vincularse con el problema previamente discutido si no existe ambigüedad.

## 9.11. CU12 continúa siendo asesor, no ejecutor

CU12 no modificará directamente el modelo.

Cuando la intención sea realizar un cambio, la solicitud deberá pasar al mecanismo de acción correspondiente a CU04 mediante la orquestación funcional definida más adelante.

---

# 10. Evolución funcional de CU04 — ejecución de cambios solicitados

## 10.1. Responsabilidad

CU04 continuará siendo el componente funcional responsable de interpretar y aplicar modificaciones UML solicitadas mediante IA.

## 10.2. Solicitud directa

Ejemplo:

> “Crea una clase Cliente con id Long y nombre String.”

Si la instrucción es clara y válida, CU04 podrá ejecutar el cambio de acuerdo con sus reglas existentes.

## 10.3. Solicitud contextual

Ejemplo:

```text
Renato: ¿Quién creó Venta?
IA: Carlos creó Venta.
Renato: Agrégale observacion String.
```

La solicitud completa funcionalmente significa:

> Agregar `observacion: String` a la clase `Venta`.

El orquestador debe resolver el referente y entregar una orden inequívoca a CU04.

## 10.4. CU04 no debe recibir ambigüedad peligrosa

Si el sistema no puede resolver con suficiente certeza qué elemento debe modificar, la modificación no debe ejecutarse.

Debe solicitar aclaración.

## 10.5. Modificación solicitada por IA colaborativa

Cuando una acción se origine en la conversación:

- debe conservarse quién la solicitó;
- debe registrarse que fue ejecutada mediante IA;
- los demás colaboradores deben observar el cambio;
- el modelo canónico continúa siendo la verdad final.

## 10.6. Acción destructiva

Órdenes destructivas como eliminar clases o relaciones merecen especial precaución cuando dependen de referencias implícitas.

Ejemplo:

> “Bórralo.”

Solo debe ejecutarse si el referente es inequívoco bajo las reglas posteriores.

---

# 11. Orquestador funcional de IA colaborativa

## 11.1. Propósito

La interfaz colaborativa no debe obligar al Diseñador de software a elegir manualmente “CU12” o “CU04” para cada mensaje.

Se introducirá conceptualmente un **orquestador de IA colaborativa** que determina la naturaleza de la intención.

## 11.2. Clasificaciones mínimas

### Consulta de producto

Ejemplo:

> “¿Cómo exporto XMI?”

Destino funcional: CU12.

### Consulta conceptual

Ejemplo:

> “¿Qué significa composición?”

Destino funcional: CU12.

### Consulta del modelo

Ejemplo:

> “¿Qué atributos tiene Venta?”

Destino funcional: CU12.

### Consulta histórica/de actividad

Ejemplo:

> “¿Quién creó Venta?”

Destino funcional: CU12 + fuente de actividad.

### Revisión

Ejemplo:

> “Revisa esta relación.”

Destino funcional: CU12 apoyado por fuentes deterministas.

### Modificación explícita

Ejemplo:

> “Agrega total Double a Venta.”

Destino funcional: CU04.

### Modificación contextual

Ejemplo:

> “Corrígelo.”

Destino funcional: resolver contexto; si es inequívoco, CU04; si no, aclaración.

## 11.3. El orquestador no es un agente autónomo

El orquestador clasifica, recupera contexto y deriva la solicitud.

No obtiene permiso para rediseñar el modelo por cuenta propia.

---

# 12. Modelo funcional de contexto para la IA

## 12.1. Contexto del participante

Debe permitir conocer:

- quién envió el mensaje;
- cuál es su identificador técnico;
- cuál es su nombre visible;
- en qué proyecto está trabajando.

## 12.2. Contexto del proyecto

Debe permitir conocer:

- proyecto actual;
- participantes relevantes;
- estado persistido necesario;
- actividad relevante.

## 12.3. Modelo UML actual

Para preguntas relacionadas con UML, el modelo actual tiene prioridad sobre conversaciones antiguas.

## 12.4. Elemento seleccionado

Cuando el usuario tenga una clase o relación seleccionada, puede constituir una señal de contexto.

No obstante, no debe utilizarse ciegamente si la conversación establece claramente otro referente.

## 12.5. Foco conversacional

El sistema podrá mantener un **foco conversacional**.

Ejemplo:

```text
foco = Clase Venta
```

Esto facilita interpretar:

- “agrégale...”
- “revísala”
- “¿quién la creó?”

El foco no debe sobrevivir indefinidamente si deja de ser válido.

## 12.6. Conversación reciente

Se utilizará para resolver continuaciones próximas.

No se congela un número fijo de mensajes en esta fase.

El límite actual de ocho mensajes puede cambiar si el diseño posterior lo justifica.

## 12.7. Conversación histórica

La conversación completa podrá persistir, pero el modelo no necesita recibirla completa en cada llamada.

La arquitectura futura podrá utilizar:

- ventanas recientes;
- resúmenes;
- selección de mensajes relevantes.

## 12.8. Actividad reciente

Debe permitir responder hechos de autoría y continuidad.

## 12.9. Estado de validación

Cuando la pregunta sea sobre errores UML, el validador existente debe tener mayor autoridad que la interpretación libre del LLM.

## 12.10. Aptitud Spring

Cuando la pregunta sea sobre generación, el evaluador de aptitud debe ser fuente autoritativa.

## 12.11. Contexto de producto NexoCASE

Debe describir de forma mantenible:

- capacidades reales;
- accesos visibles;
- restricciones;
- comportamiento de XMI;
- comportamiento de imagen;
- voz;
- validación;
- generación;
- colaboración;
- nuevas reglas del segundo parcial.

## 12.12. Jerarquía de verdad

Se adopta la siguiente regla conceptual:

```text
Datos y eventos reales del proyecto
        ↓
Modelo UML canónico actual
        ↓
Validadores/evaluadores deterministas
        ↓
Contexto autoritativo de NexoCASE
        ↓
Contexto conversacional relevante
        ↓
Razonamiento del LLM
```

El LLM interpreta; no sustituye las fuentes reales.

---

# 13. Resolución de referencias contextuales

## 13.1. Objetivo

Permitir una conversación natural sin obligar al usuario a repetir nombres completos en cada turno.

## 13.2. Referente explícito

Ejemplo:

> “Agrega observacion String a Venta.”

No existe necesidad de inferencia significativa.

## 13.3. Referente implícito claro

Ejemplo:

```text
Usuario: Explícame Venta.
IA: ...
Usuario: Agrégale observacion String.
```

“le” se refiere a `Venta`.

## 13.4. Pronombres y expresiones esperadas

El sistema debe procurar comprender referencias como:

- esa clase;
- esa relación;
- agrégale;
- quítale;
- elimínalo;
- corrígelo;
- revísala;
- la anterior;
- lo que creó Carlos;
- lo que te mencioné;
- esa multiplicidad.

## 13.5. Referente por actividad

Ejemplo:

> “Revisa la clase que acaba de crear Carlos.”

El sistema deberá consultar actividad reciente para identificar el elemento si existe una coincidencia inequívoca.

## 13.6. Ambigüedad

Ejemplo:

Carlos creó `Venta` y `Producto` hace pocos segundos.

El usuario dice:

> “Revisa la clase que creó Carlos.”

La referencia no es suficientemente precisa.

Respuesta esperada:

> “Carlos creó Venta y Producto. ¿Cuál quieres que revise?”

## 13.7. Referente eliminado

Ejemplo:

1. Se habla sobre `Venta`.
2. Otro participante elimina `Venta`.
3. El usuario dice “agrégale total”.

NexoCASE debe comprobar el modelo actual antes de ejecutar.

No debe recrear silenciosamente una clase antigua solo porque seguía en la conversación.

## 13.8. Cambio de foco

Ejemplo:

```text
Usuario: Explícame Venta.
IA: ...
Usuario: Ahora revisa Cliente.
IA: ...
Usuario: Agrégale telefono String.
```

El foco debe ser `Cliente`, no `Venta`.

---

# 14. Decisión automática versus aclaración

## 14.1. Principio

NexoCASE debe buscar fluidez, pero nunca a costa de modificar arbitrariamente el modelo.

## 14.2. Acción inequívoca

Ejemplo:

> “Agrega total Double a Venta.”

Si `Venta` existe y el cambio es válido, puede ejecutarse.

## 14.3. Acción contextual inequívoca

Ejemplo:

```text
Usuario: Explícame Venta.
IA: ...
Usuario: Agrégale total Double.
```

Puede ejecutarse sobre `Venta`.

## 14.4. Recomendación con evidencia suficiente

Si el usuario pide corregir un problema que el sistema acaba de identificar de manera determinista y existe una única corrección soportada, la solicitud puede transformarse en una acción concreta.

## 14.5. Decisión de negocio sin evidencia

Ejemplo:

> “Relaciona Venta con lo que creas correcto.”

Si NexoCASE no dispone de requisitos o evidencia que determine cardinalidad y relación, no debe inventarla como verdad.

Puede:

- proponer una alternativa marcada como recomendación/hipótesis;
- explicar la condición;
- pedir confirmación o datos.

## 14.6. Ambigüedad de elemento

Si existen dos posibles objetivos razonables, se debe preguntar.

## 14.7. Acción destructiva ambigua

Debe bloquearse hasta aclarar.

## 14.8. Regla resumida

```text
Hecho claro + objetivo claro + acción soportada
→ ejecutar

Contexto claro + referencia clara
→ ejecutar

Falta evidencia de negocio
→ recomendar / preguntar

Referencia ambigua
→ preguntar

Elemento inexistente/obsoleto
→ informar y no ejecutar
```

---

# 15. Modelo funcional de actividad y trazabilidad

## 15.1. Objetivo

La trazabilidad debe permitir explicar de forma confiable qué ocurrió en el proyecto.

## 15.2. Eventos relevantes mínimos

Se consideran candidatos funcionales a registrar:

- proyecto creado;
- participante accedió al proyecto;
- clase creada;
- clase modificada;
- clase eliminada;
- atributo agregado/modificado/eliminado;
- operación relevante modificada;
- relación creada/modificada/eliminada;
- importación XMI;
- modificación ejecutada mediante IA;
- guardado/persistencia relevante cuando aporte valor.

No es obligatorio registrar cada movimiento de una caja en el canvas como evento de negocio.

## 15.3. Autoría humana

Cuando un Diseñador de software realiza directamente una modificación:

```text
autor = participante
mecanismo = manual
```

## 15.4. Acción ejecutada mediante IA

Cuando Renato solicita:

> “Crea Producto.”

Y CU04 ejecuta el cambio, la trazabilidad conceptual debe conservar dos responsabilidades:

```text
solicitadoPor = Renato
ejecutadoMediante = IA / CU04
```

No se debe perder la responsabilidad humana registrando únicamente:

```text
"IA creó Producto"
```

## 15.5. Consulta histórica

La IA deberá utilizar actividad, no memoria probabilística, para responder:

> “¿Quién creó Venta?”

## 15.6. Actividad vs auditoría de seguridad

La actividad propuesta es trazabilidad funcional del proyecto.

No se promete una bitácora forense inmutable ni cumplimiento regulatorio empresarial.

---

# 16. Continuidad entre sesiones — evolución de CU11

## 16.1. Objetivo

Permitir que el trabajo iniciado hoy continúe mañana sin reiniciar el proyecto.

## 16.2. Información que debe sobrevivir a una jornada

Como mínimo debe poder recuperarse:

- proyecto;
- modelo UML guardado/vigente;
- conversación persistida;
- actividad relevante;
- acceso previamente concedido en el dispositivo cuando corresponda;
- contexto necesario para reanudar la experiencia sin tratar el proyecto como nuevo.

## 16.3. Participantes desconectados

Cuando una persona se desconecta deja de estar “presente”, pero su actividad histórica no desaparece.

## 16.4. Cero usuarios conectados

Cuando no queda nadie conectado:

```text
presencia = vacía
proyecto = existente
persistencia = intacta
conversación = intacta
actividad = intacta
modelo = recuperable
```

No existe obligación de mantener un “host” humano.

## 16.5. Apertura al día siguiente desde el mismo dispositivo

Si el dispositivo conserva una credencial local válida:

```text
NexoCASE
→ Proyectos recientes
→ abrir Proyecto X
→ recuperar estado
→ reconectar colaboración
```

No se pide nuevamente el código.

## 16.6. Apertura al día siguiente desde otro dispositivo

Sin cuenta ni sincronización de identidad personal:

```text
nuevo dispositivo
→ introducir código
→ introducir/confirmar nombre visible
→ obtener acceso
→ recuperar proyecto
```

## 16.7. Continuidad de la IA

La IA no necesita conservar una “mente viva” mientras todos están desconectados.

La continuidad se obtiene reconstruyendo el contexto desde las fuentes persistidas cuando llegue una nueva consulta.

Esto es importante:

> **La memoria del proyecto pertenece a NexoCASE, no a una sesión eterna del LLM.**

## 16.8. No se implementa historial completo de versiones

Continuidad no equivale a Git.

No se requiere en este parcial:

- checkout de versiones;
- ramas;
- revert por commit;
- diff histórico completo;
- time travel del modelo.

Puede existir actividad histórica sin convertirla en un sistema de control de versiones.

---

# 17. Experiencia de usuario funcional propuesta

## 17.1. Pantalla inicial

Debe priorizar tres acciones/conceptos:

- **Crear proyecto**.
- **Unirse con código**.
- **Proyectos recientes**.

No debe mostrar un catálogo global de proyectos ajenos.

## 17.2. Crear proyecto

Información mínima:

- nombre del proyecto;
- nombre visible del participante cuando sea necesario.

Resultado:

- proyecto creado;
- código disponible;
- acceso local concedido;
- apertura del espacio de modelado.

## 17.3. Unirse a proyecto

Información mínima:

- código;
- nombre visible cuando sea necesario.

Resultado:

- acceso concedido;
- proyecto recuperado;
- colaboración activa.

## 17.4. Proyectos recientes

Debe mostrar únicamente proyectos accesibles desde el contexto local del dispositivo.

Puede presentar:

- nombre;
- última interacción conocida;
- acción Abrir.

No debe implicar propiedad.

## 17.5. Espacio de modelado

Debe conservar:

- canvas;
- herramientas existentes;
- validación;
- XMI;
- generación;
- inspector.

Y mejorar la integración con:

- presencia de participantes;
- conversación IA colaborativa.

## 17.6. Área de conversación

Debe permitir:

- visualizar autor;
- visualizar mensajes compartidos;
- enviar consultas;
- recibir respuestas IA;
- observar continuidad de conversación;
- diferenciar visualmente IA y Diseñadores de software.

## 17.7. Actividad reciente

Puede existir como panel independiente o como fuente no visible consultada por la IA.

La decisión visual final puede tomarse posteriormente.

No es obligatorio convertir la actividad en una segunda conversación ruidosa.

## 17.8. IA ejecutando cambio

Cuando una solicitud produce una modificación, la experiencia debe dejar claro que:

- la IA entendió una acción;
- el cambio se realizó o fue rechazado;
- el modelo se actualizó;
- los colaboradores lo observan.

No es necesario crear una confirmación adicional para toda acción si CU04 ya admite cambios claros y válidos sin confirmación.

---

# 18. Escenarios funcionales principales

## EF-01 — Crear proyecto y compartir código

**Given** un Diseñador de software está en la pantalla inicial,  
**When** crea un proyecto válido,  
**Then** NexoCASE debe crear el proyecto, generar su código de acceso y abrir el espacio de trabajo.

## EF-02 — Unirse mediante código

**Given** existe un proyecto y otro Diseñador dispone de su código,  
**When** introduce un código válido y su nombre visible,  
**Then** debe obtener acceso al mismo proyecto y sincronizarse con su estado vigente.

## EF-03 — Rechazar acceso inválido

**Given** un Diseñador no posee un código válido,  
**When** intenta acceder,  
**Then** NexoCASE debe rechazar la solicitud sin listar proyectos ajenos.

## EF-04 — Reabrir desde el mismo dispositivo

**Given** el dispositivo ya obtuvo acceso válido previamente,  
**When** vuelve a NexoCASE y selecciona el proyecto en Proyectos recientes,  
**Then** debe reabrirse sin volver a solicitar el código mientras la credencial local siga válida.

## EF-05 — Reabrir desde otro dispositivo

**Given** el Diseñador utilizó un proyecto en otra computadora,  
**When** intenta ingresar desde un dispositivo sin credencial previa,  
**Then** deberá utilizar nuevamente el código.

## EF-06 — Último participante se desconecta

**Given** existe un proyecto con un único participante conectado,  
**When** dicho participante se desconecta,  
**Then** la presencia queda vacía pero el proyecto, modelo, conversación y actividad permanecen persistidos.

## EF-07 — Recuperar proyecto sin participantes activos

**Given** un proyecto lleva horas o días sin usuarios conectados,  
**When** un Diseñador autorizado vuelve a abrirlo,  
**Then** NexoCASE debe reconstruir el estado persistido y reactivar la colaboración.

## EF-08 — Dos diseñadores modelan simultáneamente

**Given** dos Diseñadores están dentro del mismo proyecto,  
**When** uno modifica el modelo,  
**Then** el otro debe observar el cambio sincronizado según la colaboración soportada.

## EF-09 — Preguntar cómo usar NexoCASE

**Given** un Diseñador se encuentra en un proyecto,  
**When** pregunta “¿Cómo exporto XMI?”,  
**Then** CU12 debe responder según la funcionalidad real de NexoCASE.

## EF-10 — Preguntar un concepto UML

**Given** un Diseñador trabaja en el modelo,  
**When** pregunta “¿Qué significa composición?”,  
**Then** CU12 debe responder como mentor conceptual sin modificar el modelo.

## EF-11 — Preguntar quién creó una clase

**Given** Carlos creó `Venta` y el hecho fue registrado,  
**When** Renato pregunta “¿Quién creó Venta?”,  
**Then** CU12 debe responder utilizando la actividad registrada.

## EF-12 — Solicitud explícita de cambio

**Given** existe `Venta`,  
**When** Renato solicita “Agrega observacion String a Venta”,  
**Then** la intención debe derivarse a CU04 y el cambio debe aplicarse si cumple las reglas existentes.

## EF-13 — Solicitud contextual

**Given** la conversación está enfocada inequívocamente en `Venta`,  
**When** Renato escribe “agrégale observacion String”,  
**Then** NexoCASE debe resolver `Venta` como objetivo y derivar una orden concreta a CU04.

## EF-14 — Referencia ambigua

**Given** existen dos posibles elementos de referencia,  
**When** el Diseñador dice “corrígelo”,  
**Then** NexoCASE debe solicitar aclaración y no modificar el modelo.

## EF-15 — Elemento referido fue eliminado

**Given** la conversación hablaba de `Venta` pero `Venta` ya no existe,  
**When** el Diseñador dice “agrégale total”,  
**Then** NexoCASE debe informar que el referente ya no está disponible y no debe ejecutar el cambio sobre otro elemento.

## EF-16 — IA revisa un cambio de otro diseñador

**Given** Carlos agregó una relación,  
**When** Renato solicita “Revisa la relación que agregó Carlos”,  
**Then** NexoCASE debe identificarla mediante actividad/contexto si es inequívoca y revisarla usando el modelo actual.

## EF-17 — Groq no disponible

**Given** Groq está temporalmente inaccesible,  
**When** el Diseñador realiza una consulta,  
**Then** NexoCASE debe manejar el fallo de forma controlada y conservar disponibles las funciones que no dependen de la IA remota.

---

# 19. Reglas de negocio funcionales

## 19.1. Acceso

**RN-ACC-01.** Cada proyecto deberá disponer de un código de acceso generado por NexoCASE.

**RN-ACC-02.** El código de acceso no será el identificador interno del proyecto.

**RN-ACC-03.** Un proyecto no será accesible únicamente por conocer su identificador interno.

**RN-ACC-04.** El backend deberá validar la autorización de acceso al proyecto.

**RN-ACC-05.** Los proyectos no se mostrarán en un listado global público.

**RN-ACC-06.** Un dispositivo previamente autorizado podrá reabrir el proyecto mediante una credencial local válida sin volver a solicitar el código.

**RN-ACC-07.** Un dispositivo sin credencial previa deberá utilizar el código.

## 19.2. Identidad

**RN-ID-01.** Todo participante deberá disponer de un identificador técnico.

**RN-ID-02.** Todo participante deberá disponer de un nombre visible para la colaboración.

**RN-ID-03.** El nombre visible no constituye identidad autenticada.

**RN-ID-04.** La identidad de una solicitud será determinada por el contexto de acceso del backend, no por afirmaciones contenidas en el mensaje.

## 19.3. Colaboración

**RN-COL-01.** Los participantes autorizados del mismo proyecto deberán compartir el modelo colaborativo.

**RN-COL-02.** Los recursos colaborativos deberán estar aislados por proyecto.

**RN-COL-03.** La ausencia total de participantes conectados no eliminará ni reiniciará el proyecto.

**RN-COL-04.** Un nuevo participante deberá recuperar un estado coherente antes de editar.

## 19.4. Conversación

**RN-CONV-01.** Las preguntas y respuestas de IA realizadas dentro del proyecto serán visibles para los participantes autorizados.

**RN-CONV-02.** No habrá conversaciones privadas con IA dentro del alcance.

**RN-CONV-03.** La conversación deberá persistir para continuidad.

**RN-CONV-04.** Persistir conversación no obliga a enviar toda la conversación a Groq en cada consulta.

## 19.5. IA

**RN-IA-01.** La IA no modificará el modelo por iniciativa propia.

**RN-IA-02.** Toda modificación mediante IA deberá originarse en una solicitud de un Diseñador de software.

**RN-IA-03.** CU12 seguirá enseñando a utilizar NexoCASE.

**RN-IA-04.** CU12 podrá explicar conceptos UML pertinentes.

**RN-IA-05.** CU12 no sustituirá validadores deterministas cuando exista una fuente de verdad interna.

**RN-IA-06.** Las modificaciones solicitadas se ejecutarán mediante CU04.

**RN-IA-07.** La IA deberá conocer qué participante realizó la solicitud.

**RN-IA-08.** La IA no inventará autores de cambios.

**RN-IA-09.** Cuando falte evidencia para una decisión de negocio, la IA deberá distinguir recomendación de hecho.

## 19.6. Contexto

**RN-CTX-01.** El modelo UML actual prevalecerá sobre referencias antiguas incompatibles.

**RN-CTX-02.** Una referencia implícita solo se ejecutará si el referente puede resolverse con suficiente certeza.

**RN-CTX-03.** Una referencia ambigua deberá provocar aclaración.

**RN-CTX-04.** El foco conversacional deberá invalidarse si el elemento deja de existir.

## 19.7. Trazabilidad

**RN-TRZ-01.** Las acciones relevantes deberán asociarse al participante que las originó cuando esa información exista.

**RN-TRZ-02.** Una modificación ejecutada mediante IA deberá conservar quién la solicitó.

**RN-TRZ-03.** Las preguntas históricas deberán responderse desde datos registrados cuando existan.

## 19.8. Persistencia

**RN-PER-01.** El proyecto deberá continuar existiendo cuando no haya participantes conectados.

**RN-PER-02.** La continuidad no dependerá de mantener un cliente anfitrión encendido.

**RN-PER-03.** El estado persistido deberá permitir continuar en otra jornada.

**RN-PER-04.** La persistencia propia del segundo parcial será no relacional.

## 19.9. Seguridad mínima

**RN-SEG-01.** El código no deberá ser trivialmente predecible.

**RN-SEG-02.** El acceso deberá validarse del lado del servidor.

**RN-SEG-03.** No se presentará esta solución como autenticación fuerte.

**RN-SEG-04.** Los mensajes y eventos de un proyecto no deberán filtrarse a otro proyecto.

---

# 20. Criterios de aceptación principales

## CA-01 — Acceso por código

**Given** existe un proyecto con código válido,  
**When** un Diseñador de software proporciona ese código,  
**Then** NexoCASE debe permitir continuar el flujo de acceso al proyecto.

## CA-02 — Aislamiento

**Given** un Diseñador posee acceso al Proyecto A,  
**When** intenta abrir el Proyecto B sin autorización,  
**Then** el sistema no debe conceder acceso por el solo hecho de conocer su identificador.

## CA-03 — Reingreso local

**Given** el dispositivo ya accedió correctamente a un proyecto,  
**When** vuelve posteriormente con una credencial local válida,  
**Then** podrá abrirlo desde Proyectos recientes sin reingresar el código.

## CA-04 — Proyecto sin usuarios conectados

**Given** el último participante se desconecta,  
**When** no queda presencia activa,  
**Then** el proyecto debe permanecer persistido y recuperable.

## CA-05 — Continuidad al día siguiente

**Given** el proyecto fue usado el día anterior y quedó sin participantes conectados,  
**When** un Diseñador autorizado lo reabre,  
**Then** debe recuperar el modelo, conversación y actividad persistida necesaria.

## CA-06 — Identidad de consulta

**Given** Carlos envía un mensaje,  
**When** su contenido afirma “Soy Renato”,  
**Then** el sistema debe seguir asociando la solicitud a Carlos.

## CA-07 — Conversación compartida

**Given** Renato y Carlos están en el mismo proyecto,  
**When** Renato consulta a la IA,  
**Then** Carlos debe poder observar la consulta y la respuesta según la experiencia colaborativa.

## CA-08 — Ayuda de producto

**Given** un Diseñador pregunta cómo realizar una función existente,  
**When** CU12 responde,  
**Then** la explicación debe corresponder a la funcionalidad real de NexoCASE.

## CA-09 — Autoría histórica

**Given** Carlos creó `Venta` y el sistema registró el evento,  
**When** Renato pregunta quién creó `Venta`,  
**Then** CU12 debe responder utilizando ese evento.

## CA-10 — Acción directa

**Given** `Venta` existe,  
**When** Renato solicita “Agrega observacion String a Venta”,  
**Then** el orquestador debe derivar una instrucción clara a CU04.

## CA-11 — Acción contextual

**Given** `Venta` es el referente inequívoco de la conversación,  
**When** Renato solicita “agrégale observacion String”,  
**Then** el sistema debe resolver `Venta` como objetivo.

## CA-12 — Ambigüedad

**Given** existen dos referentes plausibles,  
**When** el Diseñador solicita “corrígelo”,  
**Then** el sistema debe solicitar aclaración antes de modificar.

## CA-13 — Estado actual prevalece

**Given** la conversación contiene referencias a una clase eliminada,  
**When** se intenta una acción sobre ella,  
**Then** el modelo actual debe prevalecer y la operación no debe aplicarse a otro elemento arbitrariamente.

## CA-14 — Acción IA trazable

**Given** Renato solicita a la IA crear `Producto`,  
**When** CU04 realiza el cambio,  
**Then** la actividad debe poder conservar que Renato originó la solicitud y que la modificación fue ejecutada mediante IA.

---

# 21. Edge cases y comportamiento esperado

## 21.1. Dos participantes con el mismo nombre

No deben convertirse en la misma identidad interna.

## 21.2. Dos clases con nombres similares

La IA debe utilizar IDs/modelo/contexto para evitar operar sobre la clase incorrecta.

## 21.3. Dos usuarios preguntan simultáneamente

Cada solicitud debe conservar su participante originador y su contexto.

Una respuesta dirigida a Renato no puede terminar atribuida a Carlos por una condición de carrera.

## 21.4. Modelo cambia mientras Groq responde

Antes de ejecutar una acción derivada de una respuesta potencialmente desactualizada, el sistema debe validar que el objetivo todavía exista y que las precondiciones relevantes sigan vigentes.

## 21.5. Elemento renombrado

El contexto deberá preferir identificadores estables cuando existan, no depender exclusivamente del nombre anterior.

## 21.6. Elemento eliminado

El foco conversacional asociado debe considerarse inválido.

## 21.7. Groq falla

La aplicación no debe colapsar.

Las capacidades independientes deben continuar disponibles.

## 21.8. Conversación muy larga

La persistencia se conserva, pero el contexto IA debe administrarse de manera selectiva.

## 21.9. Código escrito incorrectamente varias veces

El sistema debe responder de forma controlada y posteriormente podrá aplicar limitación de intentos según la Fase 3.

## 21.10. Credencial local eliminada

El proyecto puede dejar de aparecer como accesible directamente desde ese dispositivo.

El usuario podrá recuperar acceso utilizando nuevamente el código.

## 21.11. Proyecto sin usuarios durante varios días

Debe seguir siendo recuperable mientras exista en la persistencia del sistema.

## 21.12. Reinicio del backend

La existencia del proyecto y su continuidad no deben depender únicamente de memoria de proceso.

## 21.13. IA recomienda una relación sin requisitos

Debe identificarla como recomendación/hipótesis, no como regla de negocio comprobada.

## 21.14. El usuario pide “corrige todo”

No debe convertirse en una autorización ilimitada para rediseñar el dominio.

CU12 puede revisar y resumir problemas; las acciones deberán mantenerse controladas y suficientemente concretas.

---

# 22. Responsabilidades funcionales por capa

Esta sección no define todavía arquitectura física completa; evita colocar responsabilidades en el lugar incorrecto.

## 22.1. Frontend

Responsable de:

- capturar código y nombre visible;
- presentar Proyectos recientes;
- mostrar proyecto activo;
- mostrar presencia;
- mostrar conversación;
- enviar mensajes;
- representar estados de IA;
- mostrar cambios del modelo;
- conservar la experiencia de modelado actual.

No debe ser la autoridad final para decidir acceso.

## 22.2. Backend NexoCASE

Responsable funcional de:

- validar acceso;
- identificar el participante real de una solicitud;
- aislar proyectos;
- persistir/recuperar contexto mediante infraestructura correspondiente;
- consultar actividad;
- construir contexto de IA;
- orquestar consulta vs acción;
- proteger CU04 de instrucciones ambiguas;
- interactuar con Groq;
- entregar datos autoritativos.

## 22.3. Persistencia MongoDB

Responsable de conservar la información durable definida posteriormente.

No decide reglas de negocio por sí misma.

## 22.4. Groq

Responsable de:

- comprensión lingüística;
- razonamiento contextual dentro del contexto suministrado;
- clasificación/interpretación cuando corresponda;
- generación de respuesta;
- producción estructurada de intenciones/acciones según contratos posteriores.

Groq **no es la fuente de verdad del proyecto**.

## 22.5. Modelo UML canónico

Responsable de representar el estado semántico vigente del diagrama.

## 22.6. Yjs / colaboración en tiempo real

Responsable de sincronización colaborativa durante la interacción activa.

No reemplaza la persistencia durable.

## 22.7. Apollon

Responsable de edición/representación visual soportada.

No debe convertirse en repositorio de verdad histórica del proyecto.

---

# 23. Matriz de impacto sobre casos de uso

| CU | Nombre funcional | Impacto segundo parcial |
|---|---|---|
| CU01 | Crear o acceder a proyecto | **Alto** — código, aislamiento, proyectos recientes, identidad ligera |
| CU02 | Modelar manualmente | Bajo — conservar y regresión |
| CU03 | Colaborar en el modelado | **Alto** — identidad, presencia, experiencia compartida, aislamiento |
| CU04 | Modelar con IA texto/voz | **Alto** — recibe acciones directas y contextuales desde el orquestador |
| CU05 | Modelar desde imagen | Bajo — conservar |
| CU06 | Importar XMI | Bajo — conservar, registrar actividad si aplica |
| CU07 | Exportar XMI | Bajo — conservar |
| CU08 | Validar modelo | Medio — pasa a ser fuente autoritativa para CU12 |
| CU09 | Generar backend Spring | Medio — fuente autoritativa de aptitud/flujo |
| CU10 | Descargar backend | Bajo — conservar |
| CU11 | Guardar y recuperar proyecto | **Alto** — continuidad de modelo + colaboración persistida |
| CU12 | Asistir colaborativamente al equipo | **Muy alto** — mentor, producto, UML, contexto grupal, actividad, conversación |

No se crea CU13.

---

# 24. Fuera de alcance confirmado

Para evitar sobreingeniería, esta fase reafirma que NO se implementará como requisito principal:

- registro de usuarios;
- correo electrónico;
- contraseña;
- recuperación de contraseña;
- OAuth;
- perfiles permanentes globales;
- roles administrador/editor/lector;
- propietario de proyecto complejo;
- permisos por elemento UML;
- invitaciones por email;
- mensajes privados;
- IA local;
- entrenamiento de un modelo propio;
- fine-tuning;
- RAG como obligación inicial;
- aplicación móvil obligatoria;
- control de versiones tipo Git;
- chat social generalista;
- auditoría forense inmutable;
- agente IA autónomo que rediseña sin solicitud.

---

# 25. Dependencias hacia las fases siguientes

## 25.1. Fase 3 — Arquitectura objetivo y MongoDB

Deberá convertir este diseño funcional en:

- modelo de datos;
- colecciones/documentos;
- estrategia de credencial local;
- endpoints;
- contratos;
- estrategia de persistencia;
- aislamiento;
- reconexión;
- arquitectura backend/frontend/datos/despliegue.

## 25.2. Fase 4 — Identidad, acceso y trazabilidad

Deberá implementar:

- código de proyecto;
- acceso;
- participante real;
- presencia;
- actividad.

## 25.3. Fase 5 — CU12 colaborativo

Deberá implementar:

- conversación compartida;
- mentor de producto;
- mentor UML;
- consultas de actividad;
- contexto por participante.

## 25.4. Fase 6 — Orquestación CU12 ↔ CU04

Deberá implementar:

- clasificación de intención;
- referencias contextuales;
- derivación de acciones;
- aclaración de ambigüedad;
- ejecución controlada.

## 25.5. Fase 7 — Integración completa

Deberá demostrar que todo convive sin romper CU01–CU12.

---

# 26. Criterio de cierre de Fase 2 y handoff obligatorio al agente de implementación

Este documento se considera la **especificación funcional aprobada** de la experiencia colaborativa con IA.

Antes de implementar Fases 3–7, cualquier agente o integrante del equipo deberá leer este archivo completo y respetar los siguientes invariantes:

1. Existe un único actor funcional: **Diseñador de software**.
2. Se mantienen 12 casos de uso; no se agrega CU13 por acceso, chat, identidad o trazabilidad.
3. El acceso a proyectos utiliza código y no requiere cuenta.
4. Un dispositivo previamente autorizado puede reabrir un proyecto reciente sin volver a escribir el código mientras conserve una credencial válida.
5. Un dispositivo nuevo debe usar el código nuevamente.
6. El proyecto persiste aunque haya cero usuarios conectados.
7. No existe dependencia de un anfitrión humano permanente.
8. Yjs/WebSocket resuelve tiempo real; MongoDB resolverá continuidad durable.
9. La conversación con IA es compartida, no privada.
10. CU12 conserva y amplía su función de enseñar NexoCASE y UML.
11. CU12 asesora; CU04 ejecuta modificaciones.
12. La IA no modifica por iniciativa propia.
13. “Corrígelo”, “agrégale” y referencias similares solo se ejecutan cuando el referente es suficientemente claro.
14. La actividad real del proyecto es fuente de verdad para preguntas de autoría.
15. Groq razona sobre contexto; no inventa la verdad del sistema.
16. La ausencia de login debe reconocerse como identidad colaborativa ligera, no autenticación fuerte.
17. No IA local, no móvil obligatorio, no fine-tuning, no roles complejos, no RAG obligatorio inicial.

Si una implementación futura contradice uno de estos puntos, debe considerarse una desviación de alcance y revisarse antes de aceptarla.

La Fase 2 termina aquí. La Fase 3 debe partir de este documento para diseñar la arquitectura y persistencia sin redefinir el comportamiento funcional ya aprobado.

---

# 27. Resumen ejecutivo para el equipo

NexoCASE del segundo parcial conservará todo lo útil del primer parcial, pero transformará la colaboración primitiva en una experiencia de proyecto aislado y contextual.

Un Diseñador de software podrá crear un proyecto y compartir un código. Otro diseñador ingresará mediante ese código y un nombre visible. No existirán cuentas ni contraseñas. En el mismo dispositivo, los proyectos previamente autorizados podrán reaparecer como **Proyectos recientes** sin pedir el código cada vez; en otro dispositivo será necesario introducirlo nuevamente.

Si todos los participantes se desconectan, el proyecto no desaparece. Se termina únicamente la presencia activa. El modelo, conversación, actividad y continuidad permanecen guardados y podrán recuperarse después.

La IA colaborativa será visible para todo el equipo. CU12 seguirá enseñando a utilizar NexoCASE, explicará UML, revisará el modelo y podrá responder preguntas históricas basándose en datos reales. CU04 seguirá siendo el mecanismo que ejecuta modificaciones solicitadas.

El sistema deberá soportar conversaciones naturales como:

```text
Renato: ¿Quién creó Venta?
IA: Renato, Carlos creó Venta.
Renato: Revísala.
IA: Venta no tiene relación con Cliente.
Renato: Corrígelo.
```

NexoCASE deberá poder resolver qué significa “Revísala” y “Corrígelo” utilizando el contexto real. Si el referente es ambiguo, preguntará en lugar de modificar arbitrariamente.

La regla central del diseño es:

> **Groq interpreta y razona; NexoCASE conserva la identidad, los hechos, el modelo y las reglas que determinan la verdad.**

---

**FIN — FASE 2**
