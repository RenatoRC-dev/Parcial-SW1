# NexoCASE — Segundo Parcial de SW1
## Fase 9 — Documentación final, trazabilidad y preparación de defensa

**Estado:** Plan final documental y de defensa  
**Prerequisitos:** Fases 1–8  
**Objetivo:** transformar el producto verificado en una entrega académica coherente, trazable y defendible por ambos integrantes.

---

# 1. Principio

La documentación no debe describir el producto que “queríamos hacer”.

Debe describir:

> **el producto realmente implementado y probado.**

Si hay diferencia:

1. corregir código;
2. o corregir documento;
3. nunca ocultar contradicción.

---

# 2. Estructura documental exigida

Organizar como mínimo:

## Parte I — Fundamentación Teórica de la Aplicación

## Parte II — Registro del Proceso de Desarrollo del Proyecto

## Parte III — Mecanismos para que el Usuario Aprenda a Utilizar la Aplicación de Manera Efectiva

Más:

- bibliografía;
- anexos;
- portada;
- índices;
- evidencias.

---

# 3. Portada

Debe indicar claramente:

- segundo examen parcial;
- nombre del proyecto: NexoCASE;
- grupo;
- integrantes;
- materia;
- docente;
- gestión;
- fecha requerida.

No reutilizar carátula del primer parcial sin actualizar.

---

# 4. Parte I — Fundamentación teórica

## 4.1. CASE

- concepto;
- propósito;
- relación con NexoCASE.

## 4.2. Desarrollo basado en componentes

Relacionar con paquetes/componentes reales.

## 4.3. Arquitectura de software

Perspectivas:

- frontend;
- backend;
- datos;
- despliegue.

## 4.4. Inteligencia Artificial

Distinguir:

- LLM;
- proveedor Groq;
- contextualización;
- structured outputs/tool use si quedó implementado;
- no entrenamiento propio;
- no IA local como decisión de alcance.

## 4.5. IA integrada al entorno de desarrollo

Explicar cómo:

```text
contexto → razonamiento → propuesta/acción → modelo
```

## 4.6. Desarrollo dirigido por especificaciones

Relacionar Fases 1–3 con decisiones previas al código.

## 4.7. UML 2.5 o superior

Usar OMG como autoridad teórica cuando corresponda en bibliografía académica.

## 4.8. Proceso de software

Documentar PUDS/Proceso Unificado según enfoque de la materia y el proceso realmente aplicado.

## 4.9. Frameworks y tecnologías

- React;
- Node/Express;
- MongoDB;
- Apollon;
- Yjs;
- Groq;
- Spring Boot generado;
- PostgreSQL generado.

No mezclar la BD interna Mongo con la BD del backend generado.

---

# 5. Parte II — Registro del proceso

Narrar evolución real:

```text
Primer parcial
→ auditoría
→ Fase 1 alcance
→ Fase 2 comportamiento
→ Fase 3 arquitectura
→ Fase 4 persistencia/acceso
→ Fase 5 CU12
→ Fase 6 orquestación
→ Fase 7 UX
→ Fase 8 V&V
```

Usar:

- commits;
- PRs;
- pruebas;
- diagramas;
- decisiones.

---

# 6. Casos de uso oficiales

Mantener 12.

Actualizar descripciones:

- CU01;
- CU03;
- CU04;
- CU11;
- CU12.

No crear CU13 por chat/código.

---

# 7. CU01 documentado

Nombre:

> Crear o acceder a proyecto

Incluir:

- actor;
- objetivo;
- precondiciones;
- crear;
- unirse;
- reabrir;
- código inválido;
- credencial inválida;
- postcondiciones;
- reglas;
- datos.

---

# 8. CU03 documentado

Debe mostrar:

- mismo proyecto;
- presencia;
- identidad;
- modelo compartido;
- conversación IA visible;
- aislamiento.

---

# 9. CU04 documentado

Debe aclarar dos orígenes:

1. acción directa panel Asistente IA;
2. acción derivada desde conversación CU12 mediante orquestador.

La responsabilidad sigue siendo ejecutar modificación UML.

---

# 10. CU11 documentado

Debe explicar:

- MongoDB;
- continuidad;
- cero usuarios;
- guardar/recuperar;
- conversaciones/eventos cuando corresponda.

No decir que Yjs es persistencia durable.

---

# 11. CU12 documentado

Nombre:

> Asistir colaborativamente al equipo

