# NexoCASE — Segundo Parcial de SW1
## Fase 1 — Consolidación del alcance y línea base

**Estado:** Aprobado como base de trabajo para el segundo parcial  
**Objetivo del documento:** congelar el alcance funcional, las reglas de negocio, las decisiones de producto y los límites técnicos antes de iniciar el diseño detallado y la implementación.  
**Equipo:** 2 integrantes  
**Producto:** NexoCASE  
**Proceso siguiente:** Fase 2 — Diseño funcional de la experiencia colaborativa con IA

---

# 1. Propósito de esta fase

La Fase 1 existe para evitar el error más peligroso del segundo parcial: empezar a programar nuevas funciones sin haber definido exactamente qué se conserva del primer parcial, qué cambia, qué es obligatorio, qué es opcional y qué no debe implementarse.

NexoCASE ya posee una base funcional importante. El segundo parcial **no es un proyecto nuevo** ni una excusa para rehacer la aplicación. La estrategia oficial será **evolucionar el producto existente**, manteniendo las capacidades útiles del primer parcial y añadiendo la nueva experiencia de inteligencia artificial colaborativa solicitada por el docente.

Esta fase deja acordado entre ambos integrantes:

- el problema real que se debe resolver;
- el alcance funcional del segundo parcial;
- los 12 casos de uso que se mantienen;
- los casos de uso que cambian de enfoque;
- las reglas de acceso a proyectos;
- la identidad mínima de los participantes;
- la forma en que la IA participará en una sesión colaborativa;
- la estrategia de persistencia no relacional;
- el papel de Groq;
- lo que explícitamente queda fuera del alcance;
- los riesgos que deben vigilarse;
- los criterios que permiten declarar esta fase terminada.

Este documento debe ser leído por los dos integrantes antes de modificar el código. Si durante el desarrollo aparece una idea que contradice una decisión congelada aquí, primero debe discutirse y actualizarse este documento; no se debe cambiar el producto silenciosamente.

---

# 2. Base documental y prioridad de verdad

Las decisiones de esta fase se apoyan en tres fuentes, con el siguiente orden de autoridad:

1. **Pautas y transcripciones del docente para el segundo parcial.**
2. **Código real auditado de NexoCASE.**
3. **Decisiones de alcance tomadas por el equipo para simplificar y profesionalizar la solución.**

Cuando exista conflicto, la pauta del docente prevalece sobre una comodidad técnica. Cuando la pauta sea ambigua, se priorizará la solución más simple que cumpla el objetivo funcional sin sobreingeniería.

## 2.1. Requisitos del docente que condicionan esta fase

De las pautas suministradas se consideran firmes los siguientes puntos:

- El segundo parcial debe **conservar las funcionalidades del primero**.
- La nueva IA debe actuar como un participante adicional del trabajo colaborativo: asesor, mentor, modelador o desarrollador senior.
- La IA debe poder recibir solicitudes de cualquiera de los desarrolladores.
- Las preguntas y respuestas realizadas a la IA deben ser visibles para los integrantes de la sesión.
- La IA debe saber **quién está preguntando** y responder dentro de ese contexto.
- La IA debe mantener contexto para interpretar correctamente una conversación encadenada.
- La IA puede explicar conceptos teóricos de UML y orientar al equipo.
- La IA puede proponer o realizar cambios en el diagrama cuando un participante se lo solicite.
- La IA **no debe diseñar ni modificar por iniciativa propia**; una acción sobre el modelo debe originarse en una solicitud del usuario.
- El trabajo debe poder continuar en días diferentes sin empezar de cero.
- La persistencia de la aplicación para este escenario debe ser **no relacional**.
- Un modelo de IA local es valorable, pero no obligatorio.
- El producto será evaluado también por calidad, correspondencia entre documentación/modelos y código, y dominio del software por parte de sus autores.

## 2.2. Decisiones de equipo derivadas de las pautas

Se congelan además las siguientes decisiones:

- NexoCASE **no se rehace desde cero**.
- Se mantiene React en frontend y Node/TypeScript/Express en backend.
- Se mantienen Apollon, Yjs/colaboración existente, el modelo UML canónico, XMI/crunch_uml, validación y generación Spring.
- La persistencia propia de NexoCASE evolucionará a **MongoDB**.
- La base relacional PostgreSQL del backend Spring generado es un tema distinto y no debe confundirse con la persistencia interna de NexoCASE.
- No se implementará IA local en este parcial.
- Groq será el proveedor de IA principal; si los límites gratuitos resultan insuficientes, el equipo acepta utilizar un plan de pago económico.
- No se realizará entrenamiento ni fine-tuning del modelo como requisito del parcial.
- No se desarrollará autenticación completa mediante correo, contraseña, OAuth o cuentas de usuario.
- No se considera una aplicación móvil como alcance obligatorio del segundo parcial.
- Se mantendrán **12 casos de uso funcionales**. No se crearán casos de uso artificiales para cada operación técnica nueva.

---

# 3. Problema de negocio real

## 3.1. Problema del primer parcial

El primer NexoCASE resolvía principalmente el problema de construir y trabajar con un modelo UML de clases mediante:

- edición manual;
- colaboración sobre el mismo diagrama;
- IA para modificaciones incrementales por texto o voz;
- reconocimiento de UML desde una imagen;
- importación y exportación XMI;
- validación;
- generación de un backend Spring Boot;
- persistencia básica del proyecto;
- asistencia contextual sobre la aplicación y el modelo.

## 3.2. Problema del segundo parcial

El problema ahora es más amplio:

> **Un equipo distribuido necesita diseñar conjuntamente un modelo UML en NexoCASE y disponer de una IA que forme parte de la sesión de trabajo, conozca el proyecto y a sus participantes, comprenda el contexto de la conversación, pueda enseñar y revisar el modelo, recuerde hechos relevantes del trabajo colaborativo y ejecute cambios cuando un integrante se lo solicite explícitamente.**

La IA no será un chat decorativo ni una pestaña separada que ignore lo que ocurre en el diagrama.

Debe estar conectada con las fuentes de verdad de NexoCASE:

- proyecto actual;
- modelo UML canónico;
- participante que realiza la consulta;
- conversación compartida;
- actividad relevante del equipo;
- validación del modelo;
- aptitud de generación Spring;
- conocimiento factual de las funcionalidades de NexoCASE.

---

# 4. Valor de negocio esperado

La evolución debe aportar valor concreto:

