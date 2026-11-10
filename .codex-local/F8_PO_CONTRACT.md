# NexoCASE | F8–F9 Product Owner Contract

**Status:** decision guardrails, NOT evidence of new implementation. **Baseline:** `main@103ea46` (F7.1; 466 backend + 234 frontend + 50 E2E passed before subsequent changes). **Owner:** human PO. **Language:** instructions to Codex in English; Codex reports and user-facing product text in Spanish.

## 1. Product outcome / scope boundary

NexoCASE must support flexible **UML class-diagram modeling**, distinguish **valid UML** from **Spring-generable UML**, generate **correct and testable Spring Boot code only for a verified profile**, and explain unsupported constructs **without losing or silently rewriting the user's model**.

- Keep **CU01–CU12** and everything retained from the first partial. No new use cases, autonomous AI editing, universal UML/JPA claims, new framework, new persistence store or UI redesign without explicit PO approval.
- **Idempotency** means duplicate requests do not duplicate changes; it does NOT mean unlimited type/relationship compatibility.
- The human explicitly authorizes changes. CU12 advises or routes a clear human action to CU04; CU04 validates the live revision, executes requester-only, propagates via Yjs, and leaves **CU11 explicit Save** intact.
- Critical priorities: defense reliability, exact semantics, integrity, permissions, reproducible proof. Avoid implementing feature breadth just to increase the selector's options.

## 2. Professor's second-partial requirements (source: `Transcripcion examen(1).pdf`)

**Mandatory, per the supplied transcript:** retain the entire first-partial product (manual modeling, AI text/voice/image, XMI import/export, collaboration, Spring backend with services testable using Postman). Add collaborative AI as a context-aware developer/mentor: shared conversation, correctly attributed questions/answers, per-participant continuity and actions on request. UML notation **2.5 or later** is explicitly required; this does **not** establish a requirement to implement every UML metaclass or all possible JPA mappings.

**Valuable but optional:** locally hosted AI; Groq/cloud model is permitted. Never claim NexoCASE trains or hosts its own LLM.

**Academic verification:** explain CASE, component-based development, four architectures (**frontend, backend, data, deployment**), AI, specification-driven development, UML, actual development process, frameworks and object-to-relational transformation rules. Distinguish **MongoDB for NexoCASE** from **PostgreSQL for generated Spring backend**. Document the methodology truly used; do not invent artifacts or falsely assert a specific methodology was mandatory.

**Four sequential assessment gates:** (1) documentation, (2) product validation, (3) process/model/code verification, (4) proof of authorship. The academic document needs **theory, development-process record, effective-user-learning mechanisms**, plus cover, bibliography and appendices. Transcript says upload by **08:00** on exam day, bring only printed cover with QR links, present at **15:15**, and avoid new publications after the stated freeze. **Exact calendar date is unverified:** confirm it from official course communication, do not infer from this file.

## 3. Current proven boundaries — verify against code before change

These are findings from F8.1 audit at the baseline, not promises for new work:

**Verified update after F8-S1 / F8-S2 (historical F8.1 unchanged):**
- F8-S1 is CLOSED: the PO reports exit code 0; the inspected [runtime evidence](../backend/generated-test-output/postgres-proof-31346ea5beed46128f8142b108b92a7e/runtime-evidence.json) confirms PostgreSQL 16.13, Maven, Spring startup, composite PK/FK and CRUD for Usuario/Rol/UsuarioRol. This closes the generated-Spring runtime gap for that fixture only, not every type/relationship or voice/vision smoke.
- S2 found silent loss of the associative-class marker and association names. Approved S3 now preserves the marker through a NexoCASE-specific XML namespace (urn:nexocase:xmi:1) and restores existing association names. This is not general uml:AssociationClass support: third-party tools may strip the extension. Missing source metadata must never be inferred; unknown values of our own marker are rejected. Legacy unmarked classes retain their prior interpretation.
- PO-approved F8-S4 resolves the S2 validity/eligibility inconsistencies: CU04 and CU12 reuse the existing CU08 validator as one pure function; frontend paths reexport it. CU04 preserves existing conceptual/null/non-Long-ID attributes when the result is UML-valid, while newly introduced AI attribute types stay bounded to the previous channel list. Empty drafts are UML-valid; Spring still requires entities and Long IDs. Identity, atomic execution and destructive authorization remain mandatory.
- Spring eligibility in frontend/CU12 now reuses CU09 preparation rather than a second profile implementation; CU09 also requires CU08 validity. CU12 computes diagnostics from one full canonical model (live editor when supplied, otherwise identified durable snapshot), never from unverified summarized-view diagnoses; it retains the 1..* business-rule warning. UI/modeling availability must not be presented as JPA eligibility. Unexpected programming errors must propagate instead of becoming an eligibility outage.
- S3 also preserves supplied parameter IDs in canonical/Apollon round-trips with unambiguous per-method metadata; it does not add operation/parameter XMI export. Detailed historical classifications and S3/S4 evidence are in [F8_S2_COMPATIBILITY_AUDIT.md](F8_S2_COMPATIBILITY_AUDIT.md). I3/I4/I6 are resolved by S4; broader capability guidance remains partial. No new UML/JPA construct is approved.
- S4 focused verification: 85 backend + 79 frontend tests passed, and both TypeScript --noEmit checks exited 0; no broad suite, build, Groq or PostgreSQL run. Next proposed slice (not approved): bounded packaged-frontend and CU04/CU12/Save integration verification, including distribution of the shared pure source modules. This current PO scope supersedes the earlier planned S4 security slice label without authorizing the remaining planned work automatically.
- F8-S3 is CLOSED for local integration: the extended `npm run proof:xmi` exited 0 and explicitly verified associative markers, association names and semantic equivalence, including the unmarked legacy fixture. Evidence: [roundtrip-evidence.json](../backend/generated-test-output/xmi-proof/roundtrip-evidence.json). Six selected Apollon adapter tests passed for parameter identity; no XMI operation support was added. `realEnterpriseArchitectUsed=false`: actual EA open/re-export and third-party preservation of our extension remain unverified. Prior 29+32 focused results were not rerun at closure.

