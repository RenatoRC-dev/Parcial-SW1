# F8-S2 — Compatibilidad UML / Spring

Auditoría estática del árbol actual. No se ejecutaron pruebas, builds, proveedores ni PostgreSQL. Las pruebas citadas se inspeccionaron: su existencia no equivale a un resultado actual. No se modificó producción. F8.1 histórico intacto.

## Actualización F8-S4 — paridad aprobada e implementada

El registro S2 y los deltas S3 siguientes son históricos. S4 cierra contradicciones verificadas sin ampliar UML/JPA:

| Hallazgo | Estado actual y fuente autoritativa |
|---|---|
| I3 | Resuelto: CU04 valida el resultado simulado con la función CU08 común. Money, null e id no Long existentes no impiden una edición independiente si el UML es válido. Crear/modificar tipos de atributo mediante IA sigue limitado a su lista anterior; no se añadió un tipo de dominio al canal. Convención Long queda en CU09. Pruebas nuevas de positivos/negativos, IDs, no mutación, 1:1 y generalización. |
| I4 | Resuelto: ConstruirContextoAsistenteColaborativo usa validarModelo y evaluarAptitudGeneracionSpring, cuyo perfil procede de prepararProyectoSpring. Diagnostica duplicados y mínimo 1..*; usa un único canónico completo o snapshot durable, no diagnósticos aportados por una vista resumida. Frontend reexporta esas funciones puras en sus rutas anteriores; sin dependencias de servidor en navegador. |
| I6 | Resuelto: se retiró el error de generación del validador UML para el modelo vacío. CU04 puede validar el borrado autorizado de la última clase; CU09 continúa bloqueando un backend sin entidades. Autorización, requester-only, idempotencia y Guardar explícito no se modificaron. |
| I7 | Parcial: descripción CU12 aclara autoridad CU08/CU09 y canal IA acotado. No se añadió catálogo nuevo ni se prometió JPA fuera del perfil existente. |

Fuente actual CU08: [ValidadorModeloUML.ts común](../backend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.ts). Se trasladó la función pura existente; el frontend conserva un reexport. Aptitud: función nueva en PrepararProyectoSpring que reutiliza la preparación real, también reexportada al frontend; elimina la réplica anterior. CU09 añade comprobación CU08 para no generar modelos con firmas inválidas. Sin cambios de CU05/XMI ni modelos/tipos/mapeos nuevos.

Evidencia S4 efectivamente ejecutada (no suites completas): **85 backend** = 14 compatibilidadUmlSpring.test.ts + 10 seleccionadas de orquestacionIA.test.ts (117 omitidas) + 61 de asistenteColaborativo.test.ts, ContextoProductoSW1.test.ts, interpretarInstruccionModelado.test.ts y GeneradorSpringBoot.test.ts. **79 frontend** = 59 CU08/aptitud + 14 procesarInstruccionIA/aplicarCandidatoImagen + 6 seleccionadas Apollon (22 omitidas). TypeScript --noEmit en ambos proyectos: exit 0; un acceso unknown en aserción previa S3 se ajustó sin cambiar su comportamiento. Sin builds, E2E, Groq, PostgreSQL ni repetición de proof:xmi.

Deltas sobre la matriz histórica: atributo conceptual existente IA04 pasa de REJECTED a PARTIAL (preservación, no creación de tipos nuevos); borrador vacío V pasa a SUPPORTED e IA04 admite resultado vacío autorizado, G sigue REJECTED; diagnóstico CU12 sigue la validez/aptitud autoritativas. Métodos, parámetros, XMI y perfil JPA conservan límites anteriores.

Próximo slice propuesto: F8-S5, validación integrada del frontend empaquetado y flujo CU04/CU12/Guardar con el módulo puro compartido, pendiente de aprobación. Enterprise Architect real y conformidad UML exhaustiva siguen UNVERIFIED; S1/S3 no prueban esos puntos.

## Actualización F8-S3 — aprobada e implementada (registro anterior)