1. **Reducir pérdida de contexto.** Un integrante puede comprender qué ocurrió antes y continuar el trabajo.
2. **Mejorar colaboración.** La conversación con IA forma parte del trabajo compartido y no de interacciones privadas desconectadas.
3. **Mejorar aprendizaje.** La IA puede explicar UML y enseñar cómo utilizar NexoCASE sin abandonar la aplicación.
4. **Reducir errores de modelado.** La IA puede consultar la validación real antes de explicar problemas.
5. **Permitir acciones contextuales.** Expresiones como “corrígelo” o “agrégale un atributo” pueden interpretarse usando el elemento previamente discutido.
6. **Preservar trazabilidad.** NexoCASE podrá saber qué participante realizó una acción significativa.
7. **Mantener control humano.** La IA no cambia el diseño sin una solicitud explícita.
8. **Mantener el producto simple.** Se evita construir autenticación empresarial, permisos complejos, agentes autónomos o infraestructuras innecesarias para el parcial.

---

# 5. Línea base real de NexoCASE antes del segundo parcial

Esta sección describe el producto existente que **no debe romperse**.

## 5.1. Núcleo arquitectónico

NexoCASE trabaja alrededor de un **modelo UML canónico**. Esta decisión se mantiene como principio central.

Flujo conceptual actual:

```text
Apollon / interfaz visual
        ↓
adaptación
        ↓
Modelo UML canónico
        ↓
 ┌──────┼───────────┬────────────┐
 │      │           │            │
IA   Validación    XMI      Generación Spring
```

El modelo canónico debe continuar siendo la fuente semántica compartida entre las distintas capacidades.

## 5.2. Modelado manual

El usuario puede trabajar con clases, atributos, operaciones, relaciones, multiplicidades y roles desde el espacio de modelado y el inspector de propiedades.

Esta capacidad se conserva.

## 5.3. IA de modelado — CU04

Actualmente CU04 interpreta instrucciones incrementales y, cuando son claras y válidas, aplica cambios al modelo sin una confirmación adicional.

Ejemplos:

- crear una clase;
- agregar/modificar/eliminar atributos;
- trabajar con operaciones;
- crear relaciones;
- modificar multiplicidades;
- realizar acciones mediante texto o voz.

Esta capacidad **no se reemplaza**. En el segundo parcial se reutilizará como el brazo ejecutor de la IA colaborativa cuando exista una orden explícita.

## 5.4. IA desde imagen — CU05

La imagen produce un candidato UML que debe ser revisado y confirmado antes de incorporarse al modelo.

Se mantiene separado del nuevo chat colaborativo porque su responsabilidad es distinta.

## 5.5. Asistente contextual — CU12 actual

CU12 ya puede:

- explicar cómo utilizar capacidades de NexoCASE;
- explicar hechos del modelo actual;
- analizar validación y aptitud Spring;
- responder preguntas de orientación;
- mantener una conversación corta;
- usar Groq cuando corresponde y degradarse a ayuda determinista en algunas consultas de producto.

Actualmente CU12 es deliberadamente de solo lectura: no modifica, guarda, importa, exporta ni genera por sí mismo.

Esta separación conceptual se mantiene, pero CU12 evolucionará para ser **colaborativo y consciente del participante y del contexto grupal**.

## 5.6. Colaboración actual — CU03

NexoCASE ya posee colaboración con Apollon/Yjs y transporte WebSocket.

Sin embargo, el mecanismo actual es insuficiente para el segundo parcial:

- la sala se deriva directamente de `proyecto-${proyectoId}`;
- el colaborador recibe un identificador de sesión generado localmente;
- el nombre visible actual se establece como **“Diseñador”**;
- no existe un mecanismo real de ingreso por invitación/código;
- no existe identidad funcional suficiente para que la IA diga con autoridad quién hizo qué;
- conocer o poder obtener el proyecto permite trabajar sobre él con demasiada facilidad.

Esto se considera una **deuda funcional prioritaria** del segundo parcial.

## 5.7. Gestión actual de proyectos — CU01/CU11

Actualmente:

- el frontend lista proyectos desde el backend;
- se puede crear un proyecto por nombre;
- se puede abrir mediante su ID;
- el backend expone listado global de proyectos;
- el modelo se guarda explícitamente;
- la persistencia se realiza en archivos JSON en el servidor.

El repositorio actual de archivos es adecuado como evidencia del primer parcial, pero **no satisface el nuevo requisito de persistencia no relacional ni el nuevo aislamiento de proyectos**.

## 5.8. XMI, validación y generación

Se mantienen:

- CU06 Importar XMI;
- CU07 Exportar XMI;
- CU08 Validar modelo UML;
- CU09 Generar backend Spring Boot;
- CU10 Descargar backend generado.

Estas capacidades deben pasar pruebas de regresión después de incorporar las nuevas funciones.

---

# 6. Decisión principal del segundo parcial

## 6.1. No se crea un producto nuevo

El segundo parcial será una **evolución incremental** de NexoCASE.

No se justifican:

- una reescritura completa;
- otro frontend;
- otro editor UML;
- reemplazar Apollon;
- eliminar Yjs;
- rehacer el modelo canónico;
- sustituir XMI/crunch_uml;
- rehacer el generador Spring.

Las modificaciones deben concentrarse en:

1. acceso e identidad por proyecto;
2. persistencia no relacional;
3. contexto colaborativo;
4. conversación compartida con IA;
5. trazabilidad de acciones significativas;
6. orquestación entre CU12 y CU04.

---

# 7. Casos de uso oficiales

Se mantienen **12 casos de uso funcionales**.

| CU | Nombre de referencia | Estado para segundo parcial |
|---|---|---|
| CU01 | Crear o acceder a proyecto | **Evoluciona** |
| CU02 | Modelar diagrama de clases manualmente | Se conserva |
| CU03 | Colaborar en el modelado | **Evoluciona** |
| CU04 | Modelar con IA mediante texto/voz | **Evoluciona en integración/contexto** |
| CU05 | Modelar desde imagen | Se conserva |
| CU06 | Importar modelo XMI | Se conserva |
| CU07 | Exportar modelo XMI | Se conserva |
| CU08 | Validar modelo UML | Se conserva y alimentará contexto IA |
| CU09 | Generar backend Spring Boot | Se conserva |
| CU10 | Descargar backend generado | Se conserva |
| CU11 | Guardar y recuperar proyecto | **Evoluciona** |
| CU12 | Asistir colaborativamente al equipo | **Evolución principal** |

