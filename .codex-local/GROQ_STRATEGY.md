# Groq — comportamiento real y límites
Leer solo para cambios de proveedor/modelos/tokens/errores. Configuración y claves exclusivamente backend.

## Configuración implementada
- CU04: GROQ_CU04_MODEL no vacío → GROQ_MODEL no vacío → openai/gpt-oss-20b.
- CU12: GROQ_CU12_MODEL no vacío → GROQ_MODEL no vacío → openai/gpt-oss-20b.
- El argumento explícito del constructor prevalece; no selección de modelo desde el cliente.
- openai/gpt-oss-120b y 20b probados con mocks en ambos proveedores. No cambiar .env, claves, facturación ni modelos activos sin petición.
- No router, fallback automático ni reintentos SDK (maxRetries=0). Timeout CU04 60 s; CU12 18 s.

## Contratos y economía
- Ambos envían json_schema strict:true; objetos cerrados y propiedades requeridas, incluidas anidadas. Los validadores UML/semánticos siguen siendo obligatorios.
- CU04 recibe instrucción autocontenida y contexto canónico compacto completo: conservar IDs y relaciones necesarios para validar cambios.
- CU12: prefijo estático de instrucciones; contextoProducto solo para preguntas del producto que lleguen al proveedor; sin repetir snapshot durable ni historial compartido.
- CU12 envía como máximo 6 mensajes propios de 2400 caracteres; actividad solo para consultas de autoría/historial (hasta 10 eventos).
- Consultas concretas reducen clases a las nombradas/seleccionadas y vecindad de relaciones; se marca truncado y se conserva resumen global. Revisiones generales conservan el modelo acotado.
- Límites de salida: max_completion_tokens 6000 CU04 / 3000 CU12. Sin llamadas para clasificar pronombres resueltos, ayuda determinista, conceptos UML básicos o formato.
- Logs: flujo/modelo/requestId, categorías/estado y conteos input/output/cached disponibles. Nunca claves, prompts, UML, nombres, cuerpos ni mensajes upstream.

## Errores y reintentos
- Leer error.code y error.error.code del SDK: 400 json_validate_failed → respuesta_invalida; otros 400 → configuración rechazada. No retry ciego ni debilitar esquema.
- 429 → error límite con Retry-After: segundos/fecha, fallback 30 s, acotado a 1–300 s. Pausa en memoria compartida CU04/CU12 por modelo dentro del proceso.
- Modelos distintos no comparten esa pausa local; esto NO garantiza cuotas independientes del proveedor. No prometer disponibilidad del segundo modelo.
- HTTP colaborativo: petición inválida 400; respuesta JSON inválida 502; límite 429; timeout CU04 504; indisponibilidad upstream 503. Excepción de programación desconocida → 500 ERROR_INTERNO sanitizado.
- Guardar pregunta y requestId permite reintento manual; no duplicar actionId ni cambios aplicados. Frontend bloquea botón/Enter durante pausa.
- Pausa no distribuida; reiniciar backend elimina ese estado local. Modelado manual/Guardar siguen independientes del proveedor.

## Evidencia y pendientes
- Pruebas focalizadas con mocks; ninguna llamada real ni gasto API en esta implementación.
- Histórico informado: 400 json_validate_failed, 429 y ~2320–5791 tokens de entrada; ventana con 11375 tokens/28 s sugirió presión TPM, sin demostrar bucket exacto.
- Esquemas estrictos ya estaban activos: no atribuir 400 históricos a best-effort ni afirmar causa resuelta sin trazas reales sanitizadas.
- Usuario valida calidad real, permisos/modelos y límites exactos de su cuenta. Precios, tiers y cuotas publicados no son garantía de su proyecto; verificar fuentes oficiales si se solicitan.

Fuentes de compatibilidad consultadas en F7.1: https://console.groq.com/docs/structured-outputs y https://console.groq.com/docs/rate-limits. No prueba live del modelo.
