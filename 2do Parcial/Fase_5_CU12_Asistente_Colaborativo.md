# NexoCASE — Segundo Parcial de SW1
## Fase 5 — Evolución de CU12 a Asistente Colaborativo

**Estado:** Plan funcional-técnico de implementación IA consultiva  
**Prerequisitos:** Fases 1–4  
**Objetivo:** convertir CU12 en el mentor colaborativo compartido del proyecto, conservando su responsabilidad de orientación y lectura.  
**Siguiente fase:** Fase 6 — Orquestación contextual CU12 ↔ CU04

---

# 1. Principio central

CU12 no desaparece y no se fusiona con CU04.

CU12 evoluciona de:

> asistente contextual individual de solo lectura

a:

> **asistente colaborativo consciente del proyecto, participante, conversación, modelo y actividad.**

El segundo panel visual se conserva y se renombra preferentemente:

> **Asistente colaborativo**

---

# 2. Responsabilidades de CU12

Debe poder:

1. enseñar NexoCASE;
2. explicar UML;
3. explicar modelo actual;
4. revisar modelo;
5. explicar validación;
6. explicar aptitud Spring;
7. consultar actividad;
8. responder quién hizo qué;
9. considerar quién pregunta;
10. mantener conversación compartida;
11. utilizar contexto de otros participantes cuando sea pertinente;
12. recomendar cambios fundamentados;
13. generar propuestas estructuradas que Fase 6 podrá ejecutar.

No debe aplicar directamente mutaciones al modelo.

---

# 3. Inicio de intervención

La IA **no inicia espontáneamente trabajo**.

Interviene cuando un Diseñador:

- pregunta;
- pide revisión;
- pide sugerencia;
- pide explicación;
- pide guía;
- solicita una acción.

Puede ser proactiva **dentro de la respuesta solicitada**, por ejemplo señalando un problema relacionado, pero no debe enviar mensajes autónomos sin interacción humana dentro del alcance obligatorio.

---

# 4. Conversación compartida

Flujo:

```text
Renato envía mensaje
        ↓
backend valida identidad
        ↓
persistir mensaje humano
        ↓
broadcast a proyecto
        ↓
construir contexto
        ↓
CU12 / Groq
        ↓
persistir respuesta IA
        ↓
broadcast a proyecto
```

Carlos, si está conectado, ve ambas partes.

Un participante que entra más tarde puede recuperar historial persistido.

---

# 5. Mensaje humano

El backend obtiene autor desde credencial.

Nunca:

```text
body.participantId = autoridad
```

Sí:

```text
request.context.participantId = autoridad
```

Persistir `displayNameSnapshot` permite mostrar el nombre utilizado en ese momento.

---

# 6. Mensaje IA

Debe indicar conceptualmente:

- proyecto;
- a quién responde;
- contenido;
- timestamp;
- elementos relacionados;
- clasificación;
- posible propuesta estructurada.

No necesita escribir el nombre del usuario en cada frase, pero debe demostrar identidad contextual.

---

# 7. Context builder

Crear servicio:

```text
BuildCollaborativeAIContext
```

Entradas:

- projectId;
- participantId;
- pregunta;
- elemento seleccionado opcional.

Recupera:

- participante;
- proyecto;
- modelo;
- modelRevision;
- foco;
- mensajes recientes;
- eventos relacionados;
- validación;
- aptitud Spring;
- contexto de producto.

---

# 8. Selección de historial

No enviar toda la conversación.

Primera estrategia suficientemente buena:

```text
últimos N mensajes del proyecto
+
mensajes vinculados a foco/elemento si aplica
+
eventos recientes relevantes
```

N puede configurarse y medirse.

No congelar 8 mensajes por herencia si ya no es adecuado.

---

# 9. Resumen histórico

No implementar RAG inicialmente.

Si la conversación supera un umbral:

- puede generarse un resumen de contexto;
- el resumen se considera auxiliar;
- hechos de autoría siguen viniendo de `events`;
- estado UML sigue viniendo del modelo canónico.

Un resumen del LLM nunca sustituye las fuentes reales.

---