**Cierre S3 verificado:** se extendió solo el proof de integración existente, probarFlujoXmi.ts, porque no comprobaba marcadores asociativos ni nombres. `npm run proof:xmi` terminó con exit 0: associativeClassMarkersPreserved, associationNamesPreserved, associativeRoundtripSemanticallyEquivalent, baseRoundtripSemanticallyEquivalent y legacyClassesRemainUnmarked en true, además de los indicadores anteriores. Evidencia: [roundtrip-evidence.json](../backend/generated-test-output/xmi-proof/roundtrip-evidence.json), con XML exportado/JSON importado base y asociativo en ese directorio. La comparación normaliza orden y normal legacy; conserva IDs y demás semántica del fixture.

En este cierre solo se ejecutaron ese proof y **6 pruebas seleccionadas del adaptador Apollon (22 omitidas)** para firmas/IDs/reordenación/negativos. Los resultados 29+32 de abajo son evidencia anterior, no suites repetidas. No se añadieron métodos a XMI. **realEnterpriseArchitectUsed=false**: no se verificó apertura/reexportación en EA real ni conservación por terceros de urn:nexocase:xmi:1; no equivale a soporte universal AssociationClass. Cierre local S3 completo; esa validación externa permanece pendiente.

El párrafo anterior, la matriz y los hallazgos originales describen S2. El PO autorizó después corregir I1/I2/I5 (no solo el guard inicialmente propuesto). Esta sección es el estado actual de esas filas; conserva la evidencia histórica sin presentar S2 como una ejecución de pruebas.

| Hallazgo | Estado actual / alcance verificado |
|---|---|
| I1 — marcador asociativo XMI | Resuelto para export→import NexoCASE: atributo XML tipoClase bajo urn:nexocase:xmi:1 en la clase con su ID. Sin extensión no se infiere marcador; namespace ajeno se ignora; valor propio desconocido se rechaza. XMI pasa de PARTIAL a SUPPORTED **para ese marcador propio**, no UML AssociationClass universal. |
| I2 — nombre de asociación | Resuelto: se recupera asociacion.name; prueba con & y comparación semántica completa. Nombre ausente sigue ausente. Preservación del nombre pasa a SUPPORTED en el perfil de asociaciones. |
| I5 — identidad de parámetros | Resuelto en canónico↔Apollon usando sw1Parametros por método: conserva ID al reordenar o cambiar tipo con nombre inequívoco; no asigna ID reservado a un nuevo parámetro. Metadata inválida avisa y no adopta IDs ambiguos; sin metadata conserva el fallback legacy. XMI de métodos/parámetros sigue REJECTED para exportación; no se amplió el perfil. |

Pruebas efectivamente ejecutadas en S3: **29 backend** (AdaptadorCrunchUML.test.ts, incluidos perfil/API previos y cuatro nuevos casos de ida/vuelta/negativos; ContextoProductoSW1.test.ts) y **32 frontend** (AdaptadorApollon.test.ts y PanelInteroperabilidadXmi.test.tsx). La primera comparación Spring detectó solo diferencias de orden de enumeración; se compara preparación con orden canónico normalizado, sin cambiar generador ni prometer orden idéntico de artefactos/endpoints. El modelo original queda intacto.

Guía UI es/en y descripción de capacidad CU12 explican que terceros pueden omitir la marca propia; no anuncian soporte nuevo de métodos XMI. Sin Groq, E2E, build, PostgreSQL ni suite completa; S1 no repetido. Persistencia colaborativa y herramientas externas requieren validación independiente. I3/I4/I6 e I7 general permanecen pendientes; ningún otro constructo JPA aprobado.

## Evidencia y alcance de F8-S1 CLOSED

[runtime-evidence.json](../backend/generated-test-output/postgres-proof-31346ea5beed46128f8142b108b92a7e/runtime-evidence.json) leído: PostgreSQL 16.13, Maven, Spring, tres tablas, PK compuesta de dos columnas, ambas FK, ausencia de ID sustituto y todos los indicadores CRUD en true. Código de salida 0 aportado por el PO; el JSON no contiene el exit code. No se repitió la prueba.

