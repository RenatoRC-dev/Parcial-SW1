# NexoCASE — Segundo Parcial de SW1
## Fase 4 — Persistencia MongoDB, acceso, identidad y trazabilidad

**Estado:** Plan de implementación de infraestructura funcional  
**Prerequisitos:** Fases 1–3 aprobadas  
**Objetivo:** construir la base durable y segura mínima sobre la que funcionarán colaboración e IA contextual.  
**Siguiente fase:** Fase 5 — Evolución de CU12 a Asistente Colaborativo

---

# 1. Propósito

Esta fase implementa primero aquello que la IA necesitará como **fuente de verdad**.

No se debe empezar por mejorar prompts.

Antes de que Groq pueda responder:

> “Carlos creó Venta”

NexoCASE debe poder demostrar:

- quién es Carlos dentro del proyecto;
- cuál es el proyecto;
- qué evento ocurrió;
- qué elemento fue afectado;
- que el dato persiste después de cerrar la aplicación.

---

# 2. Alcance

Implementar:

1. conexión MongoDB;
2. repositorio durable de proyectos;
3. CU01 Crear o acceder a proyecto;
4. código de acceso;
5. identidad ligera;
6. credencial local;
7. Proyectos recientes;
8. autorización de API;
9. autorización WebSocket;
10. aislamiento;
11. persistencia del modelo CU11;
12. registro de eventos relevantes;
13. persistencia inicial de mensajes;
14. continuidad con cero usuarios conectados.

No implementar todavía el orquestador conversacional completo de Fase 6.

---

# 3. Rama de trabajo recomendada

```text
feat/second-partial-mongodb-collaboration-base
```

Trabajar incrementalmente.

No mezclar refactors estéticos no relacionados.

---

# 4. Preparación MongoDB

## 4.1. Dependencia

Preferencia: driver oficial `mongodb` antes que introducir un ODM si el dominio actual no lo necesita.

Motivo:

- menos magia;
- contratos explícitos;
- mejor control de documentos;
- menor refactor.

Un ODM solo se justifica si el equipo demuestra valor concreto.

## 4.2. Variables

```env
MONGODB_URI=
MONGODB_DB_NAME=nexocase
PROJECT_ACCESS_PEPPER=
```

Actualizar `.env.example`.

Nunca commitear valores reales.

## 4.3. Módulo de conexión

Crear una única responsabilidad de infraestructura:

```text
MongoConnection
- connect()
- db()
- close()
```

No crear conexiones nuevas por request.

---

# 5. Repositorios

Mantener interfaces de dominio donde sea posible.

Objetivo conceptual:

```text
RepositorioProyectos
   ↑
   ├ RepositorioProyectosArchivos  [legado]
   └ RepositorioProyectosMongo     [objetivo]
```

Después del cambio de composición, el servidor normal utiliza MongoDB.

El repositorio de archivos puede permanecer temporalmente para migración/tests antiguos, pero no como fuente principal en producción.

---

# 6. Migración de proyecto

## 6.1. Script

Crear script explícito:

```text
scripts/migrarProyectosJsonAMongo.ts
```

Responsabilidades:

- localizar JSON existentes;
- validar con contratos actuales;
- crear documento Mongo;
- preservar IDs;
- preservar modelo;
- generar código si el proyecto legado no tiene;
- no duplicar si ya existe;
- imprimir resumen final.

## 6.2. Evidencia

Registrar:

```text
leídos
migrados
omitidos
fallidos
```

No borrar automáticamente archivos de origen.

---

# 7. CU01 — Crear o acceder a proyecto

## 7.1. Pantalla inicial objetivo

Eliminar concepto de catálogo global.

Mostrar:

```text
Crear proyecto
Unirse con código
Proyectos recientes
```

## 7.2. Crear

Datos:

- nombre proyecto;
- nombre visible.

Backend:

1. valida nombre;
2. genera projectId;
3. genera código;
4. protege/verifica código;
5. crea proyecto;
6. crea participante;
7. genera credencial opaca;
8. persiste verificador de credencial;
9. devuelve proyecto + código + participante + credencial.

## 7.3. Unirse

1. normalizar código;
2. buscar proyecto;
3. validar;
4. validar nombre visible;
5. crear participante para ese acceso;
6. generar credencial;
7. devolver proyecto.

## 7.4. No listado global

El endpoint antiguo que lista todos los proyectos no debe continuar accesible al usuario final sin justificación.

Puede:

