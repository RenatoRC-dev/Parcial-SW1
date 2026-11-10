# NexoCASE — Concise traceability and QA status

**Snapshot of reported state, not a claim about the current working tree.** Inspect code/git for current truth.

| CU | Functional responsibility | Current note |
|---|---|---|
| 01 | Create / Join / Recent projects | Code and local credential |
| 02 | Manual UML class diagram | Canonical model + Apollon |
| 03 | Shared editing | Yjs + authorized WS/presence |
| 04 | Text/voice IA modeling | Direct & orchestrated, requester-only action |
| 05 | Image to UML | Confirmation required, image_cu05 event after apply |
| 06 | Import XMI | Canonical import; XMI_IMPORTED event |
| 07 | Export XMI | Preserve round-trip |
| 08 | Validate UML | Deterministic validation |
| 09 | Generate Spring | Separate readiness from UML validity |
| 10 | Download generated ZIP | Preserve |
| 11 | Save / recover | Explicit Mongo CAS, 409 conflict |
| 12 | Collaborative mentor | Shared/durable advice, context, recommendations |

## Phases
- F1–F3 approved decisions; F4 Mongo/access/events; F5 CU12 shared; F6 CU12↔CU04; F7 integration/UX: prior reported complete with known limitations.
- **F7.1 locally implemented; focused checks passed, independent acceptance pending.** Actual evidence/remaining gates: [CURRENT_SLICE](CURRENT_SLICE.md). Historical green gates below are not a full regression of this hotfix.
- F8 QA/validation/verification and F9 documentation/defense: NOT started by this slice.

## Historical gate (before F7.1)
- Backend 304/304 incl. Mongo 8 real; backend typecheck/build PASS.
- Frontend 230/230; typecheck/build PASS.
- E2E Playwright 50/50 with Mongo 8 real.
- Runtime live CU04 direct and explicit CU12→CU04 worked; CU12 consultive 200. These do not cover contextual multi-turn follow-up.

## F7.1 evidence boundary
- Focused backend/frontend tests cover topic/recency, older stored proposals, complete plans, isolation, idempotency, errors, cooldown and safe chat formatting. Current exact counts/files are summarized in CURRENT_SLICE.md.
- An unhandled ErrorProveedorIA path reproduced the collaborative 500 in the first hotfix. Known operational errors are now mapped; unexpected programming errors remain 500 with sanitized diagnostics.
- Mongo self-lookup, live Yjs multi-client behavior, full regression, builds and real Groq still require independent validation; do not claim those passed.

## Known limitations
- No distributed exactly-once guarantee beyond durable reservation + requester ACK; no autosave.
- App-origin semantic events not for forensic attribution.
- Groq quotas, availability and model correctness are external; Developer tier improves headroom but cannot guarantee unlimited calls.
