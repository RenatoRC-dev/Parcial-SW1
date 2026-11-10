# NexoCASE — F8.1 | Auditoría integral de los 12 casos de uso

**Fecha:** 10 de noviembre de 2026  
**Versión auditada:** `103ea46633fa29ee77dbd87466178cdbab090433` (`main`)  
**Fuente:** `NEXOCASE_F8_AUDITORIA_INTEGRAL_20261110_034755.zip`  
**Tipo:** revisión estática integral de requisitos, arquitectura, código, contratos y pruebas + contraste con resultados de ejecución aportados en la conversación.  
**Responsable de enfoque:** Product Owner / Business Analyst / QA.

## 1. Dictamen ejecutivo

**Los 12 casos de uso oficiales están representados por implementaciones reales y pruebas; no aparece un CU completamente ausente.** Eso **no** equivale a certificar que todos admiten cualquier escenario o que el despliegue público esté listo sin condiciones.

- **9 CU presentan evidencia funcional sólida en el alcance declarado:** CU01, CU02, CU03, CU04, CU05, CU08, CU10, CU11 y CU12. CU04 y CU05 arrastran un riesgo transversal de protección de recursos de IA, descrito abajo.
- **3 CU están implementados dentro de un perfil explícitamente limitado:** CU06, CU07 y CU09. No debe prometerse interoperabilidad XMI universal ni generación Spring para cualquier diagrama UML.
- **Hallazgo alto P1 confirmado por revisión estática:** imagen y transcripción de voz consumen proveedores de IA desde rutas públicas sin autorización de proyecto ni limitación de peticiones en servidor. El riesgo principal es consumo indebido de cuota/coste y saturación, no acceso demostrado a datos privados.
- **Hallazgo operativo P1 condicionado al despliegue:** `render.yaml` no declara las dos variables obligatorias para arrancar en modo Mongo (`MONGODB_URI` y `PROJECT_ACCESS_PEPPER`), aunque pueden estar configuradas manualmente en el proveedor. No se inspeccionó el entorno remoto.
- **Hallazgo de exposición P1 condicionado al despliegue:** la creación pública de proyectos no tiene limitación comparable a la unión por código; permite crecimiento abusivo de datos si el backend es accesible de forma pública.
- **Riesgos medios P2:** trazabilidad manual enviada de forma no bloqueante sin recuperación ante fallo; alcance parcial de XMI y Spring; falta de ciertos *smokes* externos; instrucciones de despliegue y configuración incompletas dentro de esta evidencia.

**Decisión PO:** apto para una **demostración local controlada del flujo principal**, de acuerdo con la evidencia disponible. **Cierre total de F8/producción pública: condicionado** a tratar o aceptar formalmente los P1, verificar el entorno desplegado y completar evidencias de ejecución externa. No se ha detectado un P0 demostrado en el código examinado.

## 2. Alcance, integridad y limitaciones

El ZIP tiene 344 entradas: 338 archivos de repositorio incluidos, seis piezas de inventario y un archivo versionado omitido, `backend/.env.example`. Se compararon los 338 archivos con `00_AUDITORIA/MANIFIESTO_SHA256.csv`: **338 coincidencias, cero faltantes y cero discrepancias SHA-256**. Esta comprobación demuestra integridad **interna del paquete**, no prueba por sí sola que sus bytes coincidan con el Git remoto (el ZIP no contiene `.git`). Incluye nueve documentos de fases, código backend/frontend, 50 definiciones E2E y un scaffold Flutter que **no es obligatorio para el segundo parcial** según `Fase_1_Consolidacion_Alcance.md:78`.

Fuentes normativas fundamentales:

- `2do Parcial/Fase_1_Consolidacion_Alcance.md:275-288` — CU01–CU12.
- `2do Parcial/Fase_1_Consolidacion_Alcance.md:1113-1226` — reglas RN y RF2-01 a RF2-14.
- `2do Parcial/Fase_2_Diseno_Funcional_IA_Colaborativa.md` — actores, flujos, ambigüedad, colaboración y autoridad de la IA.
- `2do Parcial/Fase_8_QA_Validacion_Verificacion.md` — plan maestro, 0 bloqueantes/0 altas, definición de terminado.
- `2do Parcial/Fase_9_Documentacion_Defensa.md:1-23` — **la preparación documental y de defensa corresponde formalmente a F9**, una vez verificada F8.

