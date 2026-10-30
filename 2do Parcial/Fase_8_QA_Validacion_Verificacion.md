# NexoCASE — Segundo Parcial de SW1
## Fase 8 — Calidad, regresión, validación y verificación

**Estado:** Plan maestro de QA/V&V  
**Prerequisitos:** Fases 1–7 implementadas  
**Objetivo:** demostrar que NexoCASE hace lo prometido, conserva el primer parcial y que código, modelos y documentación coinciden.  
**Siguiente fase:** Fase 9 — Documentación final y defensa

---

# 1. Principio

“No se cayó en mi máquina” no es validación.

Esta fase debe producir evidencia reproducible.

Separar:

## Validación
¿Construimos el producto que se necesitaba?

## Verificación
¿Lo construido corresponde con especificaciones, modelos, contratos y documentación?

---

# 2. Estrategia de pruebas

Pirámide:

```text
Unitarias
    ↓
Integración
    ↓
E2E
    ↓
Smoke real Groq / despliegue
```

No usar E2E para todo.

---

# 3. Entornos

## Unit
Sin Mongo real cuando no sea necesario.

## Integration
MongoDB de test aislado.

## E2E
Backend + frontend + Mongo + proveedores deterministas.

## Smoke real
Groq real y despliegue real, separado de CI determinista.

---

# 4. Proveedor IA determinista

Conservar/expandir la idea existente.

Debe simular respuestas previsibles para:

- CU04;
- CU05 si aplica;
- CU12;
- orquestador.

No declarar “Groq funciona” solo porque pasa el proveedor falso.

---

# 5. Pruebas CU01

- crear;
- código generado;
- código no igual a ID;
- unirse válido;
- código inválido;
- no listado global;
- proyecto reciente;
- token inválido;
- dispositivo nuevo exige código;
- aislamiento.

---

# 6. Pruebas CU02

Regresión:

- crear clase;
- editar atributos;
- operaciones;
- relaciones;
- multiplicidades;
- inspector;
- adaptador canónico.

---

# 7. Pruebas CU03

- dos clientes;
- identidad correcta;
- presencia;
- modelo converge;
- proyecto A/B aislados;
- desconexión;
- reconexión;
- WebSocket sin credencial rechazado.

---

# 8. Pruebas CU04

- clase;
- atributo;
- relación;
- multiplicidad;
- voz;
- ambigüedad;
- acción directa visible;
- evento solicitadoPor;
- modelo previo con error no relacionado si se implementó mejora.

---

# 9. Pruebas CU05

Regresión:

- archivo válido;
- candidato;
- cancelar no muta;
- aceptar muta;
- advertencias;
- evento de aplicación;
- tipos no soportados preservados según decisión final del producto.

---

# 10. Pruebas CU06/CU07

- importar;
- confirmación reemplazo;
- exportar `modelo.xmi`;
- warning;
- modelo resultante;
- XMI no confundido con generación.

---

# 11. Pruebas CU08

- modelo válido;
- errores;
- warnings;
- diagnósticos;
- IA usa resultado real.

---

# 12. Pruebas CU09/CU10

- aptitud;
- bloqueo;
- tipos;
- relaciones soportadas;
- generar ZIP;
- descargar;
- regresión del backend generado.

---

# 13. Pruebas CU11

- guardar Mongo;
- recuperar;
- reinicio backend;
- cero usuarios;
- reabrir mismo dispositivo;
- otro dispositivo con código;
- conversación;
- actividad.

---

# 14. Pruebas CU12

- producto;
- UML;
- modelo;
- validación;
- Spring;
- quién hizo qué;
- qué hizo Carlos;
- incorporación tardía;
- nombre del interlocutor;
- nombres duplicados;
- foco;
- elemento eliminado;
- Groq caído.

---

# 15. Pruebas orquestador

- consulta → CU12;
- acción directa → CU04;
- “hazlo”;
- “corrígelo”;
- “agrégale”;
- ambigüedad;
- propuesta stale;
- proposalId duplicado;
- acción destructiva;
- decisión de negocio incierta.

---

# 16. Pruebas MongoDB

- índices;
- unique constraints;
- persistencia;
- paginación;
- aislamiento;
- migración;
- documentos corruptos/invalidables;
- fallo de conexión.

---

# 17. Pruebas seguridad mínima

- ID conocido sin token;
- token proyecto A en B;
- WebSocket sin autorización;
- código fuerza bruta limitado;
- secrets no retornados;
- stack trace no expuesto;
- no accessToken en mensajes;
- no URI Mongo en frontend.

---

# 18. Pruebas concurrentes

Mínimo dos contextos browser.

Casos:

1. ambos editan;
2. uno pregunta mientras otro cambia;
3. propuesta IA envejece;
4. dos preguntas IA simultáneas;
5. dos proyectos simultáneos.

---

# 19. Prueba estrella del parcial