# 10. Jerarquía de verdad

```text
1. identidad validada backend
2. eventos reales
3. modelo canónico actual
4. CU08 / aptitud Spring
5. contexto factual NexoCASE
6. conversación pertinente
7. conocimiento general del LLM
```

Cuando dos fuentes chocan, gana la más alta aplicable.

---

# 11. Contexto de producto

Actualizar la fuente factual.

Debe conocer exactamente:

- crear proyecto;
- unirse con código;
- recientes;
- guardar;
- modelado manual;
- CU04 texto;
- CU04 voz;
- CU05 imagen;
- XMI;
- validación;
- generación;
- colaboración;
- asistente colaborativo.

Debe eliminar instrucciones obsoletas.

---

# 12. Consultas de producto

Ejemplos de prueba:

```text
¿Cómo me uno a un proyecto?
¿Cómo comparto mi proyecto?
¿Cómo importo XMI?
¿Importar XMI genera Spring?
¿Cómo funciona voz?
¿Qué hace Desde imagen?
¿Por qué no puedo generar?
```

La respuesta debe corresponder al producto real.

---

# 13. Mentor UML

Debe responder conceptos útiles:

```text
atributo derivado
multiplicidad
asociación
agregación
composición
generalización
clase asociativa
visibilidad
```

No convertir toda respuesta en una modificación.

---

# 14. Revisión de modelo

Pregunta:

> Revisa Venta.

CU12:

1. encuentra clase;
2. lee modelo actual;
3. usa validador;
4. usa aptitud si corresponde;
5. separa:
   - error objetivo;
   - recomendación;
   - hipótesis de negocio.

No inventar requisitos faltantes.

---

# 15. Consultas históricas

Ejemplo:

> ¿Quién creó Venta?

Backend:

```text
buscar event(CLASS_CREATED, element.id/name)
```

Si existe:

> Carlos creó Venta...

Si no existe evidencia:

> No tengo un evento suficiente para atribuir con certeza la creación de Venta.

Nunca completar con suposición.

---

# 16. Consultas por participante

Ejemplo:

> ¿Qué hizo Carlos?

Backend identifica participantes con ese nombre.

Si solo uno:

- consulta eventos recientes por participantId.

Si hay dos Carlos:

- desambigua.

La IA resume hechos recuperados.

---

# 17. Incorporación tardía

Ejemplo:

> Acabo de entrar, ¿qué avanzaron?

La IA puede resumir:

- eventos recientes;
- cambios relevantes;
- conversación reciente.

Debe distinguir:

> “Se registró...”

de:

> “Parece que...”

---

# 18. Foco conversacional

CU12 puede actualizar un foco por participante.

Ejemplo:

```text
Renato: Explícame Venta.
focus = Venta

Renato: ¿Quién la creó?
→ Venta
```

El foco debe contener ID estable.

No solo nombre.

---

# 19. Cambio de foco

```text
Explícame Venta.
Ahora revisa Cliente.
Agrégale...
```

Después de “Cliente”:

```text
focus = Cliente
```

---

# 20. Foco inválido

Si otro participante elimina el elemento:

```text
focus.elementId no existe
→ invalidar
```

CU12 debe informar, no trasladar la referencia arbitrariamente.

---

# 21. Recomendaciones

CU12 puede decir:

> Recomiendo...

cuando existe sustento.

Debe clasificar:

- INFORMATIVO;
- OBLIGATORIO;
- RECOMENDADO;
- OPCIONAL.

Regla:

**OBLIGATORIO** solo si existe un problema real según reglas soportadas.

---

# 22. Propuesta estructurada

Para preparar Fase 6, una respuesta de CU12 puede incluir metadatos:

```json
{
  "answer": "...",
  "proposedAction": {
    "id": "proposal-uuid",
    "type": "CREATE_RELATION",
    "targetIds": ["cliente", "venta"],
    "reason": "...",
    "basedOnModelRevision": 21
  }
}
```

La UI no necesita mostrar JSON.

Esto permite que:

> Hazlo.

no requiera volver a extraer la acción desde prosa.