Evidencia externa de esta conversación: **466 pruebas backend, 234 frontend y 50 E2E aprobadas**, con comprobaciones manuales de Groq CU04/CU12, colaboración y persistencia tras reinicio. **No se ejecutaron pruebas nuevas durante esta revisión ZIP**, no se abrió una base MongoDB en vivo, no se inspeccionó la configuración de Render, ni se compilaron proyectos Spring generados desde este entorno.

**Aclaración importante de E2E:** `frontend/playwright.config.ts:3-5` usa backend Mongo cuando existe `MONGODB_E2E_URI`, y `iniciarServidorGeneracionBackend.ts:45-61` configura repositorios Mongo en ese modo. La ejecución del usuario fijó `MONGODB_E2E_URI`/`MONGODB_URI` al puerto `27029`; por lo tanto esos 50 E2E sí tenían Mongo de prueba, pero IA determinista (`playwright.config.ts:3-5`). No equivalen a 50 pruebas reales de Groq.

## 3. Matriz ejecutiva de cumplimiento de los 12 CU

**Escala:** `Sólido` = flujos y protección principal implementados con pruebas identificables; `Perfil limitado` = comportamiento real, pero la totalidad del UML o tecnología no está soportada; `Condicional` = riesgo transversal o evidencia pendiente. Ninguna etiqueta sustituye una prueba en producción.

| CU | Necesidad de negocio | Evidencia clave | Veredicto F8.1 | Pendiente concreto |
|---|---|---|---|---|
| **CU01** | Crear, ingresar y reabrir proyecto mediante código | `GestionarAccesoProyecto.ts`, `registrarRutasProyectos.ts`, `gestion-proyectos.spec.ts` | **Sólido** | Limitar creación anónima si se publica |
| **CU02** | Editar clases, atributos, métodos, relaciones y multiplicidades | `PaginaModeladoClases.tsx`, `InspectorPropiedadesUML.tsx`, `AdaptadorApollon.test.ts`, `cu02-modelado-clases.spec.ts` | **Sólido** | Evidenciar edición manual compleja en defensa |
| **CU03** | Colaboración simultánea, presencia y aislamiento | `ServidorRelayColaboracion.ts`, `conectarColaboracionApollon.ts`, `colaboracion-tiempo-real.spec.ts` | **Sólido** | Aclarar alcance de trazabilidad ante caída de red |
| **CU04** | Ejecutar cambios UML solicitados por texto/voz | `registrarRutaInterpretacionIA.ts`, `validarPlanCambiosUML.ts`, `asistente-ia.spec.ts`, `asistente-voz.spec.ts` | **Sólido, condicional** | Proteger endpoint público de transcripción y completar smoke voz real |
| **CU05** | Interpretar imagen y confirmar candidato UML antes de aplicar | `registrarRutaAnalisisImagen.ts`, `PanelModeladoDesdeImagen.tsx`, `asistente-imagen.spec.ts` | **Sólido, condicional** | Proteger endpoint público de visión y smoke Groq visión |
| **CU06** | Importar XMI al modelo | `importarModeloXmi.ts`, `AdaptadorCrunchUML.test.ts`, `interoperabilidad-xmi.spec.ts` | **Perfil limitado** | Publicitar que métodos/enumeraciones pueden omitirse con advertencias |
| **CU07** | Exportar XMI descargable | `exportarModeloXmi.ts`, `PanelInteroperabilidadXmi.tsx`, `AdaptadorCrunchUML.test.ts` | **Perfil limitado** | Modelos con métodos quedan fuera del perfil exportable |
| **CU08** | Validar UML e informar errores/advertencias | `ValidadorModeloUML.ts`, `ValidadorModeloUML.test.ts`, `PaginaModeladoClases.tsx` | **Sólido** | Evidencia E2E enfocada en diagnósticos negativos (P2) |
| **CU09** | Generar backend Spring desde modelo elegible | `PrepararProyectoSpring.ts`, `GeneradorSpringBoot.ts`, `EvaluadorAptitudGeneracionSpring.ts`, pruebas de generación | **Perfil limitado** | Smoke real: compilar e iniciar backend generado; documentar relaciones soportadas |
| **CU10** | Descargar ZIP del backend generado | `EmpaquetadorBackendGenerado.ts`, `descargarBackendGenerado.ts`, `cu09-generacion-backend.spec.ts` | **Sólido** | Mostrar archivo descomprimido/ejecución de ejemplo |
| **CU11** | Guardado explícito, revisión concurrente y recuperación durable | `GuardarRecuperarProyecto.ts`, `RepositorioProyectosMongo.ts`, `gestion-proyectos.spec.ts`, `ContinuidadMongo.integracion.test.ts` | **Sólido** | Documentar que Yjs no significa autosave |
| **CU12** | Asistente colaborativo con contexto, memoria, consejo, acción derivada y autoría | `OrquestarInteraccionIA.ts`, `AsistirColaborativamente.ts`, `orquestacionIA.test.ts`, `asistente-contextual.spec.ts` | **Sólido** | Mantener distinción entre E2E simulado y smoke Groq real |