Esto acredita el fixture Usuario/Rol/UsuarioRol: atributos Long/String, dos asociaciones 1 ↔ 0..*, entidad asociativa, actualización/lectura/borrado de Usuario y creación/lectura/borrado de UsuarioRol. No acredita UPDATE de la identidad compuesta, CRUD de todos los tipos ni todos los modelos generables. Fuente del alcance: [fixtureClaseAsociativa.ts](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/fixtureClaseAsociativa.ts) y [probarFlujoPostgreSQL.ts](../backend/src/paquetes/generacion_backend/pruebas_runtime/probarFlujoPostgreSQL.ts).

## Fuentes acotadas

Identificadores usados en las matrices (prueba homónima significa archivo .test.ts del mismo directorio):

- **D:** [ModeloUMLCanonico.ts](../frontend/src/nucleo/modelo_uml/ModeloUMLCanonico.ts); [ContratoModeloUMLCanonico.ts](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/ContratoModeloUMLCanonico.ts).
- **E:** [InspectorPropiedadesUML.tsx](../frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/InspectorPropiedadesUML.tsx), [AdaptadorApollon.ts](../frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/AdaptadorApollon.ts) y prueba homónima (cuatro relaciones, abstracción, visibilidad, métodos y parámetros).
- **V:** [ValidadorModeloUML.ts](../frontend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.ts) y prueba homónima: tipo Money válido, id no Long delegado a generación, métodos limitados, autorrelación rechazada, modelo vacío inválido.
- **G:** [PrepararProyectoSpring.ts](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.ts); [GeneradorSpringBoot.test.ts](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/GeneradorSpringBoot.test.ts); [GeneradorRelacionesUnoAMuchos.test.ts](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/GeneradorRelacionesUnoAMuchos.test.ts); [GeneradorClaseAsociativa.test.ts](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/GeneradorClaseAsociativa.test.ts).
- **J:** [Entidad.java.ejs](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/plantillas/Entidad.java.ejs), [ServiceImpl.java.ejs](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/plantillas/ServiceImpl.java.ejs), [Controller.java.ejs](../backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/plantillas/Controller.java.ejs).
- **F:** [EvaluadorAptitudGeneracionSpring.ts](../frontend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/EvaluadorAptitudGeneracionSpring.ts), prueba homónima y [PanelGeneracionSpring.tsx](../frontend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PanelGeneracionSpring.tsx).
- **X:** [AdaptadorCrunchUML.ts](../backend/src/paquetes/interoperabilidad/compartido/crunch_uml/AdaptadorCrunchUML.ts), prueba homónima; [bridge_crunch_uml.py](../backend/src/paquetes/interoperabilidad/compartido/crunch_uml/bridge_crunch_uml.py), funciones importar/exportar. Se revisó el puente propio, no se auditó toda la biblioteca externa.
- **A4:** [ProveedorGroq.ts](../backend/src/paquetes/asistencia_ia/compartido/proveedores/groq/ProveedorGroq.ts), instrucciones; [validarPlanCambiosUML.ts](../backend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/validarPlanCambiosUML.ts), validarModeloResultado; [interpretarInstruccionModelado.test.ts](../backend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/interpretarInstruccionModelado.test.ts); [normalizarSemanticaAsistida.ts](../backend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/normalizarSemanticaAsistida.ts).
- **A5:** [ProveedorVisionGroq.ts](../backend/src/paquetes/asistencia_ia/compartido/proveedores/vision/groq/ProveedorVisionGroq.ts), instrucciones; [validarCandidatoModeloUML.ts](../backend/src/paquetes/asistencia_ia/casos_uso/cu05_modelar_desde_imagen/validarCandidatoModeloUML.ts) y prueba homónima; [evaluarAtributoCandidato.ts](../frontend/src/paquetes/asistencia_ia/casos_uso/cu05_modelar_desde_imagen/evaluarAtributoCandidato.ts), [aplicarCandidatoImagen.ts](../frontend/src/paquetes/asistencia_ia/casos_uso/cu05_modelar_desde_imagen/aplicarCandidatoImagen.ts) y prueba homónima; PanelModeladoDesdeImagen.tsx del mismo directorio.
- **A12:** [ConstruirContextoAsistenteColaborativo.ts](../backend/src/paquetes/asistencia_contextual/casos_uso/cu12_asistir_usuario/ConstruirContextoAsistenteColaborativo.ts), evaluarModelo; [ProveedorAsistenteContextualGroq.ts](../backend/src/paquetes/asistencia_contextual/compartido/proveedores/groq/ProveedorAsistenteContextualGroq.ts), instrucciones; [ContextoProductoSW1.ts](../backend/src/paquetes/asistencia_contextual/compartido/ContextoProductoSW1.ts) y prueba homónima; [ContextoAsistente.ts](../frontend/src/paquetes/asistencia_contextual/casos_uso/cu12_asistir_usuario/ContextoAsistente.ts).