## 7.1. Por qué no se crean CU13, CU14, etc.

No se crearán casos de uso separados para:

- generar código de acceso;
- validar código;
- registrar participante;
- guardar mensaje;
- consultar evento;
- recordar contexto;
- identificar interlocutor;
- sincronizar conversación.

Estas son reglas, datos, servicios internos o pasos de los CU existentes, no objetivos independientes del actor.

---

# 8. Evolución de CU01 — Crear o acceder a proyecto

## 8.1. Problema actual

Actualmente NexoCASE expone una lista global de proyectos y permite abrirlos por identificador. Esto no representa adecuadamente la idea de un espacio colaborativo perteneciente a un equipo.

## 8.2. Nuevo objetivo

> Permitir crear un proyecto o acceder a uno existente mediante un código de acceso compartido por el equipo, sin implementar cuentas de usuario.

## 8.3. Flujo A — Crear proyecto

1. El usuario ingresa el nombre del proyecto.
2. Ingresa el nombre/apodo con el que participará.
3. NexoCASE crea el proyecto.
4. NexoCASE genera automáticamente un código de acceso aleatorio.
5. NexoCASE crea/recupera una identidad técnica de participante para ese navegador/proyecto.
6. El creador entra al proyecto.
7. El código queda disponible para compartirlo manualmente con el compañero.

Ejemplo visual de código:

```text
NX7K-P4QM
```

El formato exacto podrá ajustarse en diseño, pero debe ser corto, legible y no secuencial.

## 8.4. Flujo B — Unirse a un proyecto

1. El usuario selecciona **Unirse a proyecto**.
2. Ingresa el código de acceso.
3. Ingresa un nombre/apodo visible.
4. El backend valida el código.
5. Si es correcto, crea o recupera la identidad técnica local del participante.
6. El sistema abre únicamente el proyecto asociado al código.
7. El participante entra al espacio colaborativo.

## 8.5. Flujo C — Reabrir proyecto reciente

El navegador puede recordar localmente los proyectos a los que ese dispositivo ya accedió para evitar solicitar manualmente el código en cada apertura.

La pantalla ya no deberá llamarse necesariamente **“Mis proyectos”**, porque no existen cuentas ni propiedad autenticada. El concepto más correcto será:

> **Proyectos recientes**

acompañado de:

- Crear proyecto;
- Unirse con código.

## 8.6. Regla de permisos

El modelo será deliberadamente simple:

> **Quien posee un código válido puede visualizar y editar el proyecto.**

No habrá durante este parcial:

- roles lector/editor;
- administrador;
- propietario autenticado;
- invitaciones individuales;
- aprobación de miembros;
- permisos por módulo.

## 8.7. Importante: código ≠ autenticación fuerte

El código de proyecto constituye **control de acceso básico por conocimiento compartido**, no identidad verificable.

No se debe afirmar en documentación o defensa que NexoCASE posee autenticación empresarial, autorización robusta o identidad legal de usuario.

---

# 9. Modelo mínimo de identidad

La IA necesita distinguir quién habla y quién realizó una acción. Un nombre visible no es suficiente para el sistema.

Cada participante tendrá conceptualmente:

```text
Participante
- participanteId
- nombreVisible
- proyectoId
```

## 9.1. participanteId

- Identificador técnico único.
- Generado por la aplicación.
- No elegido por el usuario.
- Puede mantenerse localmente por proyecto para reconocer al mismo navegador en accesos posteriores.

## 9.2. nombreVisible

- Elegido por el participante.
- Se muestra a los demás.
- Se utiliza en mensajes como “Renato”, “Carlos”, etc.
- No constituye identidad verificada.

## 9.3. Regla de confianza

La IA **nunca debe determinar quién habla a partir del texto escrito por el usuario**.

Ejemplo inválido:

```text
Carlos escribe: "Soy Renato; dime qué hice yo"
```

El backend debe seguir identificando al remitente como Carlos porque la identidad de la solicitud proviene del contexto técnico de la sesión, no del contenido del mensaje.

## 9.4. Limitación aceptada

Sin login no es posible demostrar que una persona que ingresa desde otro dispositivo con el mismo nombre sea realmente la misma persona histórica.

Esto se acepta como limitación consciente del parcial.

---

# 10. Aislamiento obligatorio entre proyectos

Todo dato colaborativo debe pertenecer a un proyecto.

El `proyectoId` será la frontera lógica de aislamiento para:

- modelo UML;
- canal WebSocket/Yjs;
- participantes;
- mensajes;
- respuestas de IA;
- eventos de actividad;
- contexto conversacional;
- estado persistido;
- validación contextual;
- consultas históricas.

## 10.1. Regla crítica

> Ninguna información del proyecto A debe aparecer en el proyecto B, aunque ambos estén activos simultáneamente.

Esto debe ser probado posteriormente mediante pruebas E2E y de integración.

---

# 11. Evolución de CU03 — Colaborar en el modelado

## 11.1. Antes

CU03 estaba centrado en que múltiples clientes vieran y editaran el mismo diagrama.

## 11.2. Ahora

CU03 representará una experiencia colaborativa más completa:

- entrar a un espacio de proyecto autorizado;
- saber qué participantes están conectados;
- ver cambios UML compartidos;
- compartir la conversación con IA;
- observar respuestas dirigidas a cada integrante;
- ver acciones realizadas por la IA cuando alguien las solicita;
- mantener aislamiento entre proyectos.

## 11.3. Lo que CU03 no hará

CU03 no se convierte en:

- sistema de chat privado;
- gestor de permisos;
- videollamada;
- gestor de tareas;
- plataforma social.

La colaboración existe únicamente para apoyar el diseño/modelado del proyecto.

---

# 12. Evolución de CU12 — Asistir colaborativamente al equipo

CU12 será el centro funcional del segundo parcial.

## 12.1. Nombre propuesto

> **CU12 — Asistir colaborativamente al equipo**

## 12.2. Objetivo

Permitir que un participante consulte a la IA sobre NexoCASE, UML y el modelo actual dentro de una sesión compartida, utilizando la identidad del interlocutor, el contexto de la conversación, el estado del proyecto y la actividad relevante del equipo.

## 12.3. CU12 debe conservar su función de enseñar NexoCASE

La nueva IA **no reemplaza** la ayuda actual.

Debe continuar respondiendo con autoridad preguntas como:

- ¿Cómo importo un XMI?
- ¿Cómo exporto el modelo?
- ¿Cómo funciona la voz?
- ¿Cómo uso Desde imagen?
- ¿Dónde valido el modelo?
- ¿Por qué no puedo generar Spring?
- ¿Cómo guardo mi trabajo?

Estas respuestas deben basarse en una fuente de verdad interna del producto, no en recuerdos generales del LLM.

## 12.4. CU12 como mentor conceptual

Debe responder preguntas como:

- ¿Qué es composición?
- ¿Qué significa 0..*?
- ¿Qué es una clase asociativa?
- ¿Cuál es la diferencia entre agregación y composición?
- ¿Qué significa una multiplicidad?

## 12.5. CU12 como analista del modelo actual

Debe poder:

- explicar una clase seleccionada;
- explicar una relación;
- revisar errores de CU08;
- explicar por qué el modelo no está listo para Spring;
- explicar una regla representada por una multiplicidad;
- orientar sin inventar requisitos de negocio.

## 12.6. CU12 como participante colaborativo

Debe además conocer:

- quién realizó la pregunta;
- proyecto actual;
- participantes relevantes;
- conversación compartida relevante;
- elemento conversacional en foco;
- modelo UML actual;
- actividad reciente significativa;
- resultados de validación;
- aptitud Spring.

Ejemplo:

```text
Renato: ¿Quién creó Venta?
IA: Renato, la clase Venta fue creada por Carlos.
```

La respuesta “Carlos” debe provenir del historial/eventos reales, no de una suposición de Groq.

---

# 13. Evolución de CU04 — IA que ejecuta cambios

CU04 se mantiene como responsable de modificar el modelo mediante instrucciones estructuradas.

La diferencia es que podrá ser invocado desde la nueva interacción colaborativa.

Ejemplo:

```text
Renato: ¿Qué problema tiene Venta?
IA/CU12: Venta no está relacionada con Cliente.
Renato: Corrígelo.
        ↓
orquestación
        ↓
CU04
        ↓
comandos estructurados
        ↓
modelo canónico
        ↓
Apollon/Yjs
        ↓
todos los colaboradores ven el cambio
```

## 13.1. Separación obligatoria

**CU12:** pregunta, explica, enseña, analiza, recomienda.  
**CU04:** ejecuta cambios explícitamente solicitados.

No se deben fusionar internamente como una sola responsabilidad monolítica.

---

# 14. Orquestación de la IA

Se prevé una capa/orquestador funcional que determine qué tipo de intención contiene un mensaje.

No se requiere un “agente autónomo” complejo.

## 14.1. Tipos mínimos de intención

### Consulta factual

Ejemplo:

> ¿Quién creó Venta?

Acción:

- consultar datos reales;
- responder mediante CU12;
- no modificar UML.

### Consulta conceptual

Ejemplo:

> ¿Qué es una composición?

Acción:

- CU12;
- explicación;
- no modificar.

### Consulta contextual

Ejemplo:

> ¿Está bien lo que agregó Carlos?

Acción:

- obtener actividad/modelo relevante;
- revisar estado real;
- CU12 responde.

### Modificación explícita

Ejemplo:

> Agrega a Venta el atributo observacion String.

Acción:

- CU04;
- aplicar si es clara y válida.

### Modificación contextual

Ejemplo:

```text
Usuario: ¿Qué problema tiene Venta?
IA: No está relacionada con Cliente.
Usuario: Corrígelo.
```

Acción:

- resolver “lo” usando contexto;
- enviar intención concreta a CU04.

### Solicitud ambigua

Ejemplo:

> Hazlo mejor.

Si el sistema no posee contexto suficiente, debe **preguntar**, no inventar.

---

# 15. Regla fundamental: la IA no es autónoma

La IA puede detectar, explicar y recomendar problemas, pero no debe modificar el modelo únicamente porque los detectó.

Flujo correcto:

```text
IA detecta problema
      ↓
explica/recomienda
      ↓
participante solicita acción
      ↓
CU04 ejecuta
```

Flujo prohibido:

```text
IA detecta problema
      ↓
borra/cambia el modelo sin solicitud
```

Esta regla protege:

- control humano;
- trazabilidad;
- previsibilidad;
- defensa académica;
- seguridad del modelo.

---

# 16. Autoridad de la IA: Groq razona, NexoCASE proporciona la verdad

No se entrenará a Groq con el proyecto.

La estrategia oficial será **grounding/contextualización controlada**.

## 16.1. Fuentes de verdad que utilizará la IA

Por orden conceptual:

1. identidad técnica del participante actual;
2. modelo UML canónico actual;
3. elemento seleccionado/foco conversacional;
4. validación actual;
5. aptitud Spring;
6. historial/eventos persistidos del proyecto;
7. conversación compartida relevante;
8. contexto factual de funcionalidades de NexoCASE;
9. conocimiento general del modelo para explicaciones conceptuales.

## 16.2. Ejemplo: pregunta histórica

```text
Pregunta: ¿Quién creó Venta?
```

Groq no debe “recordar” el dato por sí mismo.

El sistema debe consultar un evento real equivalente a:

```json
{
  "tipo": "CLASE_CREADA",
  "actorNombre": "Carlos",
  "elementoNombre": "Venta"
}
```

Después la IA redacta la respuesta.

## 16.3. Ejemplo: conocimiento del producto

```text
Pregunta: ¿Cómo exporto mi diagrama?
```

La respuesta debe originarse en el contexto factual de NexoCASE que describe el flujo real de XMI.

Groq no debe inventar botones ni pasos.

---

# 17. Resolución de referencias conversacionales

Esta capacidad será importante para demostrar contexto real.

Ejemplo:

```text
Renato: ¿Quién creó la clase Venta?
IA: Carlos creó Venta.
Renato: Bueno, agrégale el atributo observacion String.
```

El sistema debe inferir que **“agrégale” se refiere a Venta** porque es el elemento conversacional en foco.

Conceptualmente deberá existir una noción equivalente a:

```text
focoConversacional:
- tipo: clase
- id: venta-123
- nombre: Venta
```

## 17.1. Regla de seguridad semántica

Si existen varias referencias razonables y ninguna es claramente dominante, la IA debe pedir aclaración.

Ejemplo:

```text
Se habló de Venta y DetalleVenta.
Usuario: Agrégale total.
```

Si el referente no es claro:

> ¿Deseas agregar `total` a Venta o a DetalleVenta?

No se debe elegir arbitrariamente.

---

# 18. IA y decisiones de negocio

