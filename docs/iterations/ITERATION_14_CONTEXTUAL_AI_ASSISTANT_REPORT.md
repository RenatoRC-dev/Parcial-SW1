# Iteration 14 — Contextual AI Assistant

## 1. Objective

Implement CU12 as an interactive guide for the Software Designer. CU12 explains the current CASE state and suggests a next action; it never modifies the UML model or executes product operations.

## 2. Business Package and Use Case

- Package: Contextual Assistance
- Use case: CU12 — Contextually assist the user

CU12 is separate from CU04: CU04 executes validated UML commands, while CU12 only explains and guides.

## 3. Deterministic Truth vs AI Explanation

The frontend derives authoritative facts from the active project, canonical model, CU08 validation, CU09 generation readiness, unsaved state, and pending CU05 candidate. Groq receives this compact context and produces only an explanation plus a whitelisted suggested action.

The model does not receive raw Apollon JSON, Yjs state, image/audio content, secrets, full project history, or the complete canonical model.

## 4. Context Contract

`ContextoAsistente` contains:

- active project identity and modeling area;
- semantic selected/relevant elements when available;
- class and relationship counts;
- UML status: valid, invalid, or incomplete;
- summarized CU08 diagnostics;
- Spring readiness, blockers, and warnings from CU09;
- unsaved-changes flag;
- pending-image-candidate flag;
- allowed product actions.

Requests and conversation history are bounded. The in-memory conversation keeps at most eight recent messages and is reset with the project page lifecycle.

## 5. Groq Provider

CU12 has a dedicated provider and strict response contract. It reuses the backend-only `GROQ_API_KEY` and defaults to `openai/gpt-oss-20b` through the accepted `GROQ_MODEL` configuration.

Allowed suggested actions are limited to `NINGUNA`, `ENFOCAR_ELEMENTO`, `IR_A_VALIDACION`, `IR_A_GENERACION`, `IR_A_XMI`, and `MOSTRAR_IMAGEN_CANDIDATA`. Unknown actions and invented element references are rejected.

## 6. Proactive Guidance

One highest-priority deterministic hint is displayed for these states: empty model, invalid UML, pending image candidate, direct N:M blocker, generation-ready model, or other generation blocker. This guidance is identified as system guidance and is not presented as an AI response.

## 7. No-Mutation Boundary

The panel receives only `ContextoAsistente`. It receives no canonical-model mutation callback and cannot execute CU04 commands, save projects, generate backends, or import/export XMI. Suggested actions are informational in this iteration.

## 8. Failure Degradation

Groq 429/503/unavailability returns a controlled message. The CASE application remains operational and deterministic system guidance remains visible.

## 9. Focused Verification

| Check | Result |
|---|---|
| Direct N:M blocker reaches CU12 context | PASS |
| Valid 1 ↔ 1..* model reports ready plus warning | PASS |
| Pending CU05 candidate is represented | PASS |
| Context excludes full editor/Yjs/image data | PASS |
| Unknown structured action is rejected | PASS |
| Groq failure preserves system guidance | PASS |
| CU12 does not mutate canonical UML | PASS |
| Backend focused tests (3) | PASS |
| Frontend focused tests (5) | PASS |
| Backend typecheck/build | PASS |
| Frontend typecheck/build | PASS |

## 10. Real Groq Acceptance

PASS. `npm run proof:contexto:groq` used the production `ProveedorAsistenteContextualGroq` against real Groq with `openai/gpt-oss-20b`.

The accepted scenario described a UML-valid `Usuario 0..* ↔ 0..* Rol` model whose direct N:M relationship blocks Spring generation. The real structured response explained the generation blocker, mentioned the many-to-many/associative-class solution, did not claim that the UML was invalid, returned a whitelisted action, and did not mutate the supplied context.

Recorded evidence:

- `realGroqContextUsed = true`
- `model = openai/gpt-oss-20b`
- `structuredOutput = true`
- `responseReceived = true`
- `explainsGenerationBlocked = true`
- `mentionsManyToManyOrAssociativeClass = true`
- `doesNotClaimUmlInvalid = true`
- `suggestedActionIsWhitelisted = true`
- `noModelMutation = true`
- `semanticCondition = true`

No API key, authorization header, or secret value is recorded.

## 11. Final Status

PASS
