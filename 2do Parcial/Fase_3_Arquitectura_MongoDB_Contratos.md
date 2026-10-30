# NexoCASE — Segundo Parcial de SW1
## Fase 3 — Arquitectura objetivo, MongoDB y contratos técnicos

**Estado:** Especificación técnica previa a implementación  
**Prerequisitos:** Fase 1 y Fase 2 aprobadas  
**Actor funcional único:** Diseñador de software  
**Objetivo:** convertir el comportamiento funcional aprobado en una arquitectura implementable, simple, segura dentro del alcance y compatible con el NexoCASE existente.  
**Siguiente fase:** Fase 4 — Persistencia MongoDB, acceso, identidad y trazabilidad

---

# 1. Propósito

La Fase 3 define **cómo se construirá técnicamente** el segundo parcial sin comenzar todavía una refactorización indiscriminada.

Debe eliminar las ambigüedades que podrían causar que dos integrantes o dos agentes implementen soluciones incompatibles.

Esta fase responde:

- ¿qué componentes existentes se conservan?
- ¿qué nuevos componentes se incorporan?
- ¿qué información será durable?
- ¿qué permanece efímero?
- ¿cómo se modelará MongoDB?
- ¿cómo se identifica un participante sin login?
- ¿cómo se valida el acceso mediante código?
- ¿cómo se protege HTTP y WebSocket?
- ¿cómo se relacionan conversación, actividad y modelo UML?
- ¿cómo recupera la IA su contexto?
- ¿cómo se evita duplicar la semántica UML?
- ¿qué contratos deben existir entre frontend, backend, MongoDB y Groq?

---

# 2. Invariantes heredados

No se reinterpretan en esta fase:

1. NexoCASE se evoluciona; no se reescribe.
2. Se mantienen los 12 CU.
3. Actor funcional único: **Diseñador de software**.
4. CU01, CU03, CU04, CU11 y CU12 evolucionan.
5. React, Node.js + TypeScript + Express, Apollon, Yjs, modelo canónico, XMI, validación y generación Spring se conservan.
6. MongoDB será la persistencia propia de NexoCASE.
7. Groq será el proveedor IA.
8. No habrá login, correo, contraseña ni OAuth.
9. Cada proyecto tendrá un código de acceso.
10. Un dispositivo autorizado podrá reabrir un proyecto sin volver a escribir el código mientras conserve una credencial válida.
11. La conversación con IA será compartida.
12. La IA no inicia trabajo por cuenta propia.
13. CU12 conversa/enseña/revisa/recomienda.
14. CU04 ejecuta cambios UML solicitados.
15. El modelo UML canónico sigue siendo la autoridad semántica.
16. MongoDB no sustituye PostgreSQL del backend Spring generado.
17. La ausencia de participantes conectados no destruye el proyecto.

---

# 3. Estado actual que debe preservarse

La auditoría del primer parcial muestra una arquitectura ya útil:

```text
React
  ↓
Apollon
  ↓
Adaptador Apollon
  ↓
Modelo UML canónico
  ├── CU04 IA de modelado
  ├── CU05 imagen
  ├── CU06/CU07 XMI
  ├── CU08 validación
  ├── CU09/CU10 generación Spring
  └── CU11 persistencia
```

Actualmente:

- la persistencia principal de proyectos usa archivos JSON;
- existe un repositorio de proyectos abstraído;
- se listan proyectos globalmente;
- el acceso se hace esencialmente por ID;
- la colaboración usa Apollon/Yjs + WebSocket;
- la sala se deriva del proyecto;
- el nombre colaborativo actual es insuficiente;
- CU12 posee contexto de producto/modelo y Groq, pero es individual y de solo lectura;
- CU04 ya ejecuta instrucciones UML claras.

**Regla:** la nueva arquitectura debe envolver y extender estas piezas antes que reemplazarlas.

---

# 4. Arquitectura objetivo

```text
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND REACT                      │
│                                                             │
│  Inicio           Espacio UML            IA                 │
│  ├ Crear          ├ Apollon              ├ Acción directa   │
│  ├ Unirse         ├ Inspector            │   CU04            │
│  └ Recientes      ├ Participantes        └ Colaborativo     │
│                   └ Conversación             CU12            │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP / WebSocket
┌─────────────────────────────▼───────────────────────────────┐
│                    BACKEND NEXOCASE                         │
│                                                             │
│  Acceso proyecto     Contexto IA       Dominio actual       │
│  ├ código            ├ participante    ├ modelo canónico    │
│  ├ credencial        ├ mensajes        ├ validación         │
│  └ aislamiento       ├ actividad       ├ XMI                │
│                      └ producto         └ generación         │
│                                                             │
│  CU01 / CU03 / CU11     CU12 ← Orquestador → CU04           │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
         ┌──────▼──────┐          ┌─────▼─────┐
         │  MongoDB    │          │   Groq    │
         │ persistencia│          │ lenguaje /│
         │ durable     │          │ razonamiento
         └─────────────┘          └───────────┘
```