La IA no debe inventar reglas de dominio simplemente porque una opción “parece lógica”.

Ejemplo:

> Relaciona Venta con lo que creas correcto.

## Caso A — existe evidencia suficiente

Si los requisitos/contexto establecen que cada venta pertenece a un cliente, la IA puede formular y ejecutar la relación cuando la intención sea suficientemente explícita.

## Caso B — no existe evidencia suficiente

Si no hay regla que justifique cardinalidades o responsabilidad, la IA debe explicar la incertidumbre y solicitar decisión.

Ejemplo:

> Una relación Cliente–Venta es plausible, pero el proyecto no contiene una regla que permita fijar su cardinalidad con certeza. ¿Deseas que cada Venta pertenezca a un Cliente y que un Cliente pueda tener múltiples Ventas?

La IA debe ser útil sin convertirse en fuente de requisitos inventados.

---

# 19. Evolución de CU11 — Guardar y recuperar proyecto

CU11 deja de significar únicamente “guardar el JSON del modelo”.

El segundo parcial exige continuidad real del trabajo.

Conceptualmente, un proyecto recuperable debe conservar al menos:

- información del proyecto;
- modelo UML canónico persistido;
- código de acceso;
- participantes/identidades colaborativas necesarias;
- conversación compartida persistente;
- eventos significativos de actividad;
- información mínima para reconstruir contexto útil.

No significa implementar un Git completo ni un historial de cada píxel movido.

---

# 20. Persistencia no relacional — decisión MongoDB

MongoDB será el SGBD objetivo para la persistencia propia de NexoCASE en el segundo parcial.

## 20.1. Qué reemplazará

La persistencia actual mediante archivos JSON (`RepositorioProyectosArchivos`) dejará de ser la persistencia principal de producción del segundo parcial.

## 20.2. Qué NO reemplaza

MongoDB no reemplaza automáticamente PostgreSQL en los backends Spring Boot generados por NexoCASE.

Son contextos distintos:

```text
NexoCASE
→ MongoDB
→ proyectos, colaboración, conversación, eventos, contexto

Backend generado por NexoCASE
→ Spring Boot + JPA/Hibernate + PostgreSQL
```

## 20.3. Colecciones conceptuales iniciales

La estructura definitiva se diseñará en Fase 3, pero desde Fase 1 se reconoce la necesidad conceptual de almacenar:

- proyectos;
- participantes;
- mensajes;
- eventos/actividad;
- modelo/estado recuperable.

No se obliga todavía a que cada concepto sea una colección independiente. MongoDB debe modelarse como documentos según patrones de acceso, no copiando tablas relacionales.

---

# 21. Trazabilidad de actividad

La nueva IA necesita poder contestar preguntas relacionadas con autoría y actividad.

Por eso se registrarán **eventos semánticamente relevantes**.

Ejemplos:

- participante creó clase;
- participante renombró clase;
- participante agregó/modificó/eliminó atributo;
- participante creó/modificó/eliminó relación;
- participante confirmó candidato de imagen;
- participante importó XMI;
- IA ejecutó modificación solicitada por determinado participante;
- proyecto fue guardado o recuperado cuando resulte relevante.

## 21.1. No registrar ruido

No se pretende guardar como eventos de negocio:

- cada movimiento del cursor;
- cada frame de Yjs;
- cada píxel de desplazamiento;
- cada evento de renderizado;
- cada latido WebSocket.

La trazabilidad debe responder preguntas humanas, no convertirse en un log infinito de infraestructura.

---

# 22. Modelo de acceso por código

## 22.1. Regla principal

Cada proyecto tendrá un código de acceso aleatorio y no predecible.

Ejemplo:

```text
NX7K-P4QM
```

## 22.2. El código se valida en backend

Ocultar proyectos en React no constituye seguridad.

El backend deberá impedir acceder a los recursos de un proyecto si no existe un código/contexto de acceso válido.

La protección debe cubrir como mínimo:

- apertura/recuperación del proyecto;
- guardado;
- colaboración WebSocket;
- conversación IA;
- consulta de actividad;
- acciones vinculadas al proyecto.

## 22.3. No listado global

El endpoint/pantalla que actualmente permite descubrir todos los proyectos deberá cambiar de enfoque.

Un usuario no autenticado no debe recibir un catálogo global de proyectos ajenos.

El frontend mostrará únicamente proyectos recientes conocidos por ese navegador, más las opciones crear/unirse.

## 22.4. Rate limiting

Se recomienda limitar intentos repetidos de códigos inválidos para dificultar enumeración por fuerza bruta.

Los valores exactos del límite se decidirán en implementación.

## 22.5. Regeneración de código — decisión refinada

**No se incluye como requisito obligatorio inicial.**

Razón: sin autenticación/propietario verificable no existe una forma sólida de decidir quién está autorizado a regenerarlo. Permitir que cualquier miembro lo regenere podría expulsar accidentalmente al resto.

Si posteriormente se necesita, deberá diseñarse junto con un concepto mínimo de anfitrión/clave administrativa. No se agregará improvisadamente.

---

# 23. Estrategia de Groq

## 23.1. Proveedor

Groq será el proveedor de IA del segundo parcial.

Si los límites de uso gratuito afectan la demostración o pruebas, el equipo acepta contratar un plan económico.

## 23.2. No IA local

La IA local queda fuera del alcance.

No se invertirá tiempo en:

- Ollama como requisito;
- modelos GGUF;
- despliegue local de LLM;
- optimización GPU;
- cuantización;
- infraestructura de inferencia local.

## 23.3. No entrenamiento

No se realizará:

- entrenamiento desde cero;
- fine-tuning obligatorio;
- modificación de pesos;
- dataset de entrenamiento de NexoCASE.

La especialización se logrará mediante:

- instrucciones de sistema;
- contexto factual del producto;
- modelo UML actual;
- historial persistido relevante;
- conversación relevante;
- resultados de validación;
- herramientas/funciones controladas por backend;
- salidas estructuradas.

---

# 24. Posible uso de herramientas por IA

Se considera una estrategia deseable permitir que la IA solicite herramientas controladas por NexoCASE, por ejemplo:

```text
consultarModeloActual
consultarElementoUml
consultarHistorialElemento
consultarActividadParticipante
consultarValidacion
consultarAptitudSpring
solicitarModificacionUml
```

La IA **no accede directamente** a MongoDB, Apollon ni archivos internos.

El backend mantiene el control:

