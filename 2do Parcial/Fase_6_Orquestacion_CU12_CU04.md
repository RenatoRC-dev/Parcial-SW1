# NexoCASE — Segundo Parcial de SW1
## Fase 6 — Orquestación contextual CU12 ↔ CU04

**Estado:** Especificación del núcleo inteligente del segundo parcial  
**Prerequisitos:** Fases 1–5  
**Objetivo:** permitir una experiencia natural donde CU12 conversa y CU04 ejecuta, sin fusionar responsabilidades ni duplicar IA.  
**Siguiente fase:** Fase 7 — Integración completa y UX

---

# 1. Aclaración definitiva

**CU04 y CU12 NO se fusionan.**

Se integran.

```text
                     contexto compartido
                            │
                    Orquestador IA
                   /              \
                CU12              CU04
        entender/revisar       modificar
```

La UI mantiene dos paneles.

---

# 2. Propósito de cada panel

## Asistente IA — CU04

Para instrucciones directas:

```text
Crea Cliente.
Agrega total Double a Venta.
Elimina telefono de Cliente.
```

Texto o voz.

## Asistente colaborativo — CU12

Para:

```text
¿Qué opinas?
Revisa esto.
¿Qué hizo Carlos?
¿Por qué no genera?
¿Qué es composición?
```

y continuaciones:

```text
Hazlo.
Corrígelo.
Agrégalo.
Entonces cámbialo.
```

---

# 3. Una sola inteligencia contextual

No crear:

```text
memoriaCU04
memoriaCU12
```

como mundos aislados.

Ambos flujos comparten:

- proyecto;
- participante;
- modelo actual;
- revisión;
- actividad;
- contexto factual;
- trazabilidad.

El historial conversacional principal pertenece al proyecto.

---

# 4. Orquestador

Crear responsabilidad explícita:

```text
OrquestarInteraccionIA
```

Entrada conceptual:

```json
{
  "projectId": "...",
  "participantId": "derivado backend",
  "input": "Hazlo",
  "source": "collaborative_assistant",
  "selectedElementId": "..."
}
```

Salida conceptual:

```text
answer
clarification
execute_action
```

---

# 5. Clasificación de intención

Mínimo:

- PRODUCT_HELP
- UML_CONCEPT
- MODEL_QUERY
- PROJECT_HISTORY
- MODEL_REVIEW
- REQUEST_RECOMMENDATION
- DIRECT_MODEL_ACTION
- CONTEXTUAL_MODEL_ACTION
- CLARIFICATION_REQUIRED

No crear 50 intents.

---

# 6. Ruteo

```text
PRODUCT_HELP            → CU12
UML_CONCEPT             → CU12
MODEL_QUERY             → CU12
PROJECT_HISTORY         → CU12
MODEL_REVIEW            → CU12
REQUEST_RECOMMENDATION  → CU12
DIRECT_MODEL_ACTION     → CU04
CONTEXTUAL_MODEL_ACTION → resolver → CU04
CLARIFICATION_REQUIRED  → CU12 responde pregunta breve
```

---

# 7. Acción directa desde panel CU04

El panel superior puede continuar llamando al motor de modelado.

Pero ahora la operación debe incluir contexto de proyecto y participante para:

- autorización;
- trazabilidad;
- broadcast;
- mensajes/eventos.

Ejemplo:

```text
Renato → CU04: Crea Producto
```

Resultado visible:

- Producto aparece;
- actividad registra solicitadoPor Renato / mechanism ai_cu04;
- otros colaboradores lo observan.

Opcionalmente la conversación compartida puede mostrar una entrada compacta del comando y resultado. Debe existir al menos visibilidad/trazabilidad suficiente para cumplir la colaboración.

---

# 8. Acción desde conversación CU12

Ejemplo:

```text
Renato: ¿Qué opinas de Venta?
IA: Recomiendo agregar total: Double.
Renato: Hazlo.
```

No volver a enviar simplemente `"Hazlo"` al CU04.

Resolver primero:

```text
proposalId
target
operation
modelRevision
```

Luego CU04 recibe una instrucción concreta.

---

# 9. Propuesta pendiente

Guardar en el mensaje IA:

```json
{
  "proposedAction": {
    "id": "proposal-1",
    "kind": "ADD_ATTRIBUTE",
    "classId": "venta",
    "attribute": {
      "name": "total",
      "type": "Double"
    },
    "basedOnModelRevision": 22,
    "status": "pending"
  }
}
```

