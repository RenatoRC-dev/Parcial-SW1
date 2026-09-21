# Pending Acceptance Gates

Central register for implemented functionality that still requires external or manual acceptance evidence.

At the beginning of future iterations, agents should review this file. Open gates do not block unrelated development and do not authorize automatic fixes. They must be mentioned in the final iteration report/status, should be suggested again near exam readiness, release readiness, final integration, or documentation freeze, and may only be closed with actual acceptance evidence.

## EA-XMI-001 — Real Enterprise Architect bidirectional XMI acceptance

- **Related package:** Interoperabilidad
- **Related use cases:** CU06 — Importar modelo desde Enterprise Architect; CU07 — Exportar modelo hacia Enterprise Architect
- **Origin:** Iteration 08
- **Current status:** **OPEN — EXTERNAL ACCEPTANCE PENDING**

### Internal evidence already completed

- The real `crunch_uml` adapter works.
- Canonical → XMI → canonical round-trip passes.
- Classes and attributes are preserved.
- The supported `1 ↔ 0..*` association is preserved.
- Multiplicities and roles are preserved.
- Canonical → Apollon works, and the imported model is editable.
- Browser XMI import/export E2E passes.

### External acceptance still required

**Direction A — SW1 → Enterprise Architect**

1. Export `modelo.xmi` from SW1.
2. Import it into real Sparx Enterprise Architect.
3. Verify `Cliente`, `Pedido`, their attributes, the association, multiplicities `1` and `0..*`, and roles `cliente` / `pedidos`.
4. When the SW1 XMI bridge gains operation support, also verify a real UML operation name, visibility, return type and typed parameter; the current `crunch_uml` bridge does not preserve operations and no substitute encoding is accepted.
5. Record the Enterprise Architect version and XMI import option.
6. Save screenshots and evidence.

**Direction B — Enterprise Architect → SW1**

1. Create the equivalent model in real Enterprise Architect.
2. Export it as XMI.
3. Import the EA-produced XMI through CU06.
4. Verify equivalent supported semantics in Apollon.
5. When operation support exists in the bridge, verify that an EA-produced operation retains its visibility, return type and typed parameters in SW1.
6. Edit one imported class to prove that the model is live and editable.
7. Save evidence.

### Compatibility note

The current `crunch_uml` renderer emits exchange content declaring XMI 2.1 and a UML 2.1 namespace. This must not be confused with the project's UML 2.5+ conceptual notation requirement. Do not modify these namespaces speculatively; any compatibility correction must be driven by real Enterprise Architect evidence.

### PASS condition

Both directions must pass using real Enterprise Architect. Only then may `EA-XMI-001` be changed to `CLOSED` and Iteration 08 be changed to `PASS`.

## GROQ-AI-001 — Real Groq structured-output acceptance

- **Related package:** Asistencia Inteligente
- **Related use case:** CU04 — Modelar mediante inteligencia artificial
- **Origin:** Iteration 10
- **Current status:** **CLOSED — REAL GROQ ACCEPTANCE PASS**

### Internal evidence already completed

- Server-side provider boundary and Groq SDK adapter are implemented.
- Strict closed JSON Schema, deterministic plan validation and atomic execution are tested.
- Automatic apply, ambiguity blocking, stale-response protection and one automatic replan pass.
- Real Apollon browser application and AI → Yjs → collaborator propagation pass using the injected deterministic E2E provider.

### External acceptance evidence

- `npm run proof:ia:groq` completed against real Groq.
- `realGroqUsed = true`.
- `model = openai/gpt-oss-20b`.
- `structuredOutput = true`.
- `semanticValidation = true`.
- `expectedCommandReceived = true`.

No API key or secret value is recorded.

### PASS condition

Satisfied. The real command completed successfully and returned the expected validated incremental command.

## GROQ-VOICE-001 — Real Groq voice transcription acceptance

- **Related package:** Asistencia Inteligente
- **Related use case:** CU04 — Modelar mediante inteligencia artificial, voice input channel
- **Origin:** Iteration 11
- **Current status:** **CLOSED — REAL GROQ VOICE ACCEPTANCE PASS**

### Internal evidence already completed

- Push-to-talk recording uses the browser MediaRecorder boundary and a 30-second maximum.
- Audio is uploaded to the CASE backend and passed through `ProveedorTranscripcionAudio`.
- Deterministic browser evidence proves transcript visibility, automatic CU04 reuse, real Apollon application and Yjs collaboration propagation.
- Normal tests do not call real Groq.

### External acceptance evidence

- `npm run proof:voz:groq` completed against real Groq using a real Spanish audio fixture.
- `realGroqVoiceUsed = true`.
- `model = whisper-large-v3-turbo`.
- `transcriptionReceived = true`.
- `semanticCondition = true`.

No API key, secret value or local fixture path is recorded.

### PASS condition