## Matriz histórica S2 (aplicar deltas S3 anteriores)

**S = SUPPORTED**, **P = PARTIAL**, **R = REJECTED**, **U = UNVERIFIED**. Clasificación por canal y para el perfil descrito, no conformidad UML universal. E=editor/adaptador, D=dominio canónico, V=CU08, X=XMI ida/vuelta, IA=CU04/CU05/CU12, G=transformación Spring. Evidencia indica código/pruebas inspeccionadas; solo «runtime S1» denota ejecución real acreditada. En CU12 P significa consejo/contexto disponible con límites; exactitud del LLM por constructo U, sin prueba real. En tipos, X:P significa transporte textual sin demostrar round-trip de cada tipo.

| Capacidad | E | D | V | X | IA 04/05/12 | G | Evidencia / límite |
|---|---|---|---|---|---|---|---|
| String | S | S | S | S | S/S/P | S | D,E,V,X,G; runtime S1 |
| int/Integer, long/Long | S | S | S | P | S/S/P | S | G convierte primitivos a wrappers; id Long runtime S1; int tiene prueba de mapeo |
| float/Float, double/Double, Decimal/BigDecimal | S | S | S | P | S/S/P | S | G: Decimal→BigDecimal, resto wrapper; prueba Decimal; CRUD por tipo U |
| boolean/Boolean | S | S | S | P | S/S/P | S | D,V,G,J; wrapper Boolean; runtime específico U |
| Date/LocalDate, DateTime/LocalDateTime | S | S | S | P | S/S/P | S | G: fechas Java time; pruebas de alias; zona horaria/CRUD U |
| UUID como atributo | S | S | S | P | S/S/P | S | G importa java.util.UUID; prueba de mapeo; runtime U |
| byte, short, char y otros primitivos | P | S | S | P | R/R/P | R | Texto libre Apollon, sin opción inspector; V no restringe tipos de atributos; fuera de listas G/A4/A5 |
| Enum como metaclase/literales | U | R | R | R | R/R/U | R | D carece de enum; E rechaza estereotipos; X importa con ENUMERACION_OMITIDA; no @Enumerated |
| Money, Estado u otro tipo de dominio textual | P | S | S | P | R/R/P | R | V prueba Money válido; G prueba rechazo; A4 valida todo el resultado contra su lista; A5 no lo incorpora |
| List<T>, Set<T>, arrays como atributo | P | P | S | U | R/R/P | R | Solo cadena de tipo, sin semántica colección en D; las List generadas por relaciones no acreditan atributos colección |
| Atributo sin tipo | P | S | S | S | R/R/P | R | V advierte; E/X preservan null; A5 lo muestra pero omite al aplicar con aviso; G bloquea |
| id explícito Long | S | S | S | S | S/S/P | S | G no duplica id, IDENTITY; S1 confirma PK; X como atributo simple |
| id String/UUID u otro tipo admitido | S | S | S | P | R/R/P | R | V delega convención; G/A4/A5 exigen Long; UUID atributo ≠ UUID PK |
| Asociación 1↔1 / 0..1↔1 / 0..1↔N | S | S | S | S | S/S/P | R | E,V,X perfil asociaciones; F/G rechazan fuera de 1↔N; prueba G de 1:1; sin @OneToOne |
| Asociación 1↔0..*, ambas orientaciones | S | S | S | S | S/S/P | S | G pruebas orientación/FK/roles; runtime S1 en fixture asociativo |
| Asociación 1↔1..* | S | S | S | S | S/S/P | P | G y X pruebas Factura/Detalle; F advierte: mínimo de colección no garantizado; runtime U |
| Asociación N↔M directa (incluye 1..*↔*) | S | S | S | S | S/S/P | R | X prueba 0..*↔0..*; otras variantes mismo perfil; G exige conversión explícita, no @ManyToMany |
| Multiplicidades incompletas / rangos arbitrarios | P | P | P | P | P/R/P | R | D solo 1,0..1,0..*,1..*,null; V advierte null; X export exige completas, import degrada rango con aviso |
| Agregación | S | S | S | P | S/R/P | R | E round-trip; X import interpreta todo/parte, export rechaza; A5 omite con advertencia |
| Composición | S | S | S | P | S/R/P | R | Igual; no soporte de ciclo de vida/cascade/orphanRemoval; exclusión G explícita |
| Generalización / herencia | S | S | P | P | S/R/P | R | E y V prueban dirección y ausencia de cardinalidades; X import probado, export rechaza; ciclos de herencia U |
| Autorreferencia | P | S | R | P | R/P/P | R | E inspector impide origen=destino; D puede representarla; V/A4/G rechazan todas; X no la prohíbe explícitamente, preservación U |
| Clase concreta normal | S | S | S | S | S/S/P | S | D,E,X,G; runtime S1 |
| Clase abstracta | S | S | S | P | S/R/P | R | E isAbstract; X importa con prueba, export rechaza; A5 aplica abstracta=false |
| Clase asociativa acotada | S | S | S | P | S/R/P | S | G exige dos principales distintas y relaciones 1↔0..*; PK compuesta runtime S1; X pierde tipoClase (I1) |
| Interfaces / estereotipos generales | U | R | R | U | R/R/U | R | D solo normal/asociativa; E omite nodo con estereotipo y avisa; sin contrato general de interfaz |
| Visibilidad atributo + - # ~ | S | S | S | S | S/S/P | P | E/X pruebas preservación; J campos siempre privados con getters/setters, decisión probada G |
| Operaciones +/-, retorno escalar/void | S | S | S | R | S/R/P | P | E,V pruebas; X export rechaza/import omite con aviso; G genera CRUD pero no métodos de dominio |
| Parámetros de operaciones | P | S | S | R | S/R/P | P | E conserva nombre/tipo pero regenera IDs (I5); V restringe tipos; sin cuerpos ni firmas de negocio en Java |
| Nombre asociación / roles | S | S | S | P | P/P/P | P | G usa roles para campos, nombre no determina FK; X recupera roles pero no nombre (I2); texto LLM específico U |
| Modelo sin elementos | S | S | R | U | R/R/P | R | E admite vacío; V prueba inválido, A4 exige al menos una clase; contradicción con regla de borrador válido (I6) |

