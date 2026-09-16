# Iteration 09 — Real-Time Collaborative UML Editing

## 1. Objective

Prove that two real browser clients can join the same room, edit the same Apollon/Yjs UML diagram in both directions, observe presence, and converge without introducing a second collaborative model.

## 2. Business Package / Use Case

- Package: **Colaboración**.
- Primary use case: **CU03 — Colaborar en tiempo real sobre un modelo UML**.
- Related: CU02 manual class modeling and CU08 UML validation.

## 3. Starting Baseline

- Branch: `main`.
- Starting commit: `bab2aa8ca308041cde26caee7d22bc62c5349ef6`.
- Working tree: clean.
- Origin status: `main...origin/main`, synchronized at the start.
- Iterations 01–07 accepted; Iteration 08 internally verified and externally partial.

## 4. Open Acceptance Gates Reviewed

`EA-XMI-001` remains **OPEN — EXTERNAL ACCEPTANCE PENDING**. It is non-blocking for CU03, was not changed, and triggered no speculative XMI work.

## 5. Business Problem

The editor supported one designer but did not yet let a second designer join the same live modeling session. CU03 closes that product gap for active, ephemeral sessions.

## 6. Actors

- Designer A.
- Designer B.

No administrator or authenticated account is required in this academic slice.

## 7. Business Rules

- A valid room id is required and isolates traffic.
- Participants provide a display name and receive a session identity/color.
- Same-room peers share Apollon's live state; different rooms do not.
- Late joiners request current document and awareness state from connected peers.
- Frames are opaque to the relay.
- Rooms are ephemeral and access is by room id only.
- The canonical model remains derived, never separately synchronized.

## 8. Previous Repository-Reuse Evidence Used

The iteration reused the prior audit and inspected only collaboration-relevant Apollon documentation, declarations, editor methods, React props, Yjs sync behavior, and its WebSocket reference.

Verified Apollon evidence: Yjs-backed transport-agnostic collaboration, public frame APIs, initial document/awareness sync, full-state broadcast, and collaborator awareness.

OpenFlowKit contributed only room, identity, color and status UX ideas. Its Yjs/runtime, reducers, operation log, signaling and transport were intentionally not adopted.

## 9. Collaboration Architecture

```text
Browser A / Apollon-Yjs
          ⇅ opaque base64 frames
CASE backend WebSocket relay
          ⇅ opaque base64 frames
Browser B / Apollon-Yjs
```

The relay is attached to the same Node HTTP server that hosts the existing Express APIs.

## 10. Why No Second Yjs Model

Apollon already owns the collaborative Yjs document. A second Y.Doc or writable canonical collaboration state would introduce loops and conflicting sources of truth. The product therefore supplies only session identity, room transport and UX.

## 11. Room Rules

Room ids are trimmed, required, 1–64 characters, and limited to ASCII letters, digits, hyphen and underscore. The backend uses `Map<string, Set<WebSocket>>`, excludes the sender, isolates rooms and removes empty rooms.

## 12. Participant Identity

A name is required, trimmed and limited to 40 characters. A browser-session id is stored in `sessionStorage`; name plus session id deterministically selects a color from a small fixed palette. No account, email or profile is created.

## 13. WebSocket Relay

Endpoint: `/api/colaboracion?sala=<room-id>`.

The `ws` relay accepts text frames up to 1 MiB and forwards the exact text only to other open sockets in the same room. It does not decode Yjs, inspect UML, merge models or persist frames.

## 14. Apollon Public APIs Used

- React `<Apollon collaborationEnabled collaboration={...}>`.
- `sendBroadcastMessage` and `receiveBroadcastedMessage`.
- `ApollonEditor.generateInitialSyncMessage()`.
- `ApollonEditor.generateInitialAwarenessSyncMessage()`.
- `broadcastFullState()`.
- `setLocalAwarenessUser()` and `setLocalAwarenessState()`.
- `subscribeToCollaboratorChanges()`, `getCollaborators()` and `unsubscribe()`.

No `@tumaet/apollon/internals` import was used.

## 15. Frontend Integration

`AnfitrionEditorApollon` still owns exactly one editor instance. It enables Apollon's collaboration layer once and exposes the mounted public editor to CU03. `PanelColaboracion` manages room/name input, status, participant display and disconnect. The connector owns only the WebSocket/public-editor wiring.

## 16. Awareness / Presence

The panel displays product-level participants and marks the local participant. Apollon continues to render its own presence, cursors and selection highlights. Disconnect clears the local awareness user before closing and removes all registered callbacks/subscriptions.

## 17. Canonical Model Relationship

```text
live local or remote edit
→ Apollon/Yjs
→ existing model-change subscription
→ AdaptadorApollon
→ ModeloUMLCanonico
→ CU08 validation / CU09 readiness / XMI
```

The browser proof checks the canonical summary after remote edits; no remote-only validation path exists.

## 18. Persistence Boundary

Rooms hold active sockets only. When all peers leave, the live room is deleted and recovery is not guaranteed. Durable save/recovery remains CU11.

## 19. Security / Access Boundary

Anyone who knows a valid room id can join. There is no authentication, authorization, ownership or ACL in this iteration; no stronger security is claimed.

## 20. Backend Tests

