# Iteration 10 — Server-Side Incremental UML AI with Groq

## 1. Objective

Allow a designer to write one clear text instruction and have a valid incremental UML change applied immediately to the existing shared Apollon diagram without confirmation.

## 2. Business Package / Use Case

- Package: **Asistencia Inteligente**.
- Use case: **CU04 — Modelar mediante inteligencia artificial**.
- Iteration slice: text only.

## 3. Starting Baseline

- Branch: `main`.
- Starting commit: `186e5ab1f33394239848a790de7716d9e422dbc0`.
- Initial tree: clean.
- Origin: `main...origin/main`, synchronized.
- Iterations 01–09 committed; Iteration 09 status PASS.

## 4. Open Acceptance Gates Reviewed

`EA-XMI-001` remains **OPEN — EXTERNAL ACCEPTANCE PENDING** and non-blocking. It was not modified in meaning. `GROQ-AI-001` was created with an evidence-only closure rule and was subsequently closed by the real provider proof recorded in section 31.

## 5. Business Problem

Manual modeling and collaboration worked, but repetitive incremental UML intentions still required direct canvas editing. CU04 adds natural-language command input against the current canonical model.

## 6. Product Decision — Automatic Apply

There is no Preview/Confirm/Apply workflow. A clear, supported and deterministically valid command plan is applied immediately. The internal plan is not a user approval step.

## 7. Safety Model Without Confirmation

Groq output is constrained by a strict schema, parsed into commands, simulated on a copy, reference-checked and validated. Ambiguous, invalid, unsupported or stale results perform zero live mutation.

## 8. Why Groq

The project decision requires server-side hosted inference with low-latency structured output and protected credentials. The official `groq-sdk` 1.6.0 is isolated behind the application provider boundary.

## 9. Server-Side Architecture

```text
text + current ModeloUMLCanonico
→ POST /api/ia/modelado/interpretar
→ CU04
→ ProveedorModeloLenguaje / ProveedorGroq
→ PlanCambiosUML
→ deterministic simulation and validation
→ executable commands
```

No database or conversation storage is involved.

## 10. Provider Abstraction

`ProveedorModeloLenguaje` exposes one operation, `interpretarCambiosUML`. Production composition uses `ProveedorGroq`; backend tests and Playwright inject providers implementing the same interface.

## 11. Groq Model / Structured Output

- Configured default: `openai/gpt-oss-20b`.
- Override: `GROQ_MODEL`.
- Credential: backend-only `GROQ_API_KEY`.
- `response_format.type`: `json_schema`.
- `strict`: `true`.
- Timeout: 18 seconds.
- SDK retries: zero.

The configured model was subsequently accepted through the real provider proof recorded in section 31.

## 12. ComandoModeloUML Contract

The discriminated union is provider-independent. Existing elements use canonical ids; new elements use temporary `tmp_*` references resolved only by deterministic application code.

## 13. Supported Commands

`crear_clase`, `renombrar_clase`, `eliminar_clase`, `agregar_atributo`, `modificar_atributo`, `eliminar_atributo`, `crear_relacion` (association only), `eliminar_relacion`, and `cambiar_multiplicidad`.

## 14. Deferred Commands

Movement, methods, enums, packages, annotations, stereotypes, generalization, aggregation, composition, notes and colors.

## 15. Context Sent to AI

Compact canonical semantics only: model id; class ids/names/abstractness; attribute ids/names/types/visibility; relationship ids/type/endpoints with names/multiplicities/roles. No Apollon JSON, Yjs data or geometry is sent.

## 16. Ambiguity Policy

Ambiguity returns `aclarar`, a concise question and an empty command array. Browser evidence with `Cliente` and `ClienteEmpresa` confirms zero mutation.

## 17. Destructive Command Policy

No confirmation is required, but backend logic requires explicit deletion wording before any `eliminar_*` command can pass. Vague destructive intent becomes clarification.

## 18. Temporary Reference Strategy

The provider links commands created in one plan using unique `tmp_*` references. The executor maps each to an application-generated UUID-based canonical id; names never become permanent identity.