## Semántica Java/JPA, UML y experiencia

- J/G: PK Long IDENTITY para clase normal, ID implícito si falta; asociativa usa EmbeddedId/MapsId y dos FK. S1 acredita ese esquema y flujo, no todos los tipos ni escenarios de error.
- J: FK ManyToOne optional=false y JoinColumn nullable=false hacia el extremo 1; lado colección OneToMany(mappedBy), JsonIgnore y ArrayList, sin cascadas. No hay enforcement del mínimo 1..* en el padre; F lo comunica. Borrar padre referenciado, FK inexistente y cambio de componentes PK: runtime UNVERIFIED.
- J: atributos con @Column sin reglas de negocio nullable/unique/longitud/precisión declaradas en D; no prometer esas restricciones. Servicios copian campos/relaciones al actualizar; endpoints CRUD no implementan operaciones UML ni validación de negocio inferida.
- E/D: asociación sin navegabilidad, origen=parte/destino=todo y origen=subclase/destino=superclase; símbolos de visibilidad, firma nombre(parámetros): Retorno, cuatro multiplicidades. Son evidencia de un subconjunto de notación, no certificación completa UML 2.5. Namespace XMI 2.1 no demuestra ni refuta por sí solo versión UML 2.5. Presentación visual de rombos/flechas, asociación-clase formal, ciclos y conformidad normativa exhaustiva: UNVERIFIED en S2.
- F ya separa válido UML de apto Spring, muestra bloqueos concretos y advierte mínimo de colección; deshabilita Generar cuando no es apto. Aceptar 1:1, herencia o Money como UML y bloquear Spring es comportamiento correcto del producto, no defecto por sí mismo.
- A4 permite cuatro relaciones y firmas; lista de tipos y validación global imponen restricciones adicionales. A5 es más limitado: solo asociaciones y clases concretas sin operaciones; advierte construcciones omitidas y atributos no importables en el candidato, requiere confirmación. No equivale al editor completo.
- A12 recibe modelo/aptitud y ordena distinguir UML, Spring y negocio; ContextoProductoSW1 anuncia generación condicionada. No se encontró una promesa explícita de JPA universal. Falta detalle de perfil en la ayuda estática y su diagnóstico derivado tiene I4. La exactitud real CU04/CU05/CU12 por cada caso queda UNVERIFIED; no se hicieron llamadas Groq.

