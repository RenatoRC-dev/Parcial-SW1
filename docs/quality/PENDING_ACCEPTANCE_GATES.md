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
