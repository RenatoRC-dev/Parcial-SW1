# Prompts reutilizables
AGENTS.md ya se recibe automáticamente; no pegar documentos completos.

## IMPLEMENT
Implementa el alcance pendiente de `.codex-local/CURRENT_SLICE.md`. Lee solo código relevante, conserva cambios previos, añade/ejecuta pruebas focalizadas y actualiza evidencia local. Sin suites completas, builds, E2E, Groq real ni mutaciones Git. Entrega breve en español.

## AUDIT
Revisa solo [archivo/contrato/flujo] frente a CURRENT_SLICE. Solo lectura, sin auditorías previas TXT ni barrido general. Hallazgos concretos con ubicación, impacto y evidencia; distingue lo no verificado.

## FIX
Corrige [fallo + reproducción/salida] en el árbol actual con el cambio mínimo y una regresión focalizada. Consulta CURRENT_SLICE y contexto especializado solo si hace falta. Preserva cambios ajenos; reporta pruebas y límites, sin commit.

## HANDOFF
Resume el diff relevante y evidencia ejecutada en CURRENT_SLICE: completado, limitaciones y siguiente validación independiente. No reejecutes pruebas amplias ni Groq. Entrega breve en español, sin informes adicionales ni mutaciones Git.