## Inconsistencias priorizadas en S2 (I1/I2/I5 resueltos arriba)

| ID / prioridad | Evidencia estática y consecuencia | Coste / riesgo / decisión |
|---|---|---|
| I1 P0 | X validarAptitudExportacionXmi admite tipoClase asociativa; bridge exportar crea db.Class genérica e importar no devuelve tipoClase. El marcador se pierde sin aviso, pudiendo regenerar una PK Long sustituta en vez de PK compuesta. Pruebas X no cubren ese campo. | Bajo coste bloquear exportación incompatible; riesgo bajo. Preservación interoperable completa requiere decisión de perfil. Primero integridad, después amplitud JPA. |
| I2 P1 | bridge exportar escribe nombre de asociación; importar construye relación sin nombre. Prueba X usa objectContaining sin exigir nombre. | Bajo coste/riesgo; recuperar nombre y exigir round-trip exacto cuando se autorice. |
| I3 P1 | V acepta Money, null e id no Long; A4 validarModeloResultado examina TODAS las clases y exige tipo de lista e id Long. Una edición independiente sobre un modelo manual/XMI válido puede bloquearse por un atributo ajeno al cambio. | Riesgo/coste medio: separar validez UML y elegibilidad también en CU04 sin debilitar IDs, atomicidad ni seguridad; no ampliar tipos automáticamente. |
| I4 P1 | A12 evaluarModelo diagnostica solo atributos sin tipo; devuelve errores=[]/valido aunque haya nombres duplicados, extremos inexistentes u otros errores CU08. Además omite advertencia 1..* al evaluar con G. Un mismo UML vivo puede recibir diagnósticos distintos de V/F. | Coste/riesgo medio: paridad de diagnóstico sobre una versión, sin confiar en diagnosis obsoleta del cliente ni degradar seguridad. |
| I5 P1 | E interpretarMetodo genera id de parámetro como metodoId:parametro:indice. La prueba de ida/vuelta compara nombre/tipo con objectContaining, no IDs. Reordenar/reconvertir puede cambiar identidad de parámetros. | Coste medio; riesgo de atribución/referencias, impacto real colaborativo U. Exigir preservación antes de refactorizar. |
| I6 P1 | Regla permanente: cero elementos válido. V prueba modelo vacío inválido y A4 rechaza resultado sin clases; G debe seguir bloqueado sin entidades. | Coste bajo/medio; aclarar validez del borrador frente a condición para generar, conservando autorización destructiva. No cambiar regla permanente para encubrir implementación. |
| I7 P2 | Ayuda A12 expone generación condicionada pero no enumera límites; E permite diseño que X solo importa y no reexporta. F muestra límites Spring correctamente. | Coste bajo, riesgo bajo: explicar perfiles/rechazos, sin más llamadas IA. No afirmar que ya promete soporte universal. |