---

# 5. Decisión de persistencia

## 5.1. Desarrollo local

Para desarrollo se admite:

- MongoDB Community local o contenedor Docker;
- MongoDB Compass para inspección visual.

## 5.2. Despliegue

Para producción/demostración se recomienda MongoDB Atlas o un MongoDB administrado equivalente.

No se debe acoplar la lógica de negocio a Atlas. La aplicación solo debe depender de una URI MongoDB.

Variables previstas:

```env
MONGODB_URI=
MONGODB_DB_NAME=nexocase
PROJECT_ACCESS_PEPPER=
```

`PROJECT_ACCESS_PEPPER` será un secreto del backend utilizado para proteger credenciales/códigos cuando la implementación lo requiera. No debe subirse al repositorio.

---

# 6. Estrategia de modelado MongoDB

No se copiará un diseño relacional tabla-por-tabla.

Se proponen **cuatro colecciones principales**.

## 6.1. `projects`

Representa el estado durable principal del proyecto.

Ejemplo conceptual:

```json
{
  "_id": "uuid-del-proyecto",
  "name": "Sistema de ventas",
  "accessCodeHash": "...",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE",
  "modelRevision": 17,
  "model": {
    "id": "modelo-...",
    "name": "Sistema de ventas",
    "version": "..."
  },
  "status": "active"
}
```

### Contiene

- metadatos del proyecto;
- hash/verificador del código;
- modelo UML canónico vigente;
- revisión técnica del modelo;
- timestamps.

### No contiene

- historial completo de mensajes;
- historial completo de eventos;
- presencia online;
- secretos en texto plano.

## 6.2. `participants`

Representa identidades colaborativas ligeras por proyecto.

```json
{
  "_id": "participant-uuid",
  "projectId": "project-uuid",
  "displayName": "Renato",
  "credentialHash": "...",
  "createdAt": "ISO_DATE",
  "lastSeenAt": "ISO_DATE",
  "context": {
    "focusElementId": "venta-123",
    "focusType": "class"
  }
}
```

La credencial real se entrega al navegador una sola vez y se conserva localmente; MongoDB guarda un verificador/hash, no la credencial reutilizable en texto plano.

## 6.3. `messages`

Conserva la conversación compartida.

```json
{
  "_id": "message-uuid",
  "projectId": "project-uuid",
  "senderType": "human",
  "participantId": "participant-uuid",
  "displayNameSnapshot": "Renato",
  "content": "¿Qué opinas de Venta?",
  "createdAt": "ISO_DATE",
  "relatedElementIds": ["venta-123"]
}
```

Para IA:

```json
{
  "_id": "message-uuid",
  "projectId": "project-uuid",
  "senderType": "ai",
  "respondingToParticipantId": "participant-uuid",
  "content": "...",
  "createdAt": "ISO_DATE",
  "proposedAction": null
}
```

## 6.4. `events`

Registra trazabilidad semántica.

```json
{
  "_id": "event-uuid",
  "projectId": "project-uuid",
  "type": "ATTRIBUTE_ADDED",
  "requestedByParticipantId": "participant-uuid",
  "mechanism": "manual",
  "element": {
    "id": "venta-123",
    "type": "class",
    "name": "Venta"
  },
  "detail": {
    "attributeId": "total-1",
    "attributeName": "total"
  },
  "modelRevision": 18,
  "createdAt": "ISO_DATE"
}
```

Cuando interviene IA:

```json
{
  "type": "CLASS_CREATED",
  "requestedByParticipantId": "participant-renato",
  "mechanism": "ai_cu04",
  "element": {
    "id": "producto-1",
    "type": "class",
    "name": "Producto"
  }
}
```

La trazabilidad conserva **quién pidió** la modificación y **mediante qué mecanismo se ejecutó**.

---

# 7. Índices mínimos

Se proponen:

```text
projects:
- unique(_id)
- unique(accessCodeHash) o equivalente seguro

participants:
- unique(_id)
- index(projectId)
- index(projectId, lastSeenAt)

messages:
- index(projectId, createdAt)
- index(projectId, _id)

events:
- index(projectId, createdAt)
- index(projectId, type)
- index(projectId, "element.id")
- index(projectId, requestedByParticipantId)
```