Cuando el usuario dice:

> Hazlo.

el orquestador busca una propuesta pendiente inequívoca de esa conversación/contexto.

---

# 10. Vida de una propuesta

Estados:

```text
pending
executed
rejected
stale
cancelled
```

No ejecutar dos veces el mismo `proposalId`.

---

# 11. Revalidación antes de ejecutar

Antes de CU04:

1. cargar modelo actual;
2. comparar revisión;
3. comprobar target;
4. comprobar que la acción sigue siendo aplicable;
5. ejecutar;
6. validar modelo resultante;
7. persistir/propagar;
8. marcar propuesta.

Si el modelo cambió pero la propuesta sigue siendo segura, puede recalcularse.

Si no:

> El modelo cambió desde la recomendación. Voy a revisarlo de nuevo antes de aplicar ese cambio.

---

# 12. “Corrígelo”

No equivale siempre a una propuesta anterior literal.

Resolver en orden:

1. propuesta pendiente explícita;
2. problema determinista recién discutido;
3. foco + diagnóstico inequívoco;
4. si quedan múltiples opciones → aclarar.

---

# 13. “Agrégale”

Resolver:

1. referente explícito en mensaje;
2. foco conversacional;
3. elemento seleccionado;
4. actividad recién mencionada;
5. aclarar.

No usar “última clase del modelo” como heurística silenciosa.

---

# 14. “Lo que hizo Carlos”

Resolver desde `events`.

Ejemplo:

```text
Carlos creó Venta y Producto.
Renato: Revisa lo que hizo Carlos.
```

Es ambiguo.

Responder:

> Carlos creó Venta y Producto. ¿Quieres que revise ambos o uno de ellos?

---

# 15. Autorización humana suficiente

La persona no necesita dictar cada comando técnico.

Esto es válido:

> Revisa Venta y corrige el error de multiplicidad que encuentres.

Porque:

- existe solicitud humana;
- alcance está delimitado;
- el sistema puede revisar;
- si hay una única corrección soportada, ejecutar.

Esto NO autoriza:

> rediseñar todo el dominio;
> inventar requisitos;
> tocar elementos no relacionados.

---

# 16. Solicitud amplia

Ejemplo:

> Corrige todos los errores de validación.

Tratamiento profesional:

1. CU08 obtiene errores reales;
2. clasificar cuáles poseen corrección determinista/inequívoca;
3. presentar o ejecutar solo dentro del alcance solicitado;
4. si una corrección requiere decisión de negocio, detener esa parte;
5. registrar cada cambio.

No convertirlo en agente autónomo ilimitado.

---

# 17. Decisiones de negocio

Ejemplo:

> Relaciona Venta con lo que creas correcto.

Si no existen requisitos:

- CU12 recomienda;
- marca hipótesis;
- solicita confirmación de cardinalidad/regla.

Si existe evidencia:

- puede construir propuesta específica.

---

# 18. Operaciones destructivas

Para:

```text
Bórralo.
Elimínalo.
Quita esa clase.
```

Requerir referente inequívoco.

Si existe una propuesta destructiva previa, debe indicar claramente el elemento en la respuesta antes o después de ejecutar.

No añadir confirmaciones modales obligatorias a toda operación si CU04 actual ya trabaja sin ellas; la seguridad principal es semántica/contextual.

---

# 19. Contrato estructurado

El orquestador debe trabajar con objetos, no con parsing frágil de texto libre después de Groq.

Ejemplo:

```json
{
  "intent": "CONTEXTUAL_MODEL_ACTION",
  "target": {
    "type": "class",
    "id": "venta"
  },
  "action": {
    "type": "ADD_ATTRIBUTE",
    "name": "total",
    "dataType": "Double"
  },
  "confidence": "high",
  "needsClarification": false
}
```

El backend valida contrato.

---

# 20. Reutilizar motor CU04

No crear:

```text
ejecutarDesdeChat()
ejecutarDesdeAsistenteIA()
```

con dos implementaciones semánticas.

Crear un único servicio de ejecución:

```text
ExecuteUMLAction / interpretarAplicarCU04
```

con adaptadores de entrada.

---

# 21. Reglas CU04 heredadas

CU04 sigue:

- aplicando cambios incrementales;
- validando;
- evitando acciones ambiguas;
- trabajando sobre modelo canónico;
- propagando vía integración existente.

La Fase 6 no debe debilitar esas protecciones.

---

# 22. Modelo existente con errores

Problema conocido:

una modificación útil puede ser rechazada si el modelo completo ya contiene otro error no relacionado.

La mejora recomendada:

```text
estado antes
estado después
```

Aceptar cuando:

- no introduce errores nuevos;
- corrige el objetivo solicitado;
- no empeora diagnósticos relevantes.

No implementar de forma improvisada sin tests.

---

# 23. Sincronización con Yjs/Apollon

Después de una acción CU04:

```text
modelo canónico actualizado
→ adaptación a editor
→ Yjs/Apollon
→ colaboradores
```

No modificar Apollon directamente saltándose el modelo canónico.

---

# 24. Persistencia

Después de una acción IA exitosa:

- actualizar estado en cliente;
- marcar trabajo sucio o guardar según política CU11;
- registrar evento;
- actualizar conversación;
- mantener `modelRevision` coherente cuando se persista.

No confundir propagación Yjs con guardado Mongo.

---

# 25. Conversación visible

Interacción desde CU12:

```text
Renato: Hazlo.
IA: Listo. Agregué total: Double a Venta.
```

Debe ser visible a Carlos.

La respuesta de éxito debe venir después de ejecución confirmada, no antes.

---

# 26. Acción directa visible

Cuando Renato usa panel CU04:

```text
"Crea Producto"
```

El equipo debe poder conocer la intervención.

Opciones aceptables:

- entrada compacta en conversación;
- evento visible en actividad;
- ambos.

La implementación elegida debe permitir demostrar al docente que las intervenciones con IA son colaborativas.

Preferencia: conversación compacta + evento.

---

# 27. Voz

La voz sigue siendo entrada de CU04.

```text
Hablar
→ transcripción
→ comando directo
→ CU04
```

La transcripción debe asociarse al participante real.

---

# 28. Idempotencia

Toda acción contextual puede llevar:

```text
requestId
proposalId
```

Si el cliente reintenta por timeout, el backend no debe duplicar la modificación si ya fue confirmada como ejecutada.

---

# 29. Fallo parcial

Caso:

- CU04 modifica;
- persistir mensaje IA falla.

No responder “no se hizo” si sí se hizo.

Diseñar resultado por etapas y recuperación.

Prioridad:

1. consistencia del modelo;
2. trazabilidad;
3. conversación.

Registrar errores observables.

---

# 30. Groq no disponible

Panel CU04:
- puede fallar de forma controlada.

Panel CU12:
- ayuda determinista existente puede seguir;
- consultas complejas informan indisponibilidad.

No intentar ejecutar una propuesta si la interpretación necesaria no pudo producirse.

---

# 31. Tests unitarios

- intent router;
- propuesta pendiente;
- proposal executed once;
- stale proposal;
- pronombres;
- foco;
- ambiguos;
- destructivos;
- decisión de negocio sin evidencia;
- requestId idempotente.

---

# 32. Tests integración

- CU12 crea propuesta;
- “hazlo” → CU04;
- evento conserva requestedBy;
- mensaje IA confirma solo tras éxito;
- propuesta stale;
- concurrent model change;
- dos usuarios con propuestas distintas.

---

# 33. Tests E2E estrella

### Escenario A

```text
Carlos crea Venta.
Renato: ¿Quién creó Venta?
IA: Carlos...
Renato: Revísala.
IA: ...
Renato: Hazlo.
→ CU04 aplica.
Carlos observa.
```

### Escenario B

```text
Renato panel CU04:
Crea Producto.
→ Carlos ve Producto.
→ actividad atribuye a Renato mediante IA.
```

### Escenario C

```text
Renato: Revisa la clase que creó Carlos.
Carlos creó dos clases.
→ IA aclara.
→ no muta.
```

---

# 34. Definition of Done

Fase 6 termina cuando:

- dos paneles siguen existiendo;
- comparten contexto;
- CU12 no muta directamente;
- CU04 es único ejecutor IA;
- “hazlo” funciona;
- “corrígelo” funciona cuando es inequívoco;
- ambigüedad pregunta;
- propuestas stale no se ejecutan ciegamente;
- acciones directas quedan colaborativamente visibles/trazables;
- voz conserva autoría;
- todos observan cambios;
- no se inventa negocio.

---

# 35. Handoff a Fase 7

A partir de aquí la lógica central está completa.

Fase 7 no debe rediseñar IA.

Debe:

- integrar visualmente;
- simplificar flujo;
- mejorar estados;
- hacer que el producto se sienta coherente.

**FIN — FASE 6**