## 19. Deterministic Plan Validation

The backend executes the entire plan against a structured clone, resolves references, checks ids/endpoints/names/types/duplicates and validates the resulting canonical subset consistently with CU08. Invalid plans return no executable commands.

## 20. Atomic Command Execution

Both backend simulation and frontend execution work on copies. Any failed command discards the complete candidate, including earlier commands and referential cleanup.

## 21. Canonical → Apollon Application

The frontend executor produces `ModeloUMLCanonico`; the existing `convertirDesdeModeloCanonico` and public `ApollonEditor.model` setter apply it. No duplicated mapping or internal API exists.

## 22. Collaboration Propagation

Local source inspection verified that the public model setter reconciles shared Yjs node/edge maps. Playwright proved `Factura` created by Ana's AI instruction appeared for Bruno without a second AI call or special AI transport.

## 23. Stale Revision Protection

Every model change received by the existing Apollon subscription increments a frontend counter, including remote changes. A response whose revision differs from the current counter is never applied.

## 24. Automatic Replan Rule

The same instruction is resubmitted once with the newest model. If the model changes again, the plan is discarded and the user is asked to retry. Unit tests prove exactly two maximum provider calls.

## 25. Frontend UX

The compact panel contains one instruction textarea, Enter/Enviar submission, `Interpretando`, `Aplicando`, success/error text and clarification. It has no confirmation button, chat history or raw command display.

## 26. Backend Tests

Tests cover all supported command families, sequential/temp-reference execution, generated ids, referential deletion cleanup, unrelated-content preservation, atomic failure, duplicate/unresolved references, CU08-compatible validation, malformed HTTP input, provider errors and explicit destructive intent.

## 27. Frontend Tests

Tests cover the pure executor, temporary references, stable generated ids, preservation and atomic failure; immediate submission/application; empty input; no confirmation; clarification/rejection; provider errors; stale detection; one replan; and second-change rejection.

## 28. E2E Automatic Apply

With the deterministic backend provider, the real browser created `Cliente`, automatically added `correo:String`, updated Apollon and exposed one canonical attribute with no confirmation.

## 29. E2E Ambiguity

After creating `Cliente` and `ClienteEmpresa`, the ambiguous instruction displayed a clarification and preserved the node count.

## 30. E2E AI → Collaboration

Ana and Bruno joined the same real room. Ana submitted `Crea una clase Factura`; automatic application updated Apollon/Yjs and Bruno received `Factura` with one canonical class.

## 31. Real Groq Proof

**PASS** — the user executed `npm run proof:ia:groq` against real Groq. The non-secret result confirmed `realGroqUsed = true`, model `openai/gpt-oss-20b`, `structuredOutput = true`, `semanticValidation = true` and `expectedCommandReceived = true`. No API key or secret value is recorded.

This provider proof is distinct from the browser E2E evidence: Playwright used the deterministic injected provider and did not call live Groq.

## 32. Regression Results

CU02, collaboration, generation/download and XMI browser scenarios passed. HTTP generation, relationship generation and internal XMI proofs passed. PostgreSQL was not rerun because generator source was unchanged.

## 33. Package → Use Case Structure

```text
backend/src/paquetes/asistencia_ia/
├── compartido/
│   ├── contrato/{ComandoModeloUML,PlanCambiosUML}.ts
│   └── proveedores/
│       ├── ProveedorModeloLenguaje.ts
│       └── groq/{ProveedorGroq,EsquemaRespuestaGroq}.ts
├── casos_uso/cu04_modelar_con_ia/
│   ├── EjecutorComandosUML.ts
│   ├── construirContextoModelo.ts
│   ├── validarPlanCambiosUML.ts
│   ├── interpretarInstruccionModelado.ts
│   ├── ValidarSolicitudInterpretacion.ts
│   └── registrarRutaInterpretacionIA.ts
└── pruebas/{ProveedorDeterministaE2E,probarGroqReal}.ts

frontend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/
├── ComandoModeloUML.ts
├── EjecutorComandosUML.ts
├── procesarInstruccionIA.ts
├── solicitarCambioIA.ts
└── PanelAsistenteModelado.tsx
```