Focused relay tests cover valid/invalid room ids, connection acceptance/rejection, exact same-room delivery, no sender echo, different-room isolation, closed-socket removal and empty-room deletion.

## 21. Frontend Tests

Connector tests cover URL construction, validation, outbound/inbound frames, both initial sync messages, full-state broadcast, participant subscription, local awareness identity and complete cleanup.

## 22. Two-Client Browser Proof

Playwright opened independent contexts for Ana and Bruno through the real Vite proxy and CASE WebSocket relay. A third independent context, Carla, joined another room for isolation evidence. No hidden state or test hook was used.

## 23. Initial Sync Evidence

Ana joined first and created `Cliente` through the real Apollon palette/editor. Bruno joined later and received `Cliente` without reload.

## 24. A → B Live Edit Evidence

Ana renamed `Cliente` to `ClienteCompartido`; Bruno displayed the new name without reload.

## 25. B → A Live Edit Evidence

Bruno created and named `Pedido`; Ana displayed it without reload.

## 26. Convergence Evidence

Both clients displayed `ClienteCompartido` and `Pedido`, and both normal canonical inspectors reported two classes.

## 27. Room Isolation Evidence

Carla joined a distinct room and retained zero canonical classes; neither shared class appeared there.

## 28. Presence Evidence

Both collaborating clients reported two participants. Ana's normal UI listed both Ana and Bruno.

## 29. Existing Regression Results

Existing CU02, CU09 generation/download and Iteration 08 XMI browser scenarios passed alongside the new collaboration scenario. HTTP generation, relationship generation and XMI runtime proofs also passed.

## 30. Package → Use Case Structure

```text
backend/src/
├── ServidorCase.ts
└── paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/
    ├── ServidorRelayColaboracion.ts
    ├── ServidorRelayColaboracion.test.ts
    └── validarSalaColaboracion.ts

frontend/src/paquetes/colaboracion/casos_uso/cu03_colaborar_modelo/
├── PanelColaboracion.tsx
├── conectarColaboracionApollon.ts
├── conectarColaboracionApollon.test.ts
└── identidadColaborador.ts
```

Apollon-specific model integration remains under Modelado UML; CU03 receives the mounted public editor through that boundary.

## 31. Files Created / Modified

Created: the backend CU03 relay/validation/tests, server composition root, frontend CU03 connector/identity/panel/tests, two-client Playwright scenario, and this report.

Modified: backend dependencies/lockfile and startup composition; frontend Apollon host, CU02 page, styles and Vite proxy; root README.

No external reference repository was modified.

## 32. Commands Actually Executed

- Mandatory baseline Git commands: PASS; clean synchronized `main`, HEAD `bab2aa8`.
- `npm install ws@8.18.3` and `npm install -D @types/ws@8.18.1`: PASS.
- Early backend `npm test` and `npm run typecheck`: PASS.
- Early frontend `npm test`: PASS; first typecheck found two local test/socket typing errors, corrected; repeated typecheck PASS.
- Focused Playwright CU03 test: PASS.
- Final backend: `npm test`, `npm run typecheck`, `npm run build`, `npm run proof:http`, `npm run proof:relation`, `npm run proof:xmi`: PASS.
- Final frontend: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`: PASS.

## 33. Verification Matrix

| Check | Result |
|---|---|
| Iterations 01–08 regressions | PASS |
| EA-XMI-001 remains open | PASS |
| Apollon public collaboration API used | PASS |
| No second Yjs document created | PASS |
| WebSocket relay starts | PASS |
| Same-room message relay | PASS |
| Different-room isolation | PASS |
| Initial sync late join | PASS |
| Client A → B edit | PASS |
| Client B → A edit | PASS |
| Final model convergence | PASS |
| Participant presence | PASS |
| Canonical derivation after remote edit | PASS |
| Frontend tests | PASS — 74 tests |
| Backend tests | PASS — 56 tests |
| Typechecks | PASS |
| Builds | PASS |
| Existing XMI E2E | PASS |
| Collaboration E2E | PASS |

## 34. Deferred Features

Durable rooms, recovery, history/versioning, offline collaboration, Redis, PostgreSQL CASE storage, authentication, authorization, ownership, permissions, invitations, chat, WebRTC and internet-scale deployment are deferred. CU03 and CU11 remain separate.

## 35. Risks / Technical Debt

- A room is lost when no peer remains; this is an explicit ephemeral-session boundary.
- Room ids are bearer-like and provide no access control.
- There is no automatic reconnection/backoff after network loss; a user reconnects from the panel.
- The existing frontend large-bundle warning remains non-blocking and outside this iteration.
- Dependency installation reported one high-severity npm audit advisory; it was not auto-fixed because unrelated dependency upgrades were outside scope and require a focused review.

## 36. Recommended Next Iteration

Implement the first small CU04 incremental AI text-command slice over the existing canonical/editor boundary so that collaboration can naturally propagate an AI-originated supported edit. Do not implement it as part of Iteration 09.

## 37. Final Status

**PASS**

Two independent designers demonstrably shared the actual Apollon/Yjs UML session, synchronized a late joiner, edited in both directions, converged through the canonical projection, exposed presence, and isolated another room. The implementation uses only Apollon's public collaboration API and an opaque ephemeral relay.
