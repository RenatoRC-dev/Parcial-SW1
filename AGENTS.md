# NexoCASE — mapa permanente para Codex
LOCAL ONLY: nunca versionar AGENTS.md ni `.codex-local/**`.

## Lectura mínima
1. Petición actual y [CURRENT_SLICE](.codex-local/CURRENT_SLICE.md).
2. Código y pruebas relevantes: autoridad sobre notas locales.
3. Solo según necesidad: [DOMAIN](.codex-local/DOMAIN.md), [ARCHITECTURE](.codex-local/ARCHITECTURE.md), [TRACEABILITY](.codex-local/TRACEABILITY.md).
4. Proveedor, tokens, modelos o límites: [GROQ_STRATEGY](.codex-local/GROQ_STRATEGY.md).
5. Flujos breves: [PROMPTS](.codex-local/PROMPTS.md) y [QUICK_START](.codex-local/QUICK_START.md).
Consultar Fase_*.md solo ante contradicción material no resuelta; no cargar auditorías TXT.

## Invariantes
- Evolución incremental: preservar CU01–CU12 y un actor humano, Diseñador de software.
- CU12 asesora; el orquestador resuelve intención/contexto; solo CU04 interpreta cambios autorizados por una persona.
- Solo el cliente solicitante ejecuta el plan validado contra el UML vivo; Yjs sincroniza.
- Identidad y contexto por proyecto/participante autenticado; no adivinar referencias ambiguas o destructivas.
- Mongo conserva mensajes/eventos/snapshots; CU11 exige Guardar explícito, con idempotencia, atribución y conflictos.
- Cero elementos es válido; preservar confirmación CU05, XMI, CU08 y generación Spring CU09/10.
- No inventar requisitos ni multiplicidades; Groq no es fuente de verdad ni autorización.
- Secretos solo en backend: nunca mostrarlos en frontend, logs, prompts o evidencia.

## Trabajo y seguridad
- Cambios mínimos del alcance vigente; reutilizar patrones, sin capas, dependencias ni funciones especulativas.
- Empezar con rg y lecturas acotadas; no escanear el repositorio ni repetir auditorías/estado Git.
- Pruebas de regresión focalizadas y económicas; no suites completas, E2E, builds ni Groq real salvo petición explícita.
- UX segura en React y cero llamadas IA para formato. No generar informes, TXT o capturas innecesarios.
- Trabajar en la rama/árbol actuales; preservar todos los cambios ajenos y auditorías no seguidas.
- Sin add/commit/push/reset/clean/restore/stash/rebase/checkout ni descarte sin solicitud explícita.
- No editar .env, credenciales, .gitignore ni .git/info/exclude salvo solicitud; mantener exclusión local de este entorno.
- Actualizar notas solo por cambios de alcance/hechos verificados; separar conocimiento estable del slice.
- Entrega breve en español: comportamiento/archivos, pruebas ejecutadas, límites/bloqueos y estado Git; no fingir validación.