### 3.1. CU01 — Crear o acceder a proyecto

**Reglas:** código aleatorio distinto del ID; creación con nombre visible; quien conoce código puede unirse; credencial técnica vinculada a participante/proyecto; sin listado global. `GestionarAccesoProyecto.ts:32-119` genera participante/credencial y compensa la creación incompleta. `ProtegerAccesoProyecto.ts:1-22` define formato y protección del código. `registrarRutasProyectos.ts:42-89` implementa crear, unirse y consultar proyecto autorizado; no existe ruta pública de listado global. `requerirAccesoProyecto.ts:21-59` valida Bearer y pertenencia.

**Frontend:** `PanelProyectos.tsx` y `AlmacenProyectosRecientes.ts`. **Datos:** proyectos, participantes y digests de códigos/credenciales en Mongo. **Pruebas:** `gestion-proyectos.spec.ts:119-159`, `GestionarAccesoProyecto.test.ts`, `ProtegerAccesoProyecto.test.ts`, rutas y aislamiento. **Excepción:** la limitación de intentos existe para unirse (10 fallos/minuto por IP en memoria), no para crear proyectos (`registrarRutasProyectos.ts:42-79`). **Dictamen:** implementado según el diseño académico; endurecer creación si hay exposición pública. No atribuir identidades legales: el nombre es un alias, no una cuenta verificada.

### 3.2. CU02 — Modelar diagrama de clases manualmente

**Responsabilidad:** diseñador crea, edita y elimina contenido UML. **Frontend:** `PaginaModeladoClases.tsx:28-139` mantiene Apollon como editor, adapta al modelo canónico y calcula validación/aptitud. `InspectorPropiedadesUML.tsx` maneja clases, atributos, visibilidad, métodos y parámetros. `AdaptadorApollon.ts` realiza mapeo bidireccional. **Backend/BD:** no necesita una ruta por cada acción manual; el modelo se sincroniza por Yjs y se guarda como snapshot mediante CU11. **Pruebas:** `cu02-modelado-clases.spec.ts`, `seguridad-modelado-preferencias.spec.ts:5-125`, tests de inspector y adaptador. **Dictamen:** sólido para el perfil de clases modelado. **Límite:** dibujar UML no implica automáticamente que CU07 exporte los métodos o CU09 genere cualquier relación.

### 3.3. CU03 — Colaborar en el modelado

**Reglas:** sala por proyecto, participantes autorizados, presencia y convergencia. `ServidorRelayColaboracion.ts:10-14,91-151,163-177` limita payload, exige autenticación WS antes de aceptar mensajes y aísla salas. `conectarColaboracionApollon.ts:88-164` crea conexión, valida ACK, envía sincronización inicial y awareness; `PanelColaboracion.tsx:18-43` expone participantes. **Datos:** identidad y acceso durables en Mongo; sincronización Yjs en memoria/cliente. **Pruebas:** `colaboracion-tiempo-real.spec.ts`, `colaboracion-autorizacion.spec.ts`, tests unitarios de relay y reconexión. **Dictamen:** sólido. **Precisión:** Yjs transporta cambios; no reemplaza el guardar explícito en Mongo. El evento semántico de cada cambio manual se envía de forma independiente, por lo que su entrega no es transaccional con la edición.

### 3.4. CU04 — Modelar con IA por texto/voz