CU12 todavía **no la ejecuta**.

---

# 23. Dos paneles

## Panel superior — Asistente IA
CU04 directo.

## Panel inferior — Asistente colaborativo
CU12.

En Fase 5 el panel inferior debe ser conversación real.

Sugerencia visual:

```text
Asistente colaborativo
──────────────────────
Renato: ...
IA: ...
Carlos: ...
IA: ...

[Escribe un mensaje...]
[Enviar]
```

El panel superior sigue disponible.

---

# 24. Texto de ayuda

Eliminar:

> El asistente no modifica el modelo ni ejecuta acciones.

porque en Fase 6 el usuario podrá decir “hazlo” dentro de esa misma conversación.

Sustituir conceptualmente por:

> El asistente puede explicar, revisar y proponer cambios. Las modificaciones solicitadas se aplican mediante el modelado asistido de NexoCASE.

---

# 25. Broadcast

Cada mensaje nuevo debe llegar a participantes conectados.

No depender de polling como única experiencia si ya se dispone de infraestructura WebSocket.

La persistencia sigue en MongoDB.

---

# 26. Manejo de concurrencia conversacional

Dos usuarios pueden preguntar al mismo tiempo.

Cada request debe conservar:

```text
requestId
participantId
projectId
```

Una respuesta no puede aparecer dirigida al participante equivocado.

Orden visual:

- usar `createdAt`;
- desempatar con ID/orden servidor cuando sea necesario.

---

# 27. Degradación Groq

Si Groq falla:

- persistir el mensaje humano si corresponde;
- marcar respuesta fallida/controlada;
- no perder conversación;
- mantener ayuda determinista de producto donde ya exista;
- no bloquear modelado manual/XMI/validación/generación.

---

# 28. Tooling de lectura

Herramientas controladas sugeridas:

```text
getCurrentModel()
getElement(elementId)
getValidation()
getSpringReadiness()
getProjectActivity(filters)
getParticipantActivity(participantId)
getProductCapability(topic)
```

Groq solicita; backend ejecuta.

Nunca:

```text
Groq → MongoDB directo
```

---

# 29. Seguridad de prompt

No incluir:

- API keys;
- credenciales;
- accessCode;
- accessToken;
- URI MongoDB;
- rutas internas innecesarias.

El prompt recibe solo contexto funcional.

---

# 30. Tests unitarios

- context builder;
- foco;
- prioridad de verdad;
- selección de mensajes;
- respuesta sin autoría inventada;
- nombres duplicados;
- elemento eliminado;
- contexto producto actualizado.

---

# 31. Tests integración

- guardar mensaje humano;
- llamar proveedor;
- guardar IA;
- listar historial;
- broadcast;
- consulta eventos;
- Groq falla;
- proyecto equivocado rechazado.

---

# 32. Tests E2E

### E2E-5.1
Renato y Carlos ven la misma consulta/respuesta.

### E2E-5.2
IA sabe quién pregunta.

### E2E-5.3
Pregunta “¿quién creó Venta?” responde desde evento.

### E2E-5.4
Pregunta cómo usar XMI responde según flujo real.

### E2E-5.5
Cero usuarios → volver → conversación sigue.

### E2E-5.6
Dos proyectos no mezclan conversaciones.

---

# 33. Definition of Done

Fase 5 termina cuando:

- panel colaborativo existe;
- conversación es compartida;
- conversación persiste;
- CU12 conoce participante;
- CU12 conoce proyecto;
- CU12 conoce modelo;
- CU12 consulta actividad;
- ayuda NexoCASE sigue correcta;
- mentor UML funciona;
- recomendaciones no mutan directamente;
- propuesta estructurada puede producirse;
- contexto no cruza proyectos;
- Groq caído no rompe aplicación.

---

# 34. Handoff a Fase 6

Fase 6 recibe un CU12 capaz de:

```text
conversar
entender
revisar
recomendar
proponer estructuradamente
```

y un CU04 que ya sabe:

```text
ejecutar una instrucción UML clara
```

La siguiente fase únicamente debe construir el puente seguro entre ambos.

**FIN — FASE 5**
