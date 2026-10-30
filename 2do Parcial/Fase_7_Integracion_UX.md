# NexoCASE — Segundo Parcial de SW1
## Fase 7 — Integración completa y experiencia de usuario

**Estado:** Plan de integración y UX  
**Prerequisitos:** Fases 1–6  
**Objetivo:** convertir las capacidades implementadas en un producto coherente, demostrable y simple de utilizar.  
**Siguiente fase:** Fase 8 — Calidad, regresión, validación y verificación

---

# 1. Principio

La Fase 7 no agrega grandes capacidades de negocio.

Su trabajo es eliminar la sensación de:

> “funciones pegadas unas al lado de otras”.

NexoCASE debe verse como un solo flujo de proyecto.

---

# 2. Pantalla inicial

Objetivo:

```text
NexoCASE
────────────────
[ Crear proyecto ]
[ Unirse con código ]

Proyectos recientes
- Proyecto A   [Abrir]
- Proyecto B   [Abrir]
```

No:

```text
Todos los proyectos del servidor
```

---

# 3. Crear proyecto

Formulario mínimo:

- nombre proyecto;
- nombre visible.

Después:

```text
Proyecto creado
Código: NX7K-P4QM [Copiar]
```

Explicar brevemente:

> Comparte este código con quienes colaborarán en el proyecto.

No llamar al código “contraseña”.

---

# 4. Unirse

Campos:

- código;
- nombre visible.

Estados:

- validando;
- inválido;
- acceso concedido;
- error de red.

No revelar nombres de proyectos ante código inválido antes de validarlo.

---

# 5. Proyecto activo

Top bar debe poder mostrar:

- NexoCASE;
- nombre proyecto;
- estado de guardado;
- acceso al código cuando la UX aprobada lo permita;
- volver.

No saturar con datos técnicos.

---

# 6. Participantes

Panel compacto:

```text
Conectados (2)
● Renato (Tú)
● Carlos
```

No mostrar participantes históricos como conectados.

---

# 7. Rail izquierdo

Conservar capacidades conocidas:

- Modelo;
- Asistente IA;
- Desde imagen;
- Validación;
- XMI;
- Generar.

No agregar una entrada por cada servicio interno.

---

# 8. Asistente IA — panel superior

Conservar patrón actual:

```text
ASISTENTE IA
Instrucción UML
[ ... ]
[ Enviar ]
[ Hablar ]
```

Texto:

> Los cambios claros y válidos se aplican directamente al modelo.

Puede añadir:

> Las acciones quedan asociadas a tu participación en el proyecto.

---

# 9. Asistente colaborativo — panel inferior

Reemplaza visualmente el actual “Asistente contextual”.

Debe mostrar conversación.

Ejemplo:

```text
ASISTENTE COLABORATIVO

Renato
¿Qué opinas de Venta?

NexoCASE IA
Renato, ...

Carlos
¿Eso bloquea Spring?

NexoCASE IA
...

[Escribe un mensaje...]
[Enviar]
```

---

# 10. Evitar duplicación visual

No mostrar simultáneamente:

- conversación completa;
- actividad completa;
- notificaciones completas;

si ocupan todo el panel.

La actividad puede ser:

- panel secundario;
- resumen;
- consultable por IA;
- feed compacto.

---

# 11. Resultado de acción contextual

Cuando usuario dice:

> Hazlo.

Estados:

```text
Interpretando...
Aplicando cambio...
Listo.
```

Luego:

> Agregué `total: Double` a `Venta`.

Si falla:

> No pude aplicar el cambio porque...

Nunca afirmar éxito antes de confirmación.

---

# 12. Aclaración

Si el referente es ambiguo:

```text
IA:
Carlos creó Venta y Producto.
¿Cuál deseas que revise?

[ Venta ] [ Producto ]   opcional
```

Puede ser texto normal; botones son mejora UX, no requisito.

---

# 13. Recomendación vs hecho

Visualmente diferenciar por lenguaje, no por 10 colores.

Ejemplos:

**Error detectado**
> La relación tiene un extremo inexistente.

**Recomendación**
> Recomiendo...

**Hipótesis**
> Esto solo aplica si...

---

# 14. Guardado

El estado de guardado debe continuar siendo comprensible:

- Guardado;
- Cambios sin guardar;
- Guardando;
- Error al guardar.

MongoDB es detalle técnico, no texto de UI.

---

# 15. Reconexión

Estados colaborativos:

- conectado;
- reconectando;
- desconectado;
- error.

Si se pierde red:

- no destruir proyecto;
- no afirmar que otros siguen conectados si presencia es incierta;
- recuperar estado antes de editar cuando se reconecte.

---

# 16. Proyecto reabierto

Mismo dispositivo:

```text
Proyectos recientes
→ Abrir
```

Otro dispositivo:

```text
Unirse con código
```

La diferencia debe ser natural y no exigir explicar arquitectura.

---

# 17. Conversación recuperada

Al abrir:

- cargar un tramo reciente;
- permitir cargar anteriores;
- mostrar continuidad.

No cargar miles de mensajes antes de mostrar la interfaz.

---

# 18. Responsive

NexoCASE sigue siendo principalmente desktop/web para modelado.

No sacrificar canvas para perseguir una experiencia móvil no obligatoria.

En viewport estrecho:

- paneles pueden ser modales/drawers;
- inspector puede ocultarse/alternarse;
- la funcionalidad crítica debe seguir accesible.

---

# 19. Accesibilidad mínima

- labels;
- foco visible;
- botones con texto/aria;
- estados anunciables;
- contraste;
- no depender únicamente de color;
- teclado en formularios.

---

# 20. Mensajes de error

Buenos:

> El código no es válido.

> No pudimos conectar con el proyecto.

> Groq no está disponible en este momento. El modelado manual continúa disponible.

Malos:

> MongoServerSelectionError...
> ECONNREFUSED...
> stack trace...

---

# 21. Confirmaciones

No agregar modales por rutina.

Mantener confirmación donde ya tiene sentido:

- importar XMI porque reemplaza;
- CU05 candidato;
- salida con cambios sin guardar.

No exigir confirmación extra para cada acción CU04 clara si eso contradice el flujo aprobado.

---

# 22. Actividad

Si se visualiza:

```text
10:31 Renato creó Producto mediante IA
10:29 Carlos agregó total a Venta
```

No mostrar ruido técnico.

---

# 23. Código del proyecto

Debe ser fácil de copiar.

No mostrar accessToken.

Código ≠ token.

---

# 24. Diagnóstico técnico

Mantener separado del flujo normal.

No mezclar:

- IDs;
- JSON crudo;
- warnings internos;

con la experiencia del Diseñador salvo en modo diagnóstico.

---

# 25. Consistencia terminológica

Unificar:

- Diseñador de software;
- Proyecto;
- Código de proyecto;
- Proyectos recientes;
- Asistente IA;
- Asistente colaborativo;
- Desde imagen;
- Validación;
- XMI;
- Generar.

No alternar “sala”, “room”, “workspace” en UI final.

---

# 26. Contexto de producto

Actualizar CU12 para enseñar la interfaz final.

Si UI dice:

> Asistente colaborativo

CU12 no debe seguir diciendo:

> abre Asistente contextual.

---

# 27. Flujos de demostración UX

## Demo 1 — acceso

Crear → código → segundo navegador se une.

## Demo 2 — colaboración manual

Carlos edita → Renato observa.

## Demo 3 — CU04 directo

Renato crea Producto con IA → Carlos observa.

## Demo 4 — CU12

Carlos pregunta teoría → todos ven.

## Demo 5 — contexto

Renato revisa Venta → “hazlo” → se aplica.

## Demo 6 — continuidad

cerrar → abrir proyecto reciente → estado recuperado.

---

# 28. Performance percibida

- feedback inmediato;
- indicador IA;
- no congelar canvas durante Groq;
- paginar conversación;
- no recalcular validación excesivamente si puede memoizarse;
- no bloquear toda UI por guardar mensajes.

---

# 29. Tests visuales/UX

No basta snapshot.

Probar:

- estados;
- navegabilidad;
- errores;
- paneles;
- scroll conversación;
- segunda ventana;
- responsive mínimo.

---

# 30. Criterios de aceptación

**Given** un usuario nuevo,  
**When** abre NexoCASE,  
**Then** debe comprender cómo crear o unirse sin ver proyectos ajenos.

**Given** un proyecto,  
**When** abre Asistente IA,  
**Then** debe poder ejecutar una acción directa sin entrar a una conversación larga.

**Given** el Asistente colaborativo,  
**When** conversa y luego dice “hazlo”,  
**Then** la acción debe ocurrir sin obligarlo a copiar la instrucción al panel superior.

**Given** dos participantes,  
**When** uno interactúa con IA,  
**Then** el otro debe percibir la interacción relevante.

---

# 31. Definition of Done

- inicio simplificado;
- crear/unirse/recientes;
- identidad visible;
- participantes;
- dos paneles IA conservados;
- panel CU12 convertido en conversación;
- acciones contextuales naturales;
- estados de carga/error;
- continuidad visible;
- terminología coherente;
- sin secretos expuestos;
- sin regresión visual grave del modelado.

---

# 32. Handoff a Fase 8

Fase 8 recibe un producto funcional integrado.

No debe seguir agregando features salvo correcciones derivadas de pruebas.

**FIN — FASE 7**