**Reglas:** orden directa clara o contexto autorizado; no aplicar cambios destructivos ambiguos; validar plan antes de mutar; solo el cliente solicitante ejecuta; registrar actividad una vez; mantener guardado explícito. `registrarRutaInterpretacionIA.ts:25-30,58-145` protege interpretación y confirmación por proyecto; `validarPlanCambiosUML.ts`, `EjecutorComandosUML.ts` y `normalizarSemanticaAsistida.ts` separan interpretación/validación/ejecución. Pruebas `interpretarInstruccionModelado.test.ts`, `asistente-ia.spec.ts`, `asistente-voz.spec.ts`, `orquestacionIA.test.ts` cubren ID temporal, atomicidad, deduplicación y acciones contextuales. **Dictamen:** sólido para ejecución de comandos; la voz transcribe por un endpoint separado sin autorización de proyecto (`registrarRutaTranscripcionVoz.ts:17-47`). La verificación de voz con Groq real no consta en la evidencia recibida.

### 3.5. CU05 — Modelar desde imagen

**Flujo:** selección de PNG/JPEG → proveedor de visión devuelve candidato → vista previa y advertencias → aceptación o cancelación → validación y adición al modelo. `PanelModeladoDesdeImagen.tsx:47-90,114-129` no altera el modelo antes de confirmar y limita la UI a cuatro análisis por ciclo; `aplicarCandidatoImagen.ts:10-78` valida colisiones, tipos y modelo resultante. `registrarRutaAnalisisImagen.ts:6-19,21-73` limita archivo a 10 MB, MIME y firma, pero **no autentica proyecto ni limita peticiones en servidor**. `validarCandidatoModeloUML.ts:7-65` limita tamaño y referencias de la respuesta. **Perfil:** relaciones candidatas de tipo `asociacion`, no todo UML. **Pruebas:** `asistente-imagen.spec.ts`, validaciones backend/frontend. **Dictamen:** función implementada; P1 de abuso del proveedor si se publica, smoke real de visión no documentado en esta evidencia.

### 3.6. CU06 — Importar modelo XMI

**Flujo:** selección `.xmi/.xml` → confirmación de sustitución → parseo y mapeo de modelo → aplicación al editor + advertencias. `PanelInteroperabilidadXmi.tsx:22-42`; endpoint `ServidorGeneracionBackend.ts:86-100` limita XML a 5 MB; `AdaptadorCrunchUML.ts:34-84` ejecuta puente Python con timeout 30 s. `bridge_crunch_uml.py` realiza análisis del perfil. **Pruebas:** `AdaptadorCrunchUML.test.ts` incluye conservación de clase, atributos, relaciones, posición, multiplicidad, generalización, XML malformado, tamaño y warnings; `interoperabilidad-xmi.spec.ts` demuestra importación/exportación. **Límite funcional importante:** operaciones y enumeraciones pueden ser omitidas explícitamente con advertencias; esto está previsto en tests y código. **Dictamen:** conforme con perfil definido, **no** importación UML 2.5 arbitraria sin pérdida.

### 3.7. CU07 — Exportar modelo XMI

**Flujo:** usuario pulsa Exportar → frontend transmite modelo canónico → backend produce descarga `modelo.xmi` (`PanelInteroperabilidadXmi.tsx:44-56`, `ServidorGeneracionBackend.ts:102-113`). **Pruebas:** round-trip del adaptador, visibilidad, roles, cardinalidades y `interoperabilidad-xmi.spec.ts`. **Límite:** el adaptador **rechaza métodos fuera del perfil** en vez de descartarlos silenciosamente (`AdaptadorCrunchUML.test.ts:76-88`). Por lo tanto, un diagrama válido en CU02 con operaciones puede no ser exportable. **Dictamen:** limitado pero controlado; debe declararse en ayuda/defensa, no presentar como exportación universal.

### 3.8. CU08 — Validar UML

`ValidadorModeloUML.ts:8-29,53-179` produce diagnósticos con severidad y referencias a elementos. `PaginaModeladoClases.tsx:99-129` calcula resultado del modelo canónico actual y lo aporta a vista/aptitud/contexto IA. `ValidadorModeloUML.test.ts` comprueba IDs, colisiones de nombres, tipos/identificadores, firmas, relaciones inexistentes, generalización inválida y advertencias. **Dictamen:** implementación sólida, con buena separación conceptual entre validez estructural UML y aptitud técnica Spring. **Evidencia deseable:** una prueba E2E aislada que muestre un error y su resolución en la interfaz, para reforzar la defensa; no se considera defecto de código demostrado.