```text
IA solicita herramienta
       ↓
backend valida
       ↓
ejecuta fuente de verdad
       ↓
devuelve resultado
       ↓
IA redacta respuesta / CU04 ejecuta acción permitida
```

El diseño detallado se realizará en Fase 2 y fases posteriores.

---

# 25. Responsabilidades por capa

## 25.1. Responsabilidad de negocio

Define:

- quién puede entrar al proyecto;
- qué significa ser participante;
- qué acciones requieren solicitud explícita;
- qué conversaciones son compartidas;
- qué información puede responder la IA;
- cuándo debe pedir aclaración;
- qué debe persistirse para continuar el trabajo;
- qué constituye un evento significativo.

## 25.2. Frontend

Será responsable de:

- crear/unirse a proyecto;
- solicitar nombre visible;
- recordar proyectos recientes del dispositivo;
- mostrar código cuando corresponda;
- mostrar participantes;
- presentar conversación compartida;
- mostrar preguntas y respuestas de IA;
- mantener experiencia de Apollon;
- representar correctamente cambios sincronizados;
- conservar herramientas actuales de NexoCASE.

No debe decidir por sí solo permisos críticos.

## 25.3. Backend

Será responsable de:

- generar y validar códigos de proyecto;
- aislar recursos por proyecto;
- gestionar identidad técnica/contexto de participante;
- persistir y recuperar información mediante repositorio MongoDB;
- persistir mensajes y eventos relevantes;
- orquestar IA;
- aportar contexto autoritativo;
- controlar herramientas invocadas por IA;
- enrutar acciones explícitas hacia CU04;
- rechazar acceso sin autorización básica;
- mantener contratos de API y WebSocket.

## 25.4. Base de datos MongoDB

Será responsable de persistir datos durables de NexoCASE.

No es responsable de:

- interpretar lenguaje natural;
- validar UML;
- decidir reglas de negocio;
- sincronizar directamente Apollon.

## 25.5. Modelo UML canónico

Continúa siendo la autoridad semántica del modelo UML.

No se permitirá que conversación, MongoDB o Groq creen una segunda representación semántica competidora.

---

# 26. Reglas de negocio congeladas

Las siguientes reglas deben considerarse oficiales para el desarrollo.

### RN-PRO-01 — Código por proyecto
Todo proyecto colaborativo debe disponer de un código de acceso único generado por NexoCASE.

### RN-PRO-02 — Acceso
Un participante sin acceso previo debe proporcionar un código válido para entrar al proyecto.

### RN-PRO-03 — No descubrimiento global
Un usuario no debe poder descubrir todos los proyectos existentes mediante la pantalla principal.

### RN-PRO-04 — Permisos simples
Todo participante que acceda mediante un código válido podrá visualizar y editar el proyecto.

### RN-PRO-05 — Sin autenticación completa
El nombre visible y participanteId identifican una sesión colaborativa, pero no constituyen una identidad autenticada.

### RN-PRO-06 — Aislamiento
Todos los datos y canales colaborativos deben estar asociados al proyecto correspondiente.

### RN-ID-01 — Identidad técnica
Cada participante debe disponer de un identificador técnico independiente de su nombre visible.

### RN-ID-02 — Fuente de identidad
La identidad del remitente debe provenir del contexto técnico de la sesión, no de afirmaciones contenidas en el mensaje.

### RN-COL-01 — Visibilidad compartida
Las preguntas y respuestas de la IA realizadas dentro del proyecto serán visibles para los participantes de la sesión.

### RN-COL-02 — Sin conversación privada
El alcance obligatorio no incluye conversaciones privadas uno-a-uno con la IA dentro de un proyecto.

### RN-COL-03 — Trazabilidad semántica
Las acciones significativas sobre el modelo deben poder atribuirse al participante o a la IA que las realizó.

### RN-IA-01 — No autonomía destructiva
La IA no modificará el modelo UML por iniciativa propia.

### RN-IA-02 — Acción explícita
Toda modificación generada por IA deberá originarse en una solicitud explícita de un participante.

### RN-IA-03 — Contexto
La IA debe considerar al participante actual, proyecto, modelo y contexto conversacional relevante.

### RN-IA-04 — Referencias
Cuando una expresión contextual tenga un referente inequívoco, la IA podrá resolverlo sin volver a pedir información.

### RN-IA-05 — Ambigüedad
Cuando existan varias interpretaciones razonables, la IA deberá solicitar aclaración antes de modificar.

### RN-IA-06 — No inventar negocio
La IA no deberá inventar reglas de negocio, cardinalidades o requisitos cuando no exista evidencia suficiente.

### RN-IA-07 — Autoridad factual del producto
Las respuestas sobre cómo funciona NexoCASE deberán apoyarse en el contexto factual del producto.

### RN-IA-08 — Autoridad histórica
Las respuestas sobre quién hizo qué deberán apoyarse en eventos/datos persistidos, no en memoria probabilística del LLM.

### RN-IA-09 — Separación CU12/CU04
CU12 orienta y razona; CU04 ejecuta la modificación UML solicitada.

### RN-PER-01 — Continuidad
El estado durable necesario para continuar el proyecto en otro momento deberá almacenarse en MongoDB.

### RN-PER-02 — Conversación persistente
La conversación colaborativa relevante no debe existir únicamente en memoria del navegador.

### RN-PER-03 — Eventos persistentes
Los eventos relevantes necesarios para trazabilidad/contexto deberán sobrevivir al cierre de las sesiones.

---

# 27. Requisitos funcionales derivados de la Fase 1

### RF2-01 — Crear proyecto protegido
El sistema deberá crear un proyecto junto con un código de acceso aleatorio.

### RF2-02 — Unirse mediante código
El sistema deberá permitir acceder a un proyecto existente mediante su código y un nombre visible.

### RF2-03 — Restringir descubrimiento
El sistema no deberá exponer al usuario un listado global de proyectos desconocidos.

### RF2-04 — Identificar participante
El sistema deberá asociar cada interacción colaborativa a un participanteId y nombre visible.

### RF2-05 — Compartir interacción IA
El sistema deberá mostrar a los colaboradores las preguntas y respuestas realizadas a la IA dentro del proyecto.

### RF2-06 — Conservar contexto
El sistema deberá proporcionar a la IA el contexto suficiente para resolver referencias conversacionales claras.

### RF2-07 — Consultar actividad
El sistema deberá permitir que la IA obtenga hechos persistidos sobre actividad relevante del proyecto.