- UML editor / CU02 can represent attributes, methods and `asociacion`, `agregacion`, `composicion`, `generalizacion`; their existence in the editor does **not** imply Spring or XMI supports all of them.
- Spring CU09 currently handles a bounded CRUD/JPA profile: one-to-many relationships (including supported associative-class pattern); **1:1, direct N:M, aggregation, composition and inheritance are not generally generated**. `id` requires the supported Java ID convention (baseline: `Long`). **UML methods are not business-logic implementations**.
- Type aliases displayed by the inspector normalize to a smaller Java type set. Unsupported domain types and enumerations need an explicit eligibility decision; do **not** silently coerce unknown types to `String`.
- XMI CU06/CU07 is profile-based; certain methods/enums may be rejected or imported with warnings. No silent loss.
- Baseline supports CU01–CU12 with **documented profile limits**. F8.1 flags: unauthenticated AI voice/image consumption endpoints if exposed publicly, project-creation abuse controls, deployment provisioning verification, and missing *current* generated-Spring runtime and real-voice/vision smoke evidence.
- A collaboration `error` in screenshots taken while the development backend was stopped is **not** proof of a defect. Check service/WS availability first.

## 4. Single capability truth; mandatory cross-layer change impact

Do NOT build an oversized capabilities service just to satisfy this rule. Reuse existing validators/adapters; if needed, introduce the **smallest shared, typed capability/eligibility contract** and test it. Model validity and code-generation eligibility remain **separate**.

For every change affecting a UML construct, type, relation or feature, assess and update **only the affected** surfaces in one coherent slice:

| Surface | Required consistency check |
|---|---|
| Business / CU / requirement | Rule, actors, pre/postconditions, limits and user value |
| Canonical UML + Apollon adapter + inspector | Creation/editing, round-trip, labels, multiplicities, loss prevention |
| CU08 validator | Valid UML vs invalid UML; actionable element-specific diagnostics |
| CU09/CU10 generator | Explicit eligible/unsupported result, correct Java/JPA mapping, compile/CRUD proof for new generated constructs |
| CU06/CU07 XMI | Preserve or explicitly reject/warn; never silently discard |
| CU04 text/voice + CU05 vision | Provider instructions and response validation must use real capabilities; no invented unsupported actions |
| CU12 context / product-help / orchestration | Up-to-date advice; never promise a generation feature absent in CU09 |
| CU03/CU11 / traceability | Requester ownership, Yjs convergence, explicit save, persistence, idempotency, audit events remain intact |
| UI/UX & user help | Clear valid/generable/blocked statuses, concrete errors; accessible and responsive interaction |
| Tests & F8/F9 docs | Focused regressions; update affected documentation and matrix, not all unrelated files |

**Acceptance examples:**
- Given valid UML outside Spring profile, when Generate is requested, then explain exactly which element blocks it; model unchanged.
- Given a capability is added, when accessed via editor/CU04/CU05/CU12, then rules agree; unsupported channels report limitations, not fabricated support.
- Given a model is declared generable, when ZIP is produced, then its Spring project compiles and corresponding CRUD endpoints work under the verified runtime fixture.
- Given a repeated user authorization, when already applied, then no second UML change/action event is created.

## 5. Decision order / slices (NOT a single mega-task)