Debe incluir:

- producto;
- UML;
- revisión;
- actividad;
- interlocutor;
- contexto;
- conversación compartida;
- recomendaciones;
- propuesta;
- límite de autonomía.

---

# 12. Reglas de negocio

Consolidar RN de Fases 1–2 y las decisiones realmente implementadas.

No copiar reglas obsoletas.

---

# 13. Requisitos

Mantener trazabilidad:

```text
RF
→ CU
→ módulo
→ prueba
```

Agregar requisitos técnicos solo si la metodología documental los requiere; no confundirlos con CU.

---

# 14. Modelo de datos MongoDB

Documentar como documentos/colecciones.

Ejemplo:

```text
projects
participants
messages
events
```

Mostrar:

- propósito;
- campos clave;
- índices;
- relaciones lógicas por `projectId`.

No usar notación de FK SQL si no corresponde.

---

# 15. Arquitectura de componentes

Debe representar como mínimo:

```text
Frontend React
Backend Node/Express
MongoDB
Groq
Apollon/Yjs
Crunch UML/XMI
Generador Spring
```

Mostrar dependencias reales.

---

# 16. Arquitectura de datos

Separar:

```text
MongoDB = NexoCASE
PostgreSQL = backend Spring generado
```

Esta distinción debe ser visible.

---

# 17. Despliegue

Actualizar al despliegue real final.

No documentar AWS si el sistema está en Render u otro proveedor salvo que realmente se haya migrado.

Nodos lógicos:

- navegador;
- frontend;
- backend;
- MongoDB;
- Groq;
- servicios externos necesarios.

---

# 18. Diagramas de actividad

Prioritarios:

- Crear/unirse a proyecto;
- colaboración;
- consulta IA;
- acción contextual “hazlo”;
- continuidad/reapertura.

No hacer diagramas decorativos sin valor.

---

# 19. Comunicación / secuencia

Para CU relevantes:

### CU01
Actor → View → Controller → Repositories.

### CU12
Actor → View → Controller/Orchestrator → Context → Groq/Repositories.

### CU04 contextual
Actor → CU12 UI → Orchestrator → CU04 → Canonical Model → Collaboration.

Respetar regla del proyecto:

- mensajes de ida;
- Controller media;
- evitar Entity→Entity innecesario.

---

# 20. Diagrama de clases

Representar responsabilidades reales, no documentos Mongo como “tablas” sin comportamiento.

Candidatos:

- Project;
- Participant;
- Message;
- ProjectEvent;
- AccessCredential/servicio;
- AIContext;
- AIOrchestrator;
- Repositories.

El modelo UML canónico existente debe mantenerse separado del modelo de colaboración cuando corresponda.

---

# 21. Paquetes

Actualizar paquetes solo si código los tiene.

Ejemplos lógicos:

- gestión de proyectos;
- colaboración;
- modelado UML;
- asistencia contextual;
- IA de modelado;
- persistencia;
- interoperabilidad;
- generación.

No crear paquete “MongoDB” como paquete de negocio si solo es infraestructura.

---

# 22. Parte III — Aprendizaje del usuario

Esta sección puede ser fuerte gracias a CU12.

Incluir:

- onboarding;
- ayuda contextual;
- preguntas rápidas;
- ejemplos;
- mensajes de error;
- CU12 como mentor;
- explicación de botones;
- guía Crear/Unirse;
- ayuda XMI;
- ayuda generación;
- ayuda UML.

Demostrar con capturas reales.

---

# 23. Manual rápido

Flujo recomendado:

1. crear proyecto;
2. compartir código;
3. unirse;
4. modelar;
5. usar Asistente IA;
6. usar Asistente colaborativo;
7. validar;
8. XMI;
9. generar;
10. guardar/reabrir.

---

# 24. Evidencias visuales

Capturas sugeridas:

- pantalla inicial;
- código;
- dos participantes;
- misma clase en dos navegadores;
- CU04;
- CU12;
- “quién creó Venta”;
- “hazlo”;
- MongoDB Compass;
- XMI;
- validación;
- generación;
- proyecto recuperado.

Cada figura:

- título;
- numeración;
- nota/fuente si corresponde.

---

# 25. Evidencia de V&V

Incluir resumen:

- pruebas;
- resultados;
- matrices;
- bugs resueltos;
- entorno.

No pegar miles de logs al cuerpo principal.

Mover evidencia extensa a anexos.

