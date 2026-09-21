# Guía de adaptación rápida del dominio Flutter

## Propósito

El scaffold separa infraestructura reusable de código específico del dominio. Adaptarlo en el examen requiere cambiar código Dart explícito y pruebas; no pretende interpretar un esquema dinámicamente ni generar toda la aplicación sin código.

## Mapa de acoplamiento

| Archivo o área | Responsabilidad | Clasificación | ¿Cambiar en examen? |
|---|---|---|---|
| `lib/configuracion/configuracion_dominio_examen.dart` | Nombre visible, acciones wire, entidades de outbox y rutas REST | Frontera de configuración | Sí, primero |
| `lib/dominio/comando_local.dart` | Enum y comando validado | Patrón reusable; enum específico | Sí, acciones |
| `lib/aplicacion/interpretador_comando_local.dart` | Prompt corto y extracción mediante IA local | Pipeline reusable; prompt específico | Sí, ejemplos e intenciones |
| `lib/dominio/validador_comando_local.dart` | Whitelist, campos y tipos estrictos | Patrón reusable; reglas específicas | Sí |
| `lib/dominio/*_local.dart` | Entidades locales | Específico | Sí |
| `lib/persistencia/base_datos_local.dart` | Bootstrap, versión, tablas y migraciones SQLite | Patrón reusable; esquema específico | Sí, esquema y migración |
| `lib/persistencia/*_repository.dart` | Mapeo entidad–tabla | Específico | Sí |
| `lib/aplicacion/ejecutor_comando_local.dart` | Despacho, transacción entidad + outbox y consultas | Patrón reusable; casos específicos | Sí |
| `lib/persistencia/outbox_repository.dart` | FIFO, estados, errores e intentos | Reusable | Normalmente no |
| `lib/persistencia/configuracion_local_repository.dart` | URL persistida del backend | Reusable | No |
| `lib/sincronizacion/backend_api.dart` | Operaciones remotas tipadas | Frontera reusable; métodos específicos | Sí, métodos |
| `lib/sincronizacion/http_backend_api.dart` | Rutas, cuerpos y lectura del ID generado | Específico | Sí, según Spring generado |
| `lib/sincronizacion/servicio_sincronizacion.dart` | FIFO, éxito/error y actualización local | Algoritmo reusable; dispatch específico | Sí, solo nuevos tipos/entidades |
| `lib/presentacion/local_ai_spike_page.dart` | Composición y resultados visibles | Pantalla reusable; render específico | Sí, textos/resultados |
| `lib/local_ai/` | Modelo GGUF, contexto aislado y generación | Reusable | No, salvo contrato excepcional |
| `test/` | Contrato, persistencia, sincronización y HTTP | Baseline + específico | Sí, conservar y adaptar |

Los nombres de tablas y sus columnas permanecen cerca del SQL/repositorio. No se trasladan a JSON ni a reflexión porque el esquema y sus migraciones necesitan revisión explícita.

## Ejemplo: Cliente/Producto → Paciente/Consulta

Ejemplo de contrato nuevo:

- `registrar_paciente(nombre, documento)`
- `crear_consulta(pacienteIdLocal, motivo, fecha)`
- `consultar_pacientes()`

Adaptación:

1. En `ConfiguracionDominioExamen`, cambiar nombre, acciones, nombres de entidad y rutas reales, por ejemplo `/api/paciente` y `/api/consulta`.
2. Sustituir el enum por `registrarPaciente`, `crearConsulta` y `consultarPacientes`.
3. Dar al prompt solo esas acciones, campos y ejemplos. Conservar `no_soportada`.
4. Validar exactamente `nombre/documento` y `pacienteIdLocal/motivo/fecha`; nunca aceptar campos o tipos inventados.
5. Crear `PacienteLocal` y `ConsultaLocal` y sus repositorios.
6. Incrementar la versión SQLite y añadir tablas mediante `onUpgrade`; nunca borrar la base instalada para “facilitar” la adaptación.
7. En el ejecutor, insertar entidad y outbox en la misma transacción. Las consultas continúan sin outbox.
8. Inspeccionar los controladores generados antes de implementar `HttpBackendApi`; copiar rutas, cuerpos e ID de la API real, no asumirlos.
9. Agregar dispatch de sincronización y marcado local para cada nueva entidad.
10. Renderizar resultados del nuevo dominio y reemplazar fixtures de prueba.

## Secuencia recomendada para el examen

1. Modelar y validar el dominio en SW1.
2. Generar Spring y anotar controladores, rutas, campos, tipos e IDs reales.
3. Definir en papel tres o cuatro comandos mínimos que demuestren creación y consulta offline.
4. Actualizar `ConfiguracionDominioExamen` y `TipoAccionLocal`.
5. Ajustar prompt y validador; ejecutar primero sus pruebas.
6. Crear entidades, esquema/migración y repositorios; probar persistencia.
7. Ajustar ejecutor y payload de outbox; probar atomicidad.
8. Ajustar `BackendApi`, HTTP y dispatch; probar rutas/cuerpos con `MockClient`.
9. Ajustar UI solo para mostrar los resultados necesarios.
10. Ejecutar `flutter analyze`, `flutter test` y `flutter build apk --debug`.
11. Probar offline en el teléfono, luego backend/PostgreSQL por LAN y finalmente no-reenvío.

## Reglas que no deben romperse

- La IA interpreta; el validador autoriza; el ejecutor modifica datos.
- Una acción desconocida o incompleta nunca llega a SQLite.
- Mutación local y outbox son una sola transacción.
- Una consulta no genera outbox.
- Un fallo remoto conserva los datos y permite reintento.
- Una operación sincronizada no se reenvía.
- No poner rutas, credenciales ni SQL en widgets o prompts.
- No convertir el scaffold en un motor CRUD dinámico durante el examen.

