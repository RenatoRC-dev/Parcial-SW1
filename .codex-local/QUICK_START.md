# Flujo corto
- AGENTS.md es el mapa permanente que Codex recibe automáticamente; no volver a pegarlo.
- CURRENT_SLICE.md conserva alcance activo, estado real, evidencia y pendientes. Cambiarlo cuando cambie el trabajo.
- Usar una línea de PROMPTS.md y añadir solo el fallo, archivo o resultado nuevo.
- Codex lee código dirigido y contexto especializado bajo demanda; no cargar todos los Markdown ni auditorías TXT.
- Pruebas focalizadas durante implementación. Usuario + ChatGPT realizan la validación amplia, Mongo/Yjs y Groq real por separado.
- Este entorno es local y excluido de Git; no duplicarlo en docs/context ni versionarlo.