### RF2-08 — Explicar NexoCASE
CU12 deberá continuar explicando el uso real de las funcionalidades de NexoCASE.

### RF2-09 — Explicar UML
CU12 deberá poder orientar conceptualmente sobre UML dentro de su función de mentor.

### RF2-10 — Revisar modelo
CU12 deberá analizar el modelo usando fuentes reales como modelo canónico, CU08 y aptitud Spring.

### RF2-11 — Ejecutar orden contextual
Cuando una orden de modificación tenga un referente inequívoco, el sistema deberá transformarla en una solicitud concreta para CU04.

### RF2-12 — Preguntar ante ambigüedad
Si una orden no puede resolverse de forma segura, el sistema deberá pedir aclaración y no modificar.

### RF2-13 — Persistir proyecto colaborativo
El estado necesario para recuperar el trabajo deberá almacenarse en MongoDB.

### RF2-14 — Mantener funciones del primer parcial
La incorporación de estas capacidades no deberá eliminar las funcionalidades existentes de CU02 y CU05–CU10.

---

# 28. Criterios de aceptación de alto nivel

Estos criterios se detallarán en las fases posteriores, pero desde ahora sirven como contrato del producto.

## Acceso

**Dado** un proyecto creado,  
**cuando** un participante intenta acceder sin un código válido,  
**entonces** NexoCASE debe impedir el acceso al proyecto.

**Dado** un código válido,  
**cuando** un participante proporciona su nombre visible,  
**entonces** NexoCASE debe permitirle ingresar al proyecto correspondiente.

## Colaboración

**Dado** dos participantes dentro del mismo proyecto,  
**cuando** uno realiza un cambio UML válido,  
**entonces** ambos deben observar el mismo modelo actualizado.

## IA compartida

**Dado** dos participantes conectados,  
**cuando** uno realiza una pregunta a la IA,  
**entonces** la pregunta y respuesta deben ser visibles para ambos.

## Identidad

**Dado** que Carlos realiza una consulta,  
**cuando** la IA responde,  
**entonces** debe utilizar la identidad técnica asociada a Carlos y no una identidad declarada dentro del texto.

## Historial

**Dado** que Carlos creó la clase Venta y existe un evento persistido,  
**cuando** Renato pregunta “¿Quién creó Venta?”,  
**entonces** la IA debe responder utilizando ese evento como fuente factual.

## Contexto conversacional

**Dado** que la conversación está enfocada en Venta,  
**cuando** Renato dice “agrégale observacion String”,  
**entonces** el sistema debe interpretar Venta como referente si no existe ambigüedad.

## Control humano

**Dado** que CU12 detecta un problema,  
**cuando** ningún participante solicita corregirlo,  
**entonces** la IA no debe modificar el modelo.

## Persistencia

**Dado** que el equipo finaliza una sesión,  
**cuando** vuelve posteriormente al mismo proyecto,  
**entonces** debe recuperar el estado durable definido para continuar el trabajo.

## Regresión

**Dado** el NexoCASE evolucionado,  
**cuando** se prueban XMI, imagen, validación y generación Spring,  
**entonces** las capacidades conservadas deben continuar funcionando según sus contratos.

---

# 29. Fuera de alcance

Queda explícitamente fuera del alcance obligatorio:

- login con correo/contraseña;
- OAuth/Google/Microsoft;
- recuperación de contraseña;
- perfiles de usuario;
- roles avanzados;
- permisos lector/editor/admin;
- invitaciones por correo;
- chat privado;
- cifrado E2E de conversación;
- historial tipo Git completo;
- IA autónoma que actúe sin solicitud;
- entrenamiento/fine-tuning del modelo;
- IA local;
- aplicación móvil obligatoria;
- reemplazo de Apollon;
- reemplazo del modelo canónico;
- reemplazo de XMI/crunch_uml;
- rediseño total del generador Spring;
- RAG complejo como requisito inicial;
- vector database como requisito inicial;
- microservicios innecesarios.

Una funcionalidad fuera de alcance solo se incorporará si primero se demuestra que resuelve un requisito real que no puede resolverse más simplemente.

---

# 30. Riesgos y edge cases identificados

## R01 — Código compartido filtrado

**Riesgo:** cualquier persona con el código puede editar.  
**Aceptación:** es una limitación del modelo sin cuentas.  
**Mitigación inicial:** códigos no predecibles, no listado global y rate limiting.

## R02 — Dos participantes con el mismo nombre

**Riesgo:** respuestas como “Carlos hizo...” pueden ser ambiguas.  
**Mitigación:** participanteId técnico; en interfaz se puede solicitar nombres distinguibles o desambiguar visualmente.

## R03 — Mismo usuario desde otro dispositivo

**Riesgo:** no puede demostrarse que sea la misma identidad histórica.  
**Aceptación:** limitación consciente de no usar autenticación.

## R04 — IA inventa autoría

**Mitigación:** autoría proviene exclusivamente de eventos persistidos.

## R05 — IA inventa funcionalidad de NexoCASE

**Mitigación:** `ContextoProductoNexoCASE`/fuente factual prioritaria y respuestas deterministas donde convenga.

## R06 — “Corrígelo” apunta al elemento equivocado

**Mitigación:** foco conversacional + verificación de ambigüedad + aclaración cuando corresponda.

## R07 — Conversación demasiado larga

**Riesgo:** coste, latencia y pérdida de precisión.  
**Mitigación futura:** persistir todo, pero enviar a Groq contexto relevante/resumido, no toda la historia indiscriminadamente.

## R08 — Confundir persistencia con tiempo real

**Mitigación:** Yjs/WebSocket resuelve sincronización; MongoDB resuelve durabilidad/contexto. Ninguno sustituye automáticamente al otro.

## R09 — Romper primer parcial

**Mitigación:** pruebas de regresión obligatorias para los CU conservados.

## R10 — Diseñar MongoDB como PostgreSQL

**Mitigación:** modelar documentos según patrones de acceso en Fase 3; no crear colecciones/tablas equivalentes por costumbre.

## R11 — Mezclar CU12 y CU04

**Riesgo:** asistente monolítico difícil de controlar/testear.  
**Mitigación:** mantener separación de responsabilidades y utilizar orquestación.

## R12 — Pseudoseguridad solo en frontend

**Mitigación:** validar acceso también en backend/API/WebSocket.

---

# 31. Decisiones que NO deben reabrirse sin nueva evidencia

Se consideran congeladas:

- conservar los 12 CU;
- no rehacer NexoCASE;
- MongoDB para persistencia propia del segundo parcial;
- Groq como proveedor de IA;
- no IA local;
- no entrenamiento/fine-tuning como requisito;
- no app móvil obligatoria;
- no login/correo/contraseña;
- código de proyecto como mecanismo de acceso básico;
- participanteId + nombre visible;
- todos los participantes con código pueden editar;
- conversación IA compartida;
- IA no autónoma;
- CU12 conserva enseñanza de NexoCASE;
- CU12 se vuelve colaborativo/contextual;
- CU04 sigue siendo ejecutor de modificaciones;
- modelo UML canónico sigue siendo fuente semántica;
- XMI, Apollon, Yjs y generación Spring se preservan.

---

# 32. Decisiones todavía abiertas para fases posteriores

No todo debe decidirse en Fase 1.

Quedan deliberadamente para diseño técnico/funcional posterior:

- formato definitivo y longitud del código de proyecto;
- forma exacta de transportar el código en HTTP/WebSocket;
- estructura definitiva de colecciones MongoDB;
- MongoDB local vs Atlas para despliegue final;
- librería de acceso MongoDB;
- estrategia exacta de reconexión WebSocket;
- formato visual de la conversación compartida;
- política exacta de nombres duplicados;
- ventana exacta de contexto enviada a Groq;
- mecanismo de resumen de conversaciones largas;
- tool calling exacto y contratos de cada herramienta;
- forma exacta de representar foco conversacional;
- qué eventos semánticos se persistirán en primera versión;
- parámetros de rate limiting;
- si se requiere anfitrión en una fase posterior.

Estas decisiones no bloquean la definición del alcance.

---

# 33. Definición de terminado de la Fase 1

La Fase 1 se considera terminada cuando ambos integrantes pueden responder correctamente y de forma consistente las siguientes preguntas:

1. ¿Cuál es el objetivo central del segundo parcial?
2. ¿Por qué NexoCASE no se rehace?
3. ¿Qué funciones del primer parcial deben conservarse?
4. ¿Cuántos casos de uso se mantienen?
5. ¿Qué CU evolucionan?
6. ¿Qué diferencia existe entre CU12 y CU04?
7. ¿Por qué la IA no puede actuar por iniciativa propia?
8. ¿Cómo sabrá la IA quién está hablando?
9. ¿Cómo sabrá quién creó una clase?
10. ¿Por qué Groq no necesita entrenamiento para este alcance?
11. ¿Qué información debe provenir de NexoCASE y no del conocimiento probabilístico del LLM?
12. ¿Por qué se introduce MongoDB?
13. ¿Qué diferencia existe entre MongoDB de NexoCASE y PostgreSQL del backend generado?
14. ¿Cómo entra un compañero a un proyecto?
15. ¿Por qué ya no es correcto mostrar todos los proyectos como “Mis proyectos”?
16. ¿Qué seguridad proporciona el código y qué NO proporciona?
17. ¿Qué ocurre si la IA no sabe a qué se refiere “corrígelo”?
18. ¿Qué funcionalidades están expresamente fuera de alcance?

Si uno de los dos integrantes no puede explicar estas respuestas, la Fase 1 no está realmente cerrada aunque exista este documento.

---

# 34. Guía rápida para el compañero

Si solo tienes cinco minutos para entender la evolución, memoriza esto:

1. **No estamos creando otro NexoCASE.** Extendemos el actual.
2. **Todo el primer parcial sigue existiendo.**
3. **La novedad es la IA colaborativa.** Todos ven la interacción.
4. **La IA sabe quién pregunta.** No responde como un chat genérico.
5. **CU12 enseña, explica, revisa y recomienda.**
6. **CU04 modifica el UML cuando el usuario lo pide.**
7. **La IA no actúa sola.**
8. **MongoDB guarda el estado colaborativo durable.**
9. **Los hechos históricos salen de MongoDB/eventos, no de la memoria de Groq.**
10. **Groq razona; NexoCASE proporciona la verdad.**
11. **Cada proyecto tiene un código tipo Classroom.**
12. **No hay login.** Código + nombre visible + participanteId técnico.
13. **No se muestran todos los proyectos.** Crear / Unirse / Proyectos recientes.
14. **Todos con código pueden editar.** No hay roles avanzados.
15. **No IA local, no móvil obligatorio, no entrenamiento.**
16. **Apollon, Yjs, modelo canónico, XMI y Spring se conservan.**

---

# 35. Resultado esperado al comenzar la Fase 2

Al iniciar la Fase 2 ya no se debe debatir “qué quiere hacer el segundo parcial”.

La siguiente fase deberá diseñar **cómo se verá y comportará** esta experiencia:

- pantallas y flujo Crear/Unirse;
- ingreso de nombre visible;
- presentación del código;
- presencia de participantes;
- interfaz de conversación compartida;
- mensajes dirigidos a participantes;
- representación de acciones de IA;
- estados de consulta/acción/aclaración;
- continuidad entre CU12 y CU04;
- ejemplos completos de conversaciones contextuales;
- criterios de UX para evitar acciones ambiguas;
- eventos colaborativos que deben hacerse visibles.

La Fase 2 no debe redefinir el alcance. Debe convertir este alcance en comportamiento funcional concreto.

---

# 36. Conclusión de la Fase 1

NexoCASE llega al segundo parcial con una base técnicamente útil: editor UML mediante Apollon, modelo canónico, colaboración en tiempo real, IA de modelado, IA desde imagen, asistencia contextual, XMI, validación, persistencia básica y generación Spring Boot.

El problema no es sustituir esas capacidades, sino **integrarlas alrededor de una sesión de proyecto realmente aislada y una IA colaborativa consciente del contexto**.

La solución objetivo queda resumida así:

```text
                 PROYECTO NEXOCASE
                        │
            código de acceso + identidad
                        │
        ┌───────────────┴────────────────┐
        │                                │
 participantes                     persistencia
        │                              MongoDB
        │                                │
        ├──── modelo UML compartido ─────┤
        │          Apollon/Yjs           │
        │                                │
        └──── conversación IA ───────────┘
                        │
               Orquestador IA
                  /           \
                CU12          CU04
           enseñar/revisar   modificar
                  \           /
                   modelo canónico
                        │
         Validación / XMI / Spring
```

La filosofía oficial será:

> **Groq razona; NexoCASE proporciona la verdad; el usuario conserva el control.**

Con esta definición, la Fase 1 queda lista para dar paso al diseño funcional detallado de la Fase 2.