### 3.9. CU09 — Generar backend Spring Boot

`EvaluadorAptitudGeneracionSpring.ts:49-176` bloquea casos que no pertenecen al perfil: clases abstractas, relaciones generales de agregación/composición, autorrelaciones, 1:1, N:M directo, identificadores/tipos incompatibles. Acepta **1 ↔ 0..***, **1 ↔ 1..*** y asociaciones estructuradas mediante clase asociativa, con validación de claves/colisiones. `GeneradorSpringBoot.ts`, `PrepararProyectoSpring.ts` y plantillas `.java.ejs` generan entidad, repositorio, servicio, controlador CRUD y configuración; tests específicos verifican FK, orientación, entidad asociativa e identidad. `cu09-generacion-backend.spec.ts` prueba botón/descarga. **Dictamen:** funcional y razonablemente seguro dentro del perfil limitado. **Prueba externa restante:** compilar el ZIP resultante y realizar una operación CRUD contra PostgreSQL en entorno de defensa; existe `probarFlujoPostgreSQL.ts` como prueba runtime, pero no evidencia de su ejecución en el cierre actual. **No prometer Java generado para cualquier UML.**

### 3.10. CU10 — Obtener backend generado

`EmpaquetadorBackendGenerado.ts:5-24` añade archivos del árbol generado en ZIP, excluyendo directorios de salida/temporales. `ServidorGeneracionBackend.ts:115-135` prepara temporal, genera, empaqueta y elimina temporal en `finally`. `descargarBackendGenerado.ts:4-28` descarga `backend-generado.zip`. Pruebas unitarias de empaquetado y E2E de generación/descarga. **Dictamen:** sólido. Que un ZIP se descargue **no demuestra** por sí solo que compile y arranque; eso corresponde a la verificación adicional de CU09.

### 3.11. CU11 — Guardar y recuperar proyecto

`GuardarRecuperarProyecto.ts:7-20` exige modelo persistible y revisión base; `RepositorioProyectosMongo.ts:119-144` actualiza con `findOneAndUpdate` condicionado a `revisionModelo`, incrementa revisión y devuelve 409 funcional ante conflicto. `registrarRutasProyectos.ts:81-105` protege GET/PUT con credencial de proyecto y registra evento de guardado. `gestion-proyectos.spec.ts:4-118` cubre guardar/recargar, aislamiento, dos colaboradores, cambios sin guardar y conflictos. `ContinuidadMongo.integracion.test.ts` y `ReinicioBackendMongo.integracion.test.ts` aportan evidencia adicional de recuperación. Prueba manual del usuario: guardó, cerró dos navegadores, reinició backend y recuperó proyecto. **Dictamen:** sólido. **Regla expresa:** el guardado no es automático; edición colaborativa sin guardar puede perderse al cerrar todos los clientes.

### 3.12. CU12 — Asistir colaborativamente

`registrarRutaAsistenteColaborativo.ts:20-65` autentica y valida contrato, administra errores de Groq y persistencia. `AsistirColaborativamente.ts:47-83` conserva mensajes humanos/IA idempotentes y publica resultados. `OrquestarInteraccionIA.ts` distingue asesoría/acción; `ConstruirContextoAsistenteColaborativo.ts` recupera conversación, actividad y modelo vivo. `orquestacionIA.test.ts` cubre referencias, equivalencia de recomendaciones, solicitudes intercaladas, ambigüedad, negación, fallos, stale y aislamiento; `asistente-contextual.spec.ts:40-282` prueba conversación, memoria, solicitud contextual, protección ante borrado ambiguo y colaboración en dos browsers. Prueba manual real: recomendó `correoElectronico: String` para `Socio`; el usuario dijo «Ejecuta» y CU04 añadió el atributo. **Dictamen:** sólido para alcance actual, con soporte real y simulado documentable. **Nunca afirmar** que una recomendación autoriza automáticamente modificar el modelo, ni que el nombre visible es identidad verificada.