Prioridades de ampliación: **P1** 1:1 como candidato de valor (modelo de negocio común), solo tras resolver integridad y decidir propietario, opcionalidad, UNIQUE de FK, endpoints y round-trip; **P2** otros tipos/colecciones, herencia, agregación/composición JPA por coste y semántica de ciclo de vida. No hay exigencia del profesor que convierta automáticamente todo UML válido en CRUD generable. Pruebas de tipos/relaciones nuevos requerirán runtime propio, no reutilizar S1 como prueba universal.

## Propuesta histórica S2 — sustituida por aprobación S3 anterior

**Objetivo mínimo:** cerrar I1 sin ampliar UML/JPA: rechazar explícitamente la exportación XMI de clases asociativas mientras el perfil no preserve el marcador. Mantener importación y proyectos existentes; sin convertirlas a normales. Alternativa de preservación mediante perfil XMI requiere aprobación separada. I2–I7 quedan fuera de este slice inicial.

Componentes afectados: validarAptitudExportacionXmi y sus pruebas; verificar propagación del error por CU07 y panel XMI; ayuda CU12 limitada a describir esa restricción. Generador, CU08 y esquema canónico sin cambios previstos; CU04/CU05, Yjs, Mongo y CU11 deben permanecer intactos.

- **Given** Usuario/Rol/UsuarioRol con tipoClase asociativa, **When** se exporta XMI, **Then** error explícito identifica la clase y el límite; no se descarga un XMI degradado, no cambia el modelo ni se guarda automáticamente.
- **Given** ese mismo modelo, **When** se evalúa o genera Spring, **Then** conserva elegibilidad y PK compuesta; la restricción XMI no altera CU09.
- **Given** clases normales y asociaciones del perfil XMI, **When** se exporta/reimporta, **Then** se conserva el comportamiento existente, sin activar reglas Spring durante XMI.
- **Given** se consulta al asistente por esa exportación, **When** ofrece orientación, **Then** explica el límite sin recomendar borrar el marcador, transformar el modelo sin permiso ni prometer preservación inexistente.

Verificación propuesta al aprobar: pruebas focalizadas del guard/API y estado UI existente; no proof PostgreSQL nuevo para un guard XMI. No implementado ni ejecutado en S2.

## Preguntas y límites originales S2 (actualización S3 arriba)

- ¿PO aprueba primero el guard de integridad I1 o prefiere definir interoperabilidad real de AssociationClass? No inferir una PK ni estereotipo estándar sin acordar perfil.
- ¿Qué subconjunto visual UML 2.5 se demostrará académicamente? Falta evidencia visual/normativa específica; no ampliar el alcance a todo UML.
- No se ejecutó repro de I1/I2/I3/I4/I5/I6: son hallazgos trazables al código, no resultados de runtime nuevos. En XMI las importaciones externas dependen del dialecto y biblioteca; tipos arbitrarios y autorreferencias no tienen prueba específica revisada.
- Congelar declaraciones de compatibilidad al caso S1; fechas, UUID, decimales, obligatoriedad 1..*, errores FK y operaciones de negocio necesitan evidencia propia si se anuncian como runtime verificado.