- retirarse;
- quedar restringido a tests/desarrollo;
- reemplazarse por consultas de proyectos conocidos mediante credenciales locales.

Preferencia: no exponer catálogo global.

---

# 8. Proyectos recientes

El frontend guarda únicamente referencias necesarias.

Ejemplo local:

```json
[
  {
    "projectId": "...",
    "projectName": "Ventas",
    "participantId": "...",
    "displayName": "Renato",
    "accessToken": "..."
  }
]
```

## Reglas

- localStorage puede utilizarse por simplicidad del parcial;
- no afirmar que es una cuenta;
- si el token falla, retirar/marcar la referencia;
- no mostrar proyectos que el dispositivo nunca abrió;
- eliminar almacenamiento local no elimina el proyecto remoto.

---

# 9. Identidad colaborativa

Eliminar dependencia funcional de:

```text
nombre = "Diseñador"
```

La identidad enviada a Apollon/Yjs debe derivarse del participante validado:

```text
id = participantId
name = displayName
color = derivado estable
```

El nombre no debe ser la clave primaria.

---

# 10. Autorización API

Crear middleware project-scoped.

Concepto:

```text
requireProjectAccess
```

Debe:

1. leer credencial;
2. identificar participante;
3. comprobar asociación con proyecto;
4. adjuntar contexto autenticado-ligero al request;
5. rechazar si no coincide.

Contexto backend:

```ts
{
  projectId,
  participantId,
  displayName
}
```

Las rutas no deben aceptar un participante libre como fuente de autoridad.

---

# 11. WebSocket autorizado

Modificar el flujo existente.

Antes:

```text
connect?sala=proyecto-ID
→ entra
```

Objetivo:

```text
connect
→ authenticate(projectId, token)
→ backend valida
→ join project room
→ set participant awareness
```

## Regla

Frames de modelado recibidos antes de autorización:

```text
rechazar / cerrar
```

---

# 12. Aislamiento

Crear pruebas específicas:

```text
token A + project A = OK
token A + project B = 403
token B + project B = OK
WebSocket A intenta sala B = rechazado
mensajes A no aparecen B
eventos A no aparecen B
```

Este es un criterio crítico del parcial.

---

# 13. CU11 — Guardar y recuperar

Actualizar persistencia:

```text
PUT modelo
→ validar modelo canónico
→ validar credencial
→ guardar snapshot Mongo
→ incrementar revision
→ updatedAt
```

Abrir:

```text
GET proyecto
→ validar credencial
→ devolver modelo persistido + revision
```

No leer desde archivo JSON en operación normal.

---

# 14. Cero usuarios conectados

Prueba obligatoria:

1. abrir proyecto A;
2. editar;
3. guardar;
4. cerrar todos los navegadores;
5. reiniciar backend;
6. abrir desde proyecto reciente;
7. verificar mismo modelo.

También:

1. abrir desde otro dispositivo;
2. ingresar código;
3. verificar mismo modelo.

---

# 15. Eventos semánticos

Crear contrato:

```text
ProjectEvent
```

Campos mínimos:

- id;
- projectId;
- type;
- requestedByParticipantId;
- mechanism;
- element;
- detail;
- modelRevision;
- createdAt.

## Eventos mínimos primera versión

- PROJECT_CREATED
- PARTICIPANT_JOINED
- CLASS_CREATED
- CLASS_UPDATED
- CLASS_DELETED
- ATTRIBUTE_ADDED
- ATTRIBUTE_UPDATED
- ATTRIBUTE_DELETED
- RELATION_CREATED
- RELATION_UPDATED
- RELATION_DELETED
- XMI_IMPORTED
- IMAGE_CANDIDATE_APPLIED
- AI_MODEL_CHANGE_APPLIED
- MODEL_SAVED

No registrar:

- movimiento de cursor;
- cada Yjs update;
- render;
- heartbeat.

---

# 16. Detección de cambios para trazabilidad

No duplicar lógica dentro de cada botón si se puede comparar:

```text
modeloAnterior
vs
modeloNuevo
```

Crear servicio de dominio:

```text
calcularEventosModelo(anterior, nuevo, contextoActor)
```

Debe detectar eventos semánticos razonables.

Ventaja:

- cubre cambios manuales;
- cubre CU04;
- cubre otras entradas al modelo.

Pero operaciones especiales como XMI/imagen deben conservar además `mechanism`.

---

# 17. Autoría en colaboración concurrente

Limitación real:

Yjs puede sincronizar cambios de bajo nivel sin que el backend conozca automáticamente el actor semántico de cada transformación.

Por ello la implementación debe instrumentar las acciones desde el cliente/servicios donde se conoce el actor, o enviar eventos semánticos tras aplicar un cambio.

No afirmar trazabilidad perfecta si una ruta de cambio todavía no la produce.

La meta del parcial es trazabilidad funcional suficiente para los flujos demostrados.

---

# 18. Mensajes persistidos — base

Aunque CU12 completo llegue en Fase 5, preparar `messages`.

Implementar:

- insertar mensaje;
- listar por proyecto;
- paginar;
- aislar;
- ordenar.

No hace falta todavía que Groq consuma toda esta historia.

---

# 19. Endpoints de actividad

Permitir consultas backend:

```text
buscar eventos por:
- elemento
- participante
- tipo
- rango reciente
```

No exponer consultas arbitrarias de Mongo al frontend.

---

# 20. Rate limiting

Mínimo:

### Join por código
Controlar intentos fallidos por IP/ventana razonable.

### IA
Preparar middleware reutilizable para fases posteriores.

No bloquear una demostración normal.

---

# 21. Cambios frontend esperados

Áreas conocidas:

- pantalla de proyectos;
- cliente de proyectos;
- estado raíz de aplicación;
- identidad colaborativa;
- panel de colaboración;
- configuración WebSocket.

Nuevos componentes sugeridos:

```text
CreateProjectForm
JoinProjectForm
RecentProjects
ProjectAccessStore
```

Los nombres reales deben seguir las convenciones actuales del repositorio.

---

# 22. Cambios backend esperados

Áreas conocidas:

- gestión_proyectos;
- colaboración;
- composición del servidor;
- configuración.

Nuevos módulos sugeridos:

```text
infraestructura/mongodb/
gestion_proyectos/acceso/
colaboracion/actividad/
colaboracion/mensajes/
```

No mover archivos existentes solo para “ordenar” si no aporta a la funcionalidad.

---

# 23. Tests unitarios

Cubrir:

- generar código;
- normalizar código;
- validar código;
- crear participante;
- validar credencial;
- repositorio Mongo;
- aislamiento;
- diff semántico de eventos;
- almacenamiento local de recientes.

---

# 24. Tests integración

Con base Mongo de test:

- crear;
- unirse;
- abrir;
- guardar;
- reiniciar repositorio;
- recuperar;
- mensajes;
- eventos;
- credencial proyecto incorrecto;
- código inválido.

---

# 25. Tests E2E

Escenario principal:

```text
Browser A
→ Crear "Demo"
→ Renato
→ obtiene código

Browser B
→ Unirse
→ código
→ Carlos

A crea Venta
B la observa
A guarda
ambos salen

nuevo contexto Browser A
→ Proyectos recientes
→ abre sin código

nuevo contexto limpio Browser C
→ necesita código
```

---

# 26. Definition of Done

Fase 4 NO está terminada hasta demostrar:

- MongoDB es fuente durable principal;
- no listado global;
- CU01 funciona;
- identidad real reemplaza “Diseñador”;
- API project-scoped protegida;
- WebSocket project-scoped protegido;
- aislamiento probado;
- CU11 sobre Mongo;
- cero usuarios no destruye proyecto;
- eventos relevantes persistidos;
- mensajes listos para Fase 5;
- CU02 y CU05–CU10 no se rompieron por infraestructura.

---

# 27. Riesgos

### R-04-01
Migrar todo a Mongo y romper tests antiguos.

**Mitigación:** repositorio por interfaz + migración incremental.

### R-04-02
Guardar el accessToken en Mongo en texto plano.

**Mitigación:** almacenar verificador/hash.

### R-04-03
Confiar en projectId del frontend.

**Mitigación:** validar credencial.

### R-04-04
Intentar crear usuarios/cuentas.

**Mitigación:** recordar alcance.

### R-04-05
Trazabilidad falsa.

**Mitigación:** solo afirmar eventos que realmente se instrumentan.

---

# 28. Handoff a Fase 5

Al iniciar Fase 5 deben existir servicios fiables para responder:

```text
¿quién soy?
¿qué proyecto es?
¿qué modelo existe?
¿qué mensajes existen?
¿qué eventos existen?
¿quién creó/modificó X?
```

Si esto todavía depende de Groq, Fase 4 está incompleta.

**FIN — FASE 4**