## 4. Matriz de trazabilidad RF2-01 a RF2-14

| Requisito | CU principal | Evidencia primaria | Estado |
|---|---|---|---|
| RF2-01 Crear proyecto protegido | CU01 | `GestionarAccesoProyecto.ts` + API proyecto | Implementado |
| RF2-02 Unirse con código | CU01 | `unirseAProyecto` + E2E unión | Implementado |
| RF2-03 No descubrimiento global | CU01 | Sin ruta GET global; GET por ID protegido | Implementado |
| RF2-04 Identificar participante | CU01/CU03 | `autenticarAccesoProyecto.ts` + handshake WS | Implementado; identidad pseudónima |
| RF2-05 Compartir interacción IA | CU12/CU03 | `AsistirColaborativamente.ts` + E2E dos participantes | Implementado |
| RF2-06 Conservar contexto | CU12 | `ConstruirContexto...`, `Orquestar...`, regresiones | Implementado; contexto acotado |
| RF2-07 Consultar actividad | CU12 | `RegistrarActividadProyecto`, repositorios, preguntas históricas | Implementado; eventos manuales best-effort |
| RF2-08 Explicar NexoCASE | CU12 | `responderAyudaProductoDeterminista.ts`, E2E XMI | Implementado |
| RF2-09 Explicar UML | CU12 | Proveedor Groq + contrato, pruebas CU12 | Implementado; calidad lingüística variable |
| RF2-10 Revisar modelo | CU12/CU08/CU09 | Contexto modelo/validación/aptitud; E2E recomendación | Implementado |
| RF2-11 Ejecutar orden contextual | CU12/CU04 | Orquestador + prueba «Ejecuta» | Implementado |
| RF2-12 Aclarar ambigüedad | CU12/CU04 | `P6-03`, `P6-04`, tests de negación | Implementado |
| RF2-13 Persistir proyecto colaborativo | CU11 | Mongo, GET/PUT, E2E con base de prueba | Implementado |
| RF2-14 Conservar CU del primer parcial | CU02/CU05–CU10 | Tests de modelado/XMI/generación/visión | Implementado en perfiles soportados |

## 5. Registro priorizado de hallazgos y riesgos

### P1-SEC-01 — Groq voz/visión accesibles sin identidad de proyecto (confirmado)

**Fuente:** `ServidorGeneracionBackend.ts:53-55` registra las rutas antes y fuera de los middleware de proyecto. `registrarRutaTranscripcionVoz.ts:17-47` y `registrarRutaAnalisisImagen.ts:21-51` aceptan audio/imagen sin `Authorization` ni `projectId`. Ambas llaman a proveedores externos. **Atenuantes:** límite de 10 MB por archivo, formatos acotados, y para imagen firma MIME. El máximo de cuatro imágenes en UI es control local (`PanelModeladoDesdeImagen.tsx:10,47-53`), no límite servidor.

**Riesgo:** solicitudes HTTP anónimas desde scripts pueden consumir la cuota Groq, saturar recursos y afectar la demo. CORS solo restringe ciertos navegadores, no clientes HTTP directos. **No se ha constatado una fuga de contenido de proyectos** por estas rutas; procesan entradas enviadas por el solicitante.

**Recomendación mínima:** integrar un control de acceso por proyecto/credencial reutilizando `crearRequerirAccesoProyecto`, pasando la identidad de proyecto desde frontend, y agregar limitador por proyecto/participante en servidor para ambas rutas. Un simple límite de UI no soluciona el problema. Asegurar 401 sin credencial, 403 credencial ajena y no llamada a proveedor al rechazar. Mantener APIs de CU04/CU05 compatibles por cambios coordinados.

**Criterio:** Given una petición de voz o imagen sin credencial válida, When se recibe, Then el backend la rechaza antes de llamar a Groq; Given credencial del proyecto correcto, When envía archivo válido dentro de límites, Then funciona el flujo previo.

### P1-SEC-02 — Creación de proyectos pública sin limitador (confirmado; importancia según exposición)

**Fuente:** `registrarRutasProyectos.ts:42-54` permite crear proyectos sin tasa; solo el endpoint `/unirse` aplica `LimitadorIntentos` (`:56-79`). `LimitadorIntentos.ts:10-57` es en memoria por IP, con expiración. Crear proyectos debe seguir sin requerir cuenta, por regla de negocio, pero no es necesario permitir cantidades ilimitadas.