No crear índices “por si acaso”. Solo los necesarios para:

- abrir proyecto;
- validar acceso;
- paginar conversación;
- consultar actividad;
- responder quién hizo qué.

---

# 8. Código de proyecto

## 8.1. Reglas

El código:

- lo genera el backend;
- es corto y legible;
- evita caracteres visualmente ambiguos cuando sea práctico;
- no coincide con `projectId`;
- no es secuencial;
- no se expone en listados globales;
- se valida únicamente en backend.

Ejemplo de UX:

```text
NX7K-P4QM
```

El formato exacto puede cambiar sin modificar el CU.

## 8.2. Almacenamiento

Preferencia técnica:

- no almacenar la credencial reutilizable del navegador en texto plano;
- proteger el código con un verificador/hash apropiado;
- comparar en backend.

No se necesita construir una plataforma criptográfica compleja. La seguridad declarada sigue siendo **acceso básico por secreto compartido**, no autenticación fuerte.

---

# 9. Credencial local de acceso

El código se usa para **obtener acceso**.

Después de un acceso correcto, el backend genera una credencial opaca aleatoria asociada a:

```text
projectId + participantId
```

El navegador conserva conceptualmente:

```json
{
  "projectId": "...",
  "participantId": "...",
  "displayName": "Renato",
  "accessToken": "opaque-random-secret"
}
```

El frontend podrá construir **Proyectos recientes** a partir de estas referencias locales.

## Regla

El frontend no debe asumir que una credencial almacenada sigue siendo válida. Al abrir un proyecto:

1. envía credencial;
2. backend valida;
3. si es válida, abre;
4. si es inválida, solicita nuevamente código.

---

# 10. Autorización HTTP

Las operaciones project-scoped deben exigir una credencial de proyecto válida.

Ejemplo conceptual:

```http
Authorization: Bearer <project-access-token>
```

La credencial identifica:

- proyecto autorizado;
- participante originador.

No representa una sesión de usuario global.

---

# 11. Autorización WebSocket

El WebSocket no debe ingresar directamente a una sala solo porque conoce `proyectoId`.

Propuesta simple:

1. cliente abre `/api/colaboracion`;
2. antes de unirse a cualquier sala envía un frame de autenticación;
3. frame contiene `projectId` y credencial;
4. backend valida;
5. backend asocia conexión a `participantId`;
6. recién entonces admite frames colaborativos;
7. si falla, cierra la conexión.

Ejemplo conceptual:

```json
{
  "type": "authenticate",
  "projectId": "...",
  "accessToken": "..."
}
```

La credencial no debe derivarse del texto del nombre visible.

---

# 12. Canales de tiempo real

No se debe romper el protocolo que Apollon/Yjs ya utiliza sin necesidad.

Arquitectura recomendada:

### Canal UML
Responsable del transporte colaborativo actual de Apollon/Yjs.

### Canal de aplicación
Responsable de eventos de aplicación:

- nuevo mensaje;
- respuesta IA;
- presencia cuando sea necesario;
- notificación de actividad relevante;
- estado de IA.

Pueden compartir infraestructura WebSocket, pero deben mantener **protocolos lógicos diferenciados** para no enviar mensajes de chat al receptor de Yjs.

No es obligatorio crear microservicios ni servidores separados.

---

# 13. Persistencia del modelo — CU11

El modelo canónico continuará guardándose como snapshot actual del proyecto.

El primer objetivo es garantizar:

```text
guardar → cerrar → cero usuarios → reiniciar backend → abrir → mismo modelo
```

## Decisión de alcance

El botón Guardar explícito se conserva.

No se exige en esta fase convertir el sistema a un motor de versionado.

### Autosave

Puede incorporarse más adelante como mejora de confiabilidad, pero **no debe introducirse sin resolver concurrencia y revisión del modelo**.

Para el parcial es preferible un guardado explícito correcto y probado antes que un autosave defectuoso que sobrescriba cambios concurrentes.

---

# 14. Revisión técnica del modelo

`modelRevision` será un entero monotónico de persistencia.

Objetivos:

- detectar respuestas IA basadas en un modelo demasiado antiguo;
- asociar eventos a un estado aproximado;
- evitar ejecutar propuestas sobre precondiciones obsoletas.

No se pretende implementar Git.

---

# 15. Contratos HTTP objetivo

Las rutas concretas pueden adaptarse al estilo existente, pero el comportamiento deberá existir.

## 15.1. Crear proyecto

```http
POST /api/proyectos
```

Request:

```json
{
  "nombre": "Proyecto A",
  "nombreParticipante": "Renato"
}
```

Response:

```json
{
  "proyecto": { "...": "..." },
  "participante": {
    "id": "...",
    "nombreVisible": "Renato"
  },
  "codigoAcceso": "NX7K-P4QM",
  "credencial": "opaque-secret"
}
```

El código completo se devuelve al crear porque debe poder compartirse.

## 15.2. Unirse

```http
POST /api/proyectos/unirse
```

```json
{
  "codigoAcceso": "NX7K-P4QM",
  "nombreParticipante": "Carlos"
}
```

Devuelve proyecto + participante + credencial.

## 15.3. Abrir proyecto conocido

```http
GET /api/proyectos/:id
Authorization: Bearer ...
```

## 15.4. Guardar modelo

```http
PUT /api/proyectos/:id/modelo
Authorization: Bearer ...
```

Body:

```json
{
  "modelo": { "...": "modelo canónico" },
  "revisionBase": 17
}
```

El diseño final podrá flexibilizar `revisionBase`, pero no debe aceptar silenciosamente estados obviamente ajenos/obsoletos.

## 15.5. Mensajes

```http
GET /api/proyectos/:id/mensajes?cursor=...
POST /api/proyectos/:id/mensajes
```

## 15.6. Actividad

```http
GET /api/proyectos/:id/actividad?...
```

## 15.7. IA

La forma final se completa en Fases 5–6.

Objetivo:

```http
POST /api/proyectos/:id/ia/interactuar
```

Debe recibir la credencial por el mecanismo normal y **no confiar en un `participantId` libre enviado por el cliente**.

---

# 16. Paginación

Conversaciones y actividad deberán paginarse.

Preferencia:

- cursor por `_id`/fecha;
- tamaño limitado;
- orden cronológico controlado.

Evitar devolver todo el historial en una sola respuesta.

---

# 17. Construcción de contexto IA

El backend será responsable de construir una vista contextual.

```text
IAContext
├ participante actual
├ proyecto
├ modelo actual
├ modelRevision
├ elemento seleccionado
├ foco conversacional
├ mensajes recientes relevantes
├ actividad relevante
├ validación
├ aptitud Spring
└ contexto factual NexoCASE
```

## Principio

**MongoDB almacena; el backend selecciona; Groq interpreta.**

Groq no consulta directamente la base.

---

# 18. Contexto factual de NexoCASE

El actual contexto de producto deberá evolucionar para reflejar el segundo parcial:

- Crear proyecto;
- Unirse con código;
- Proyectos recientes;
- colaboración;
- CU04;
- CU05;
- CU06/CU07;
- CU08;
- CU09/CU10;
- CU11;
- CU12 colaborativo;
- límites reales.

No se debe permitir que el prompt conserve instrucciones obsoletas como “Mis proyectos” si la interfaz final ya utiliza “Proyectos recientes”.

---

# 19. Separación CU12 / CU04

Arquitectura fija:

```text
             Orquestador
             /          \
          CU12          CU04
  conversar/revisar     ejecutar
```

CU12 no muta directamente el modelo.

Cuando desde una conversación se diga:

> Hazlo.

el orquestador resuelve una acción concreta y llama al mismo motor funcional de CU04.

El usuario percibe una conversación continua; internamente se conservan responsabilidades testables.

---

# 20. Dos paneles, una sola inteligencia contextual

La UI conservará:

### Panel 1 — Asistente IA
Acción directa por texto/voz.

### Panel 2 — Asistente colaborativo
Conversación, enseñanza, revisión y recomendaciones.

No serán dos “mentes” independientes.

Deben compartir:

- projectId;
- identidad;
- contexto;
- modelo;
- trazabilidad;
- actividad;
- fuente factual del producto.

Una acción directa de CU04 también debe quedar trazable y visible para el equipo de forma razonable.

---

# 21. Manejo de errores

Se requiere contrato consistente para:

- código inválido;
- credencial inválida;
- proyecto inexistente;
- participante inexistente;
- MongoDB no disponible;
- conflicto de revisión;
- Groq no disponible;
- respuesta Groq inválida;
- modelo inválido;
- WebSocket no autorizado;
- mensaje demasiado grande;
- rate limit.

No devolver:

- rutas internas;
- stack traces;
- URI MongoDB;
- secretos;
- API keys.

---

# 22. Rate limiting mínimo

Debe considerarse en:

- intentos de unirse mediante código;
- llamadas IA;
- creación excesiva de proyectos.

No se necesita infraestructura empresarial.

La política exacta se decide al implementar, pero debe poder probarse.

---

# 23. Migración desde JSON

Se conservará la interfaz de repositorio donde sea posible.

Estrategia:

1. implementar repositorio Mongo;
2. probar contrato;
3. agregar script de migración opcional para proyectos existentes;
4. verificar conteos/modelos;
5. cambiar composición del servidor;
6. mantener archivos únicamente como respaldo temporal de desarrollo si es necesario;
7. no mantener dos fuentes de verdad permanentes.

La migración debe ser idempotente o claramente controlada para no duplicar proyectos.

---

# 24. Responsabilidades por capa

## Negocio
- reglas de acceso;
- identidad colaborativa;
- control humano de IA;
- trazabilidad;
- aislamiento.

## Frontend
- UX;
- almacenamiento local de referencias/credenciales;
- envío de credencial;
- representación de presencia/conversación;
- no autoriza por sí mismo.

## Backend
- autoridad de acceso;
- repositorios;
- contexto IA;
- orquestación;
- validación;
- eventos;
- aislamiento.

## MongoDB
- durabilidad;
- consultas por proyecto;
- índices.

## Groq
- comprensión/razonamiento bajo contexto.

## Modelo canónico
- verdad UML.

## Yjs/Apollon
- colaboración visual en tiempo real.

---

# 25. Riesgos arquitectónicos

### R-03-01 — Duplicar el modelo UML
No crear una representación “para IA” distinta del modelo canónico.

### R-03-02 — Token expuesto
No mostrar credenciales en UI, logs o mensajes.

### R-03-03 — Proyecto accesible por UUID
Toda ruta project-scoped debe autorizar.

### R-03-04 — Mezclar chat y frames Yjs
Diferenciar canales/protocolos.

### R-03-05 — Historial infinito en prompt
Persistir todo; enviar solo contexto pertinente.

### R-03-06 — Colecciones innecesarias
No crear una colección por cada DTO.

### R-03-07 — Persistencia dual
Tras migración, MongoDB debe ser la fuente durable principal.

### R-03-08 — Sobreingeniería de autenticación
No introducir cuentas para resolver un requisito que solo exige código + identidad ligera.

---

# 26. Criterios de aceptación de arquitectura

**Given** las Fases 1–2,  
**When** se revise esta arquitectura,  
**Then** toda capacidad funcional deberá tener una responsabilidad técnica identificada.

**Given** un proyecto,  
**When** no haya participantes conectados,  
**Then** su existencia no dependerá de memoria de proceso ni de un cliente host.

**Given** una ruta de proyecto,  
**When** no existe credencial válida,  
**Then** el backend deberá poder rechazarla.

**Given** una consulta IA,  
**When** el backend la procesa,  
**Then** Groq recibirá identidad/contexto suministrado por NexoCASE y no decidirá identidad desde texto libre.

**Given** CU04 y CU12,  
**When** se implemente la UI,  
**Then** podrán conservarse dos paneles sin crear dos contextos incompatibles.

---

# 27. Entregables de la Fase 3

Antes de pasar a Fase 4 deben quedar aceptados:

- arquitectura objetivo;
- colecciones;
- documentos principales;
- índices;
- estrategia de código;
- estrategia de credencial local;
- autorización HTTP;
- autorización WebSocket;
- separación canal UML/canal aplicación;
- contratos principales;
- estrategia de migración;
- responsabilidad de contexto IA;
- invariantes CU12/CU04.

---

# 28. Orden de implementación recomendado

```text
1. conexión MongoDB
2. repositorio Mongo
3. tests de repositorio
4. migración de proyecto
5. código de acceso
6. participante + credencial
7. autorización HTTP
8. CU01 frontend
9. WebSocket autorizado
10. eventos
11. conversación persistida
12. contexto IA
13. CU12 colaborativo
14. orquestador CU12/CU04
```

No empezar por el chat visual.

---

# 29. Handoff obligatorio a Fase 4

El agente que implemente Fase 4 debe leer Fases 1, 2 y 3.

No debe:

- cambiar MongoDB por una BD relacional;
- agregar login;
- crear CU nuevos;
- fusionar CU04/CU12;
- eliminar los dos paneles por conveniencia;
- guardar credenciales reutilizables en logs;
- dejar `/api/proyectos` como catálogo público global;
- aceptar WebSocket por `projectId` sin validación;
- convertir actividad en un log de cada frame Yjs.

---

# 30. Resultado esperado

Al terminar Fase 3, el equipo debe saber **exactamente qué construir**, aunque todavía no esté implementado.

La filosofía técnica queda:

> **MongoDB conserva la continuidad; Yjs sincroniza el trabajo activo; NexoCASE conserva la verdad y las reglas; Groq interpreta; CU04 ejecuta; CU12 colabora.**

**FIN — FASE 3**