---

# 26. Matriz de trazabilidad

Columnas recomendadas:

| Requisito | CU | Regla | Módulo | Prueba | Estado |
|---|---|---|---|---|---|

Debe ser verificable.

---

# 27. Bibliografía

Parte teórica sí requiere fuentes.

Usar fuentes autoritativas:

- OMG para UML;
- textos/autores requeridos por la materia;
- documentación oficial de tecnologías cuando corresponda.

No citar ChatGPT como autoridad técnica si la institución no lo solicita.

---

# 28. Anexos

Posibles:

- QR repositorio;
- QR aplicación desplegada;
- resumen de API;
- colecciones Mongo;
- pruebas;
- evidencias;
- commits/tag;
- manual ampliado.

---

# 29. QR

La entrega física puede contener QR hacia recursos finales.

Verificar antes:

- abre sin cuenta innecesaria;
- URL estable;
- permisos correctos;
- no apunta a localhost;
- contenido congelado.

---

# 30. Freeze

Antes de publicación:

1. terminar pruebas;
2. identificar commit/tag;
3. desplegar;
4. verificar URLs;
5. generar documentación;
6. actualizar QR;
7. hacer una última V&V;
8. publicar.

Después del freeze académico, evitar cambios que hagan que código/documento publicados dejen de coincidir.

---

# 31. Guion de defensa

Ambos deben poder explicar:

- problema;
- por qué IA colaborativa;
- por qué no IA autónoma;
- por qué MongoDB;
- diferencia Mongo/PostgreSQL;
- CU12/CU04;
- modelo canónico;
- Yjs vs persistencia;
- código de acceso;
- identidad sin login;
- trazabilidad;
- “hazlo”;
- continuidad.

---

# 32. Demo recomendada

Orden de alto impacto:

```text
1. Crear proyecto
2. Compartir código
3. Carlos entra
4. colaboración manual
5. Carlos crea Venta
6. Renato pregunta quién la creó
7. IA responde con autoría
8. Renato pide revisión
9. Renato dice "Hazlo"
10. CU04 modifica
11. ambos ven cambio
12. validar
13. generar Spring
14. cerrar y recuperar
```

Este demo cubre el corazón del segundo parcial y demuestra conservación del primero.

---

# 33. Preguntas difíciles probables

## ¿La IA actúa sola?
No. Puede razonar/recomendar cuando se le consulta; modifica cuando un Diseñador solicita una acción.

## ¿Por qué dos paneles?
Uno optimiza acción directa; otro conversación contextual. Comparten el mismo proyecto/contexto y CU04 sigue siendo ejecutor.

## ¿Por qué MongoDB?
Persistencia no relacional exigida + datos colaborativos/documentales.

## ¿Por qué no login?
Alcance deliberado: código + identidad ligera. No se presenta como autenticación fuerte.

## ¿Qué pasa si todos salen?
La presencia se vacía; el proyecto sigue en MongoDB.

## ¿Cómo sabe quién creó una clase?
Eventos persistidos, no memoria de Groq.

---

# 34. Revisión cruzada del equipo

Integrante A intenta explicar módulos de B.

Integrante B intenta explicar módulos de A.

Si alguno no puede:

- revisar;
- practicar;
- corregir dependencia de “solo lo hizo mi compañero”.

---

# 35. Checklist final

- portada;
- índice;
- figuras;
- tablas;
- Parte I;
- Parte II;
- Parte III;
- bibliografía;
- anexos;
- CU actualizados;
- arquitectura actualizada;
- Mongo documentado;
- V&V;
- URLs;
- QR;
- repo;
- tag;
- despliegue;
- ambos preparados.

---

# 36. Definition of Done

La Fase 9 termina cuando:

- documento describe código real;
- QR funciona;
- deploy funciona;
- repo final está identificado;
- trazabilidad completa;
- manual suficiente;
- ambos pueden defender;
- no quedan contradicciones conocidas.

---

# 37. Cierre del segundo parcial

La evolución completa debe poder resumirse así:

> **NexoCASE conserva su modelado UML y capacidades del primer parcial, pero ahora organiza el trabajo por proyectos aislados, mantiene continuidad no relacional y convierte la IA en un colaborador compartido que conoce el contexto del equipo, orienta y revisa, y ejecuta modificaciones solicitadas a través del mismo núcleo controlado de modelado por IA.**

**FIN — FASE 9**