**Riesgo:** creación masiva de proyectos y participantes en base de datos públicamente accesible. **Solución mínima:** limitar `POST /api/proyectos` por origen/IP con controles coherentes con `/unirse`; monitorear 429 sin impedir uso académico normal. Para múltiples instancias, el limitador en memoria deja de ser global; documentarlo sin desplegar Redis injustificadamente.

### P1-OPS-03 — Blueprint Render incompleto para arranque Mongo (confirmado en código fuente; entorno remoto desconocido)

**Fuente:** `render.yaml:10-22` declara `GROQ_API_KEY` y `FRONTEND_ORIGIN`, pero no declara `MONGODB_URI` ni `PROJECT_ACCESS_PEPPER`; `ConexionMongo.ts:11-20` exige URI y `ProtegerAccesoProyecto.ts:10-13` exige pepper. `iniciarServidorGeneracionBackend.ts:53-61` los utiliza para arrancar en modo normal.

**Impacto:** un deployment creado *solo* a partir de ese manifiesto no queda completo, a menos que se configuren manualmente las variables obligatorias. **No se puede afirmar que el despliegue actual falla** sin acceder a sus variables/health. **Acción mínima:** añadir placeholders `sync:false` para `MONGODB_URI` y `PROJECT_ACCESS_PEPPER`, comprobar Mongo remoto/pepper sin revelar valores y documentar paso de provisión. `MONGODB_DB_NAME` es opcional (por defecto `nexocase`).

### P2-TRACE-04 — Eventos manuales o de integración pueden perderse sin señal al usuario

**Fuente:** `PaginaModeladoClases.tsx:70-92`: `registrarActividadModelado` y `registrarActividadIntegracion` se disparan con `void ... .catch(() => undefined)` mientras el cambio del modelo se aplica por otra vía. Si el servicio de eventos falla, la operación visual puede seguir y la autoría histórica quedar incompleta.

**Riesgo:** CU12 no podrá atribuir con certeza ciertos cambios aunque el modelo sí contenga el elemento. **No inventar autor** es comportamiento correcto. **Recomendación:** en F8 clasificar la trazabilidad como «por eventos confirmados» y evidenciar el comportamiento ante caída del registro; solo si el docente exige garantía de autoría completa, implementar reintento acotado con idempotencia o aviso de fallo. No introducir cola distribuida para el parcial sin un requisito real.

### P2-SCOPE-05 — Interoperabilidad XMI y Spring no cubren todo el UML editable

**Evidencia:** métodos se omiten en importación y se rechazan para exportación (`AdaptadorCrunchUML.test.ts:76-88`, `bridge_crunch_uml.py`); CU09 rechaza 1:1, N:M directo, generalización y asociaciones no soportadas (`EvaluadorAptitudGeneracionSpring.ts:112-135`). **No es defecto inadvertido**: código y pruebas hacen explícitos los límites. **Acción:** redactar claramente los perfiles y preparar dos modelos de demo: uno XMI compatible y otro Spring elegible. No «arreglar» estas capacidades ampliando UML sin tiempo ni necesidad.

### P2-QA-06 — Falta smoke externo de capacidades conservadas y código generado

**Evidencia presente:** pruebas unitarias y E2E deterministas; en backend existen scripts `probarVozGroqReal.ts`, `probarVisionGroqReal.ts`, `probarFlujoPostgreSQL.ts`, `probarSincronizacionFlutterPostgreSQL.ts`. **Evidencia ausente del ZIP/turno:** resultados actuales de voz Groq real, visión Groq real, compilación/arranque CRUD del Spring generado, y deployment público. No calificarlos como FAIL ni PASS hasta comprobar.

**Acción mínima:** ejecutar **una vez** cada smoke requerido para la defensa, con insumos pequeños y sin mostrar claves; recopilar resultado, fecha, entorno y hash de commit. Esto elimina incertidumbre con poco gasto de Groq.

### P2-DOC-07 — Configuración reproducible insuficientemente evidenciada