1. **P0 F8-S1 — Spring reality check:** inspect existing fixture/runtime scripts; generate a representative supported model, compile it and verify one CRUD transaction with isolated PostgreSQL. Identify genuine blockers. **No speculative JPA rewrites.**
2. **P0 F8-S2 — Capability matrix:** for representative types, methods, association 1:1, 1:N, direct N:M, associative class, aggregation, composition and generalization, mark: editable / UML-valid / XMI-supported / Spring-eligible / compiled. Use *implemented tests and code*, not imagined coverage. Choose the **smallest high-value gap** only after evidence.
3. **P0 F8-S3 — Single-rule parity:** unify any proven contradictions among CU08, CU09, CU04/CU05/CU12 and help; avoid a sprawling refactor.
4. **P1 F8-S4 — Security/deployment:** if publicly accessible, protect costly image/voice calls and project creation; verify secrets provisioning, error codes and no provider invocation on denied requests. If local-only, record and explicitly accept context-specific risk.
5. **P1 F8-S5 — Real smoke evidence:** one bounded Groq voice and one image test (human-initiated only) plus deployment recovery, with sensitive logs redacted.
6. **P1/P2 F8-S6 — Focused UX:** inspect/correct only concrete problems (searchable type selection, contextual/less crowded inspector, assistant readability, connection state). Never change UML semantics for aesthetics.
7. **F9 — Academic delivery:** exact 3-part document, 4 architecture views, author/process traceability, concise user guide, QR cover, demonstration script, strict freeze. Update it to actual implementation, not aspirations.

**Gate to widen support:** PO explicitly approves each construct. Prefer `1:1` as candidate after runtime proof; inheritance/composition/aggregation require documented JPA ownership, lifecycle/cascade and integrity rules. More types require explicit Java/JPA/XMI/IA mapping and tests. Unsupported yet well-formed UML must stay editable when safe.

## 6. Working agreement for Codex — maximum token economy

- Start with `AGENTS.md` and `.codex-local/CURRENT_SLICE.md`; read **this contract only when CURRENT_SLICE refers to it or cross-layer scope changes**. F8.1 audit is reference, not required in every prompt.
- **One approved slice per invocation.** Locate 3–8 relevant files using precise `rg`/path searches; avoid repo-wide dumps, repeating architecture, browsing, or rereading unaffected files.
- Implement the minimum production fix; add focused tests directly related to it. **Do not run 750-test regression, E2E, builds, real Groq or heavy audits by default.** The user/ChatGPT will run final verification separately.
- Preserve worktree. No `reset`, `restore`, `clean`, `stash`, branch switching, staging, commits, pushes, deployment or secret disclosure unless user explicitly authorizes a specific action.
- Do not alter published baselines or historic documents silently. Update **only** relevant current documentation/tests/AI capability guidance for each approved change.
- End with **Spanish, <=8 lines**: root cause/decision, changed files, focused test outcome, impacted surfaces checked, open limitation, next action. No long narrative, no newly generated status TXT/MD unless explicitly requested.

## 7. Definition of Done for a slice

Business rule stated; affected surfaces assessed; source-of-truth consistent; no regression in requester-only/Yjs/CU11/identity; focused tests pass (or failure reported); limitations visible; corresponding F8/F9 evidence updated if applicable; PO retains release approval. **Never claim all UML 2.5, all Java types or universal Spring generation.**

### F8-UX02 approved delivery (2026-11-10)
- One frontend modeling assistant/text composer reuses the CU04/CU12 orchestrator, shared authenticated conversation and requester-only execution. Pending recommendation CTA requests server validation; it never certifies a plan before validation. No backend role/endpoint/persistence changes.
- Capability guidance updated to unified access; chat mic/attachments remain UX03, while existing voice services and dedicated Desde imagen/CU05 remain. UX04 views pending. Evidence: 45 frontend + 5 capability tests and frontend TypeScript exit 0; real two-browser/visual acceptance pending (CURRENT_SLICE.md). No change to UML/Spring/XMI eligibility or historical F8 evidence.

### F8-UX03 approved delivery (2026-11-10)
- Wider adjustable/readable chat with independent scroll and bottom multiline composer. Voice uses existing transcription, appends editable draft and requires explicit Send; stop/cancel never executes modeling.
- Image attachment reuses CU05 analysis/review/application (PNG/JPEG, up to 10 MiB); explicit candidate confirmation against live model and image attribution retained. Attached image Send processes image only and preserves draft text. Dedicated CU05 remains accessible.
- Image preview/candidate stay local; CU12 visual context and durable/shared attachments are unsupported. Future support requires an explicit scoped, authorized attachment/context/retention contract. Existing service security/endpoints, CU04/CU12 roles, Yjs and explicit Save unchanged.
- Verified: 73 frontend + 5 capability tests; frontend TypeScript/build exit 0. External device/visual/two-browser acceptance pending; no real Groq/PostgreSQL. UX04/UX05 not approved; historical F8 evidence preserved.

### F8-UX04 approved delivery (2026-11-10)
- Five central functional views, independent persistent assistant/properties controls, shared visual tokens and accessible status/actions. Existing editor/chat/feature state retained across navigation; selected class and diagnostic element names use canonical data.
- UML validity and Spring eligibility displayed separately from their existing authoritative evaluators. CU05 candidate approval, XMI confirmation/limits and generation/download semantics unchanged; no new domain/provider/backend capability.
- Evidence: 112 focused frontend tests in 7 files; TypeScript/build exit 0. Actual geometry, real Apollon navigation return, two-browser Yjs/Save and external XMI interoperability still require independent verification. UX05 proposed / not approved. Prior evidence and multimedia limits preserved.
