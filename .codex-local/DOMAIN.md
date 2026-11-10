# NexoCASE — Business rules (read only when relevant)

## Purpose, actors, source of truth
- SW1 2nd partial: collaborative UML class modeling with an invoked AI teammate. **One human actor:** `Diseñador de software`. Groq is a provider, not a human actor.
- Projects have backend-issued join code, lightweight per-project participant identity and recent local credentials; no user registration, roles, email, or passwords.
- Backend validates project scope and participant. Same display names possible, but participant IDs are distinct. No global project listing.
- Mongo `projects` persists explicitly saved UML, `participants` authorizations, `messages` shared conversation, `events` semantic history. Apollon/Yjs sync live model, **not** durable saved truth.

## Core AI control
- CU12: teach product/UML, inspect, review, explain, recommend; **cannot mutate**.
- CU04: interpreting/executing validated UML commands by explicit human request; direct text/voice or orchestrated collaborative action.
- Orchestrator: intent + context resolver; does not directly patch UML. Groq cannot invent authority, access, authorship, or business rules.
- Example: IA recommends `Agregar relación Cliente–Venta`; user `Corrígelo` authorizes the bounded change if unique/unambiguous. Broad clear instructions may authorize a group of specified changes.
- **No autonomous modification or autosave.** CU05 image analysis is candidate-only until explicit confirmation; XMI import/export and Spring backend generator remain distinct.

## Context and integrity
- Last global chat message is NOT current focus. Resolve structured proposals within the sender's durable thread by explicit topic, reply correlation and recency, then check stable IDs against the live model. Multiple proposals alone do not imply ambiguity. For destructive pronouns, an exact live selection identifies the target first.
- Duplicated names, ambiguous alternatives, missing/stale targets, destructive uncertainty -> clarify, not guess.
- A recommendation is an actionable *proposal*, not authorization until a new human request.
- Identity from Bearer only, not free-text names or body. Project isolation for all reads/actions.
- Activity events represent known-actor semantic operations; do not infer attribution from generic Yjs/Apollon diffs. Recorded action != currently saved model.
- UML valid != business complete != Spring-generatable. For N:M order-product use associative line item (e.g. `DetalleCompra`) when justified; validate assumptions instead of declaring invented multiplicities.

## Responsibilities
- Business: intent, business rules, ambiguity, human authority, expected outcomes.
- Frontend: display, validated live model, requester-only execution and Yjs sync, explicit save UI.
- Backend: access, identity, context, intent routing, Groq contracts, idempotency, trusted event attribution, persistence logic.
- Mongo: durable projects/participants/messages/events; unique indexes/CAS.
- External Groq: fallible reasoning and structured proposals, never identity or canonical truth.

## UX
- Spanish is primary. Short, readable recommendations; safe formatting and no giant paragraph when structured facts suffice. No extra LLM invocation for visual formatting.