Satisfied. The real command completed successfully against Groq Whisper using real audio and passed the semantic transcription condition.

## GROQ-VISION-001 — Real Groq vision acceptance

- **Related package:** Asistencia Inteligente
- **Related use case:** CU05 — Obtener modelo UML a partir de imagen
- **Origin:** Iteration 12
- **Current status:** **CLOSED — REAL GROQ VISION ACCEPTANCE PASS**

### Internal evidence already completed

- Image analysis is server-side behind `ProveedorVisionUML`.
- Deterministic tests prove bounded PNG/JPEG upload, candidate validation, preview-before-mutation, explicit confirmation, additive canonical application, Apollon rendering and Yjs propagation.
- Normal tests do not call Groq.
- Direct account diagnostics established that `qwen/qwen3.6-27b` is unavailable, while `qwen/qwen3.8-27b` accepts the vision request when `max_tokens: 512` is explicit. The production boundary now uses that verified default and budget.

### External acceptance evidence

- `npm run proof:imagen:groq` completed successfully against the real Groq API using a real PNG/JPEG UML fixture.
- `realGroqVisionUsed = true`.
- `model = qwen/qwen3.8-27b`.
- `candidateReceived = true`.
- `containsClassFactura = true`.
- `containsNumero = true`.
- `containsTotal = true`.
- `numeroTypeRecognized = true`.
- `totalTypeRecognized = true`.
- `semanticCondition = true`.

No API key, organization identifier, secret value or local fixture path is recorded.

### PASS condition

Satisfied. The real proof used `qwen/qwen3.8-27b` with the application's bounded `max_tokens: 512` configuration and confirmed `Factura`, `numero: String` and `total: Double`, including both exact trimmed types.

## GROQ-CONTEXT-001 — Real Groq contextual-assistant acceptance

- **Related package:** Asistencia Contextual
- **Related use case:** CU12 — Asistir contextualmente al usuario
- **Origin:** Iteration 14
- **Current status:** **CLOSED — REAL GROQ CONTEXTUAL ACCEPTANCE PASS**

### External acceptance evidence

- `npm run proof:contexto:groq` completed successfully with the production CU12 provider against real Groq.
- `realGroqContextUsed = true`.
- `model = openai/gpt-oss-20b`.
- `structuredOutput = true`.
- `responseReceived = true`.
- `explainsGenerationBlocked = true`.
- `mentionsManyToManyOrAssociativeClass = true`.
- `doesNotClaimUmlInvalid = true`.
- `suggestedActionIsWhitelisted = true`.
- `noModelMutation = true`.
- `semanticCondition = true`.

No API key, authorization header, or secret value is recorded.

### PASS condition

Satisfied. Real Groq explained the actual direct N:M generation blocker from authoritative application context, suggested an allowed action, preserved the UML-valid distinction, and did not mutate product state.

## FLUTTER-LOCAL-AI-001 — Physical Android offline LLM acceptance

- **Related package:** Flutter exam scaffold
- **Related capability:** Local on-device command interpretation
- **Origin:** Iteration 15
- **Current status:** **PASS — PHYSICAL OFFLINE AI ACCEPTED**

### Internal evidence already completed

- `LocalAiEngine` isolates business/application code from the selected llama.cpp plugin.
- `llama_flutter_android` `0.2.6` is pinned and an ARM64 Android debug APK builds successfully.
- Qwen3 bounded command extraction uses its hard non-thinking assistant prefix plus a neutral JSON syntax prefill.
- Deterministic JSON extraction, action whitelist, field validation, controlled rejection, thinking-wrapper handling, prompt construction, and per-command context cleanup pass 14 focused tests.
- GGUF model weights are excluded from Git and runtime model downloading is not implemented.
- A Xiaomi ARM64 device loaded the 428,970,080-byte model in roughly 2–3 seconds and ran inference in airplane mode, proving local execution. Physical attempt 1 remains semantically failed because the model emitted the unsupported action `correcto`; prompt strengthening and deterministic sampling alone had not corrected it.
- Physical Test 2.0 produced `crear_cliente`, `crear_producto`, and `consultar_clientes` correctly in sequence. It then exposed KV-cache accumulation: `g_n_past` grew from roughly 202 to 852 and an unsupported mail request hallucinated a client. The same request was correctly rejected after process restart returned the first inference to roughly 200 tokens. The adapter now invokes the plugin's public context reset before every command while retaining the loaded model.
- Physical Test 2.1 passed on the real Xiaomi ARM64 device under airplane mode, without Groq, remote inference, or PC-hosted inference. Each command logged `Context cleared, g_n_past reset to 0`; `crear_cliente`, `crear_producto`, and `consultar_clientes` were validated, and the subsequent unsupported mail request remained unsupported without restarting the application.
- The model stayed loaded while only KV/context state was cleared between requests.

### Real acceptance evidence