**Evidencia:** el ZIP omitió `backend/.env.example` por patrón de seguridad incluso cuando el nombre sea ejemplo; no hay README principal versionado de NexoCASE (el README encontrado pertenece al scaffold Flutter). F8 exige reproducibilidad. **Acción:** incluir un `.env.example` saneado en la siguiente auditoría o revisarlo localmente, y producir un `README`/runbook mínimo con Node, Mongo, Python crunch, comandos, variables y pasos de defensa. Nunca publicar credenciales.

### P2-QA-08 — Cobertura dirigida adicional, no un defecto del producto

**Evidencia:** CU08 tiene numerosas pruebas unitarias para diagnósticos, pero no se identifica un E2E específico de interfaz con error + corrección. Los 50 E2E cubren los flujos de usuario principales y todos aprobaron según la consola aportada. **Acción:** solo si se requiere una captura de verificación CU08, hacer un caso manual con nombre duplicado / relación incompleta y registrar resultado; no aumentar suite por rutina.

## 6. Lo que NO debe tratarse como bug

- **Sin login empresarial:** acceso por código y alias es decisión explícita `RN-PRO-05`; no se puede atribuir identidad legal.
- **Sin auto-guardado:** CU11 permite guardar manualmente, y Yjs es transporte, no persistencia durable.
- **IA no autónoma:** CU12 asesora; CU04 ejecuta únicamente ante instrucción humana clara.
- **No existe móvil obligatorio:** `Fase_1_Consolidacion_Alcance.md:78`; `flutter_exam_scaffold` es accesorio a la auditoría de 12 CU web.
- **Generación Spring/XMI limitados:** las restricciones son del perfil diseñado; presentar como «soporta todos los UML» sería incorrecto.

## 7. Plan de cierre F8, ordenado por riesgo/valor

| Orden | Acción | Responsable | Verificación mínima | Salida |
|---|---|---|---|---|
| 1 | Decidir si backend se expondrá públicamente durante defensa | Equipo/PO | URL real y alcance operativo | Riesgo contextualizado |
| 2 | Si es público: cerrar P1-SEC-01 y P1-SEC-02 | Backend + frontend | 401/403/429, Groq no invocado al rechazar; CU04/05 intactos | P1 seguridad resueltos |
| 3 | Validar blueprint/provisión MONGODB_URI y PEPPER | DevOps/Backend | Health de despliegue y reinicio sin perder proyecto | P1 operativo resuelto |
| 4 | Smoke voz/visión Groq reales con ejemplos pequeños | QA | 1 exitoso cada uno, logs sin secretos | Evidencia operacional |
| 5 | Smoke Spring generado con PostgreSQL o documentar alcance si no obligatorio | QA/Backend | Maven build y un CRUD de fixture soportado | Evidencia de ejecutabilidad |
| 6 | Registrar la limitación de XMI y la no garantía de eventos cuando red falla | PO/Documentación | Matriz de alcance y casos alternativos | Expectativas correctas |
| 7 | Matriz final de aceptación y revisión requisitos frente a release | PO/QA | 0 P0 y 0 P1 abiertos para el entorno elegido | Aprobación F8 |
| 8 | F9: documentación, tres partes académicas y guion de defensa | Equipo | Coincide 1:1 con versión defendida | Entrega final |

**Criterio de congelamiento:** Si hay backend accesible públicamente, no declarar F8 cerrada mientras permanezcan P1 conocidos sin control o aceptación explícita con mitigación. Si la defensa se hará exclusivamente en entorno local controlado, el riesgo de abuso externo disminuye, pero las limitaciones y omisiones deben quedar consignadas; no cambian automáticamente en defectos funcionales.

## 8. Conclusión PO

NexoCASE **no está incompleto por falta de casos de uso**: los doce existen y están conectados a rutas/flujo de producto. El núcleo colaborativo con IA y Mongo está considerablemente mejor sustentado que al comienzo de F7.1. Los puntos que impiden declarar «todo completamente auditado y perfecto» pertenecen sobre todo a **protección de recursos externos, configuración operativa, límites de interoperabilidad y evidencia de smoke de capacidades conservadas**.

La opción profesional **no es reescribir la plataforma**, sino resolver los P1 en el entorno que realmente se usará, realizar pocos smokes faltantes, congelar un commit y pasar a la documentación/defensa de F9. Esta conclusión se basa en código, documentación y resultados proporcionados; **no** equivale a una prueba en vivo de todo escenario posible.