```text
A = Renato
B = Carlos

A crea proyecto.
B se une con código.

B crea Venta.
A pregunta:
"¿Quién creó Venta?"

IA:
"Renato, Carlos..."

A:
"Revísala."

IA:
diagnóstico/recomendación.

A:
"Hazlo."

CU04 aplica.
B observa el cambio.

Ambos cierran.
Backend se reinicia.

A abre desde recientes.
B entra posteriormente.
Modelo + conversación + actividad continúan.
```

Debe quedar grabable/capturable como evidencia.

---

# 20. Prueba IA teórica

```text
¿Qué es un atributo derivado?
```

Todos observan respuesta.

La consulta no modifica modelo.

---

# 21. Prueba ayuda NexoCASE

```text
¿Cómo importo XMI?
```

La respuesta debe coincidir con UI final.

Esto verifica sincronía documentación/product context/interfaz.

---

# 22. Smoke Groq real

Separado de CI.

Comprobar:

- credencial configurada;
- modelo accesible;
- latencia razonable;
- CU04;
- CU12;
- voz;
- visión si forma parte de demo.

Guardar evidencia sin secretos.

---

# 23. Métricas útiles

No inventar KPIs sofisticados.

Registrar:

- tests totales;
- passed/failed;
- cobertura si ya está disponible;
- E2E;
- tiempo aproximado suite;
- bugs críticos abiertos.

---

# 24. Severidad de bugs

### Bloqueante
Impide demo/flujo principal.

### Alta
Rompe CU o aislamiento.

### Media
Flujo funciona con defecto.

### Baja
Cosmético/no crítico.

Antes de freeze:

```text
Bloqueantes = 0
Altos = 0
```

---

# 25. Validación funcional

Matriz:

| Necesidad | Evidencia |
|---|---|
| IA colaborativa | E2E conversación compartida |
| identidad | respuesta dirigida + participante |
| contexto | “hazlo” |
| trazabilidad | quién creó Venta |
| continuidad | reopen |
| NoSQL | MongoDB/Compass/evidencia |
| primer parcial | regresión CU01–CU12 |

---

# 26. Verificación documental

Por cada CU:

```text
CU
→ requisito
→ reglas
→ arquitectura
→ módulos
→ tests
→ evidencia
```

Si documento dice una función que código no tiene:

> corregir documento o código antes del freeze.

No defender “está planificado” como implementado.

---

# 27. Revisión de modelos UML

Actualizar solo diagramas que realmente cambiaron.

Verificar:

- actores;
- casos de uso;
- componentes;
- clases de análisis/diseño;
- comunicación/secuencia;
- despliegue;
- persistencia.

No dibujar clases inexistentes.

---

# 28. Revisión de API

Comparar:

- documentación;
- rutas reales;
- métodos;
- auth ligera;
- payloads;
- códigos HTTP.

---

# 29. Revisión de base Mongo

Comparar:

- colecciones documentadas;
- colecciones reales;
- índices;
- campos;
- ejemplos.

MongoDB no debe documentarse como tablas relacionales.

---

# 30. Revisión Groq

Documentar:

- proveedor;
- propósito;
- variables;
- no IA local;
- no entrenamiento;
- contexto;
- límites.

No incluir claves.

---

# 31. Checklist de regresión pre-freeze

- npm install reproducible;
- backend build;
- frontend build;
- tests backend;
- tests frontend;
- E2E;
- Mongo disponible;
- variables ejemplo;
- README;
- deploy;
- health;
- Groq smoke;
- XMI;
- Spring;
- voz;
- imagen.

---

# 32. Evidencias

Guardar:

- logs de test;
- capturas claves;
- video opcional de flujo;
- screenshots Compass sin secretos;
- URLs de deploy;
- commit/tag final.

---

# 33. Tag de release

Recomendado:

```text
v2-parcial2
```

o equivalente definido por el equipo.

El tag debe apuntar al código defendido.

---

# 34. Criterios de aceptación

**Given** Fases 1–7,  
**When** se ejecuta la suite,  
**Then** no debe existir regresión conocida crítica de los CU conservados.

**Given** dos proyectos,  
**When** colaboran simultáneamente,  
**Then** mensajes/modelos/eventos no deben mezclarse.

**Given** la documentación,  
**When** se inspecciona el código,  
**Then** los componentes funcionales declarados deben existir o estar claramente marcados como no implementados.

---

# 35. Definition of Done

- suites verdes;
- flujo estrella verde;
- Mongo persistence verde;
- Groq smoke real evidenciado;
- 0 blockers;
- 0 high;
- matrices V&V;
- documentación técnica corregida;
- tag/revisión final identificada;
- despliegue reproducible.

---

# 36. Handoff a Fase 9

Fase 9 recibe hechos verificados.

No debe redactar funcionalidades imaginarias.

**FIN — FASE 8**