- `crear_cliente`: PASS — Ana / `ana@correo.com`.
- `crear_producto`: PASS — Laptop / 3500.
- `consultar_clientes`: PASS — empty parameters.
- Unsupported mail request: PASS — controlled rejection with no invented data after the three preceding commands.
- Unsupported-result duration currently displays `- ms` because validation failures do not return a normal timing result; this is a non-blocking observability limitation.
- SQLite, REST synchronization, offline queueing, and local voice were not part of this gate and remain deferred.

### PASS condition

Satisfied. Physical Android inference works without networking; supported Spanish commands produce validated structured actions, the unsupported request is safely rejected after sequential commands, and inference context is cleared between requests without unloading the model. Iteration 15 is `PASS` for its defined technical-spike scope.

## FLUTTER-OFFLINE-PERSISTENCE-001 — Physical Android offline persistence acceptance

- **Related package:** Flutter exam scaffold
- **Related capability:** Durable local operations and synchronization outbox
- **Origin:** Iteration 16
- **Current status:** **PASS — PHYSICAL OFFLINE PERSISTENCE ACCEPTED**

### Internal evidence already completed

- Validated `crear_cliente` and `crear_producto` commands store their entities and exactly one pending outbox operation in an atomic SQLite transaction.
- `consultar_clientes` reads local durable data and does not enqueue an operation.
- Unsupported output is rejected before persistence, and a simulated outbox failure rolls back the entity insert.
- SQLite FFI tests confirm data and outbox records survive closing and reopening the database.
- The UI exposes local results and the count of pending synchronization operations.

### Real acceptance evidence

- Real Xiaomi ARM64 device, Android 16 / API 36, airplane mode, local Qwen3 GGUF, and no Internet dependency.
- Ana was created locally and the pending count changed from zero to one.
- A local client query returned Ana without adding an outbox record.
- Laptop was created locally and the pending count changed from one to two.
- After fully closing and reopening the application, the pending count remained two.
- After reloading the local model, Ana remained queryable from SQLite and the pending count still remained two.
- The post-restart local query completed successfully in approximately 28.383 seconds.
- Spring REST integration, outbox delivery, reconnect synchronization, retry processing, conflict resolution, background synchronization, and local voice remain outside this accepted scope.

### PASS condition

Satisfied. Physical airplane-mode execution confirmed durable SQLite business data and pending outbox state across application restart, transactional offline creation, and read-only local querying. Iteration 16 is `PASS` for its defined offline-persistence scope.

## FLUTTER-SPRING-SYNC-001 — Physical Flutter-to-Spring/PostgreSQL synchronization acceptance

- **Related package:** Flutter exam scaffold / generated Spring backend
- **Related capability:** Durable outbox delivery to the SW1-generated REST API
- **Origin:** Iteration 17
- **Current status:** **PASS — PHYSICAL END-TO-END SYNC ACCEPTED**

### Internal evidence already completed

- Flutter sync uses the generated `POST /api/cliente` and `POST /api/producto` contracts through an application-owned `BackendApi` boundary.
- Eligible pending/error operations are processed FIFO; successful delivery atomically records the remote ID and synchronized entity/outbox states.
- Failures preserve local data, increment attempts, retain the operation with a useful error, and permit later retry.
- SQLite version 2 adds nullable remote IDs and persisted backend URL configuration without dropping Iteration 16 data.
- Focused Flutter suite: 29/29 PASS; `flutter analyze` and Android debug build PASS.
- The production SW1 generator created the Cliente/Producto Spring project and its `mvnw.cmd clean test` passed.
- The automated proof initially encountered a session-local missing PostgreSQL credential; subsequent physical acceptance supplied the authoritative generated-Spring/PostgreSQL runtime evidence.

### Physical acceptance evidence

- A real Xiaomi Android device reached the generated backend over LAN at `http://192.168.0.8:8080` and database `sw1_flutter_sync`.
- The phone retried the preserved Ana and Laptop operations after an incorrect backend URL had moved both to `error`.
- After correcting the URL, state changed from pending zero / synchronized zero / errors two to pending zero / synchronized two / errors zero.
- PostgreSQL contained the expected Ana and Laptop rows through generated `POST /api/cliente` and `POST /api/producto` routes.
- The two rows per table corresponded to one backend-proof dataset and one physical Flutter dataset, not duplicate mobile delivery.
- An immediate extra synchronization delivered zero operations and did not change PostgreSQL counts.
- After fully restarting Flutter, synchronized state remained durable and another synchronization again delivered zero operations.
- Synchronization worked without requiring the local AI model to be loaded.

### PASS condition

Satisfied. Physical Flutter-to-generated-Spring/PostgreSQL synchronization, controlled retry after configuration failure, durable synchronized state, remote persistence, and no resend before or after application restart were all confirmed. Iteration 17 is `COMPLETE / PASS` for its defined manual synchronization scope.