Focused tests live beside their corresponding modules; Playwright evidence is `frontend/tests/e2e/asistente-ia.spec.ts`.

## 34. Files Created / Modified

Created: CU04 backend contracts, provider boundary/Groq adapter/schema, context, executor, validators, route, deterministic provider, real proof and tests; CU04 frontend contract, executor, coordinator, API client, panel/tests; AI E2E; this report.

Modified: backend manifests, CASE/Express composition and startup; Playwright backend command; CU02 page; frontend styles; README; pending acceptance register. The final audit stabilization also configured the `translators` region in the XMI integration boundary and added local timing budgets to the real XMI Playwright scenario.

## 35. Commands Actually Executed

- Git baseline commands: PASS; clean synchronized `main`, HEAD `186e5ab`.
- `npm view groq-sdk version`: `1.6.0`; `npm install groq-sdk@1.6.0`: PASS.
- Early backend tests/typecheck: PASS — 76 tests before final destructive-policy test.
- Early frontend tests: PASS; first typecheck found one test literal-widening error, corrected; repeated typecheck PASS.
- Focused AI Playwright: PASS — 2 tests.
- Initial Real Groq prerequisite check: BLOCKED because `GROQ_API_KEY` was absent; the subsequent user-executed `npm run proof:ia:groq` acceptance: PASS. No key value was printed or recorded.
- Final backend tests/typecheck/build/proofs: PASS — 77 tests.
- Final frontend tests/typecheck/build/E2E: PASS — 87 tests, 6 E2E.
- XMI stabilization proof: PASS — `proof:xmi` 3/3 sequential and 3/3 concurrent; browser XMI 3/3 sequential and 2/2 concurrent; complete Playwright suite 6/6 twice without retries.

## 36. Verification Matrix

| Check | Result |
|---|---|
| Iterations 01–09 regressions | PASS |
| EA-XMI-001 unchanged | PASS |
| Groq only used server-side | PASS |
| GROQ_API_KEY absent from frontend | PASS |
| Provider abstraction | PASS |
| Strict structured output | PASS |
| No raw Apollon JSON from AI | PASS |
| No full-model AI replacement | PASS |
| Create class | PASS |
| Rename class | PASS |
| Delete class | PASS |
| Add attribute | PASS |
| Modify attribute | PASS |
| Delete attribute | PASS |
| Create association | PASS |
| Delete association | PASS |
| Change multiplicity | PASS |
| Temporary references | PASS |
| Atomic validation | PASS |
| Ambiguity blocks mutation | PASS |
| Unsupported request blocks mutation | PASS |
| Automatic apply | PASS |
| No confirmation UI | PASS |
| Stale response detected | PASS |
| One automatic replan | PASS |
| AI change reaches Apollon | PASS |
| AI change reaches collaborator | PASS |
| Frontend tests | PASS — 87 tests |
| Backend tests | PASS — 77 tests |
| Typechecks | PASS |
| Builds | PASS |
| Browser E2E | PASS — 6 tests |
| XMI bridge explicit region configuration | PASS |
| Complete browser regression repeated | PASS — 6/6 twice |
| Real Groq proof | PASS |

## 37. Deferred Features

Voice/Whisper, image reconstruction, conversation history, autonomous agents, additional UML semantics and local CASE AI.

## 38. Risks / Technical Debt

- Backend and frontend intentionally mirror the command contract because they are separate builds; drift must be checked when the vocabulary evolves.
- The provider system prompt is intentionally small; future adjustment must remain evidence-driven.
- Existing bundle-size and npm audit warnings remain outside this slice.

## 39. Recommended Next Iteration

With `GROQ-AI-001` closed, the recommended next iteration is voice input using server-side Groq Whisper `whisper-large-v3-turbo`, feeding the transcript into this exact CU04 text pipeline. Do not duplicate modeling logic.

## 40. Final Status

**PASS**

All deterministic and product behavior passes, including automatic real-editor application and collaboration propagation. The separate real Groq proof also passed with strict structured output and deterministic semantic validation.
