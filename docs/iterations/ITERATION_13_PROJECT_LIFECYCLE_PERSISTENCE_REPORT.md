# Iteration 13 — Project Lifecycle Persistence

## 1. Objective

Implement the minimum durable project lifecycle: create/open projects through CU01 and explicitly save/recover canonical UML work through CU11.

## 2. Business Package and Use Cases

Package: **Gestión de Proyectos**.

- CU01 — Crear / abrir proyecto.
- CU11 — Guardar / recuperar trabajo.

They share project-lifecycle infrastructure while remaining separate use cases.

## 3. Starting Baseline

- Branch: `main`.
- Starting commit: `80a76e5cf7728021a8d4209a187cfadfe8d141ee`.
- Iterations 01–12 were the accepted baseline; Iteration 08 remains externally partial because EA-XMI-001 is open.

## 4. CU01 Business Behavior

The initial screen lists persisted project summaries and creates projects from a trimmed 1–80 character name. The backend creates the UUID, timestamps and empty canonical class model atomically. Names are unique without case distinction. Opening retrieves the full persisted project before mounting its editor.

## 5. CU11 Business Behavior

Save is explicit. It writes the latest canonical model and advances `actualizadoEn`; opening recovers the last saved snapshot. There is no autosave, conflict protocol, rename, deletion, history or cloud synchronization.

## 6. Persisted Aggregate

Each `<uuid>.json` contains only `id`, `nombre`, `creadoEn`, `actualizadoEn` and `modelo`. Raw Apollon JSON, Yjs state, awareness, AI conversations, audio and images are not persisted.

## 7. Persistence Architecture

`RepositorioProyectos` defines `listar`, `crear`, `obtenerPorId` and `guardarModelo`. `RepositorioProyectosArchivos` implements it with `fs/promises`. The default directory is `backend/.sw1-data/proyectos`; `SW1_PROJECTS_DIR` provides an override.

Writes create a temporary file in the same directory and rename it. Failed writes remove their known temporary file. Project names never participate in paths.

## 8. Why Canonical UML Is Persisted

The canonical contract is shared by validation, AI, XMI and generation. Persisting it avoids making Apollon an application data contract and preserves one semantic source of truth.

## 9. Why Yjs Is Not Persisted

Apollon/Yjs remains live state for connected peers. The durable state is the last explicit canonical save. This avoids CRDT persistence infrastructure outside the academic scope.

## 10. Incomplete Draft Semantics

Persistence validation checks structure, not CU08 readiness. An attribute with `tipo: null` is a valid saved draft. Save does not imply UML validity or Spring generation readiness.

## 11. Structural Validation

The boundary verifies primitive fields, non-empty and unique element IDs, finite positions, supported relation discriminators and multiplicities, valid endpoints, arrays and optional roles/visibility. Malformed persisted JSON is a controlled storage error.

## 12. API Endpoints

| Endpoint | Responsibility | Result |
|---|---|---|
| `GET /api/proyectos` | List summaries ordered by update | No full model |
| `POST /api/proyectos` | Create project and empty model | `201` full project |
| `GET /api/proyectos/:id` | Open/recover project | Full project or `404` |
| `PUT /api/proyectos/:id/modelo` | Explicitly save canonical model | Updated metadata |

Invalid IDs/inputs return `400`, missing projects `404`, duplicate names `409`, and storage/corruption failures controlled `500` responses without path leaks.

## 13. Frontend Lifecycle

Without an active project, Apollon is not mounted. Create/open installs the persisted canonical model through the existing adapter. The active toolbar exposes **Guardar**, **Mis proyectos**, save state and status feedback.

## 14. Dirty-State Protection

The frontend compares deterministic JSON snapshots of the current canonical model and last successful save. **Mis proyectos** prompts when dirty; `beforeunload` is protected. A failed save does not advance the snapshot.

## 15. Project → Collaboration Room Identity

The room is derived only as `proyecto-${projectId}`. There is no arbitrary selector. Different projects are isolated.

## 16. Collaboration Initialization Lifecycle

The first implementation inferred readiness from a continuing equality between the observed model ID and persisted initial ID. Apollon first published its mount-time empty model, while replacement did not guarantee a matching host publication, so collaboration stayed disabled.

The correction is explicit:

1. The previous keyed page unmounts and disconnects.
2. The persisted canonical model is converted by the existing adapter.
3. `AnfitrionEditorApollon` installs and explicitly publishes that model.
4. It emits `alAplicarModeloInicial` only after installation.
5. Collaboration connects to the project room and stays connected through later mutations.

No timer, retry, new Y.Doc, Apollon internal API or new transport was introduced.

## 17. Live State Versus Durable Save

A late peer receives the current unsaved Yjs model. A peer can explicitly save that live canonical state; a fresh browser context then recovers it from filesystem persistence.

## 18. Package → Use Case Structure

```text
backend/src/paquetes/gestion_proyectos/
├── api/registrarRutasProyectos.ts
├── casos_uso/
│   ├── cu01_crear_abrir_proyecto/GestionarProyectos.ts
│   └── cu11_guardar_recuperar_trabajo/GuardarRecuperarProyecto.ts
├── compartido/{ProyectoPersistido,RepositorioProyectos,ValidarProyectoPersistido}.ts
├── infraestructura/RepositorioProyectosArchivos.ts
└── pruebas_runtime/probarPersistenciaProyectos.ts

frontend/src/paquetes/gestion_proyectos/
├── casos_uso/
│   ├── cu01_crear_abrir_proyecto/PanelProyectos.tsx
│   └── cu11_guardar_recuperar_trabajo/BarraProyectoActivo.tsx
└── compartido/{Proyecto,clienteProyectos}.ts
```

## 19. Tests Added

Backend tests cover creation, name normalization/duplicates, summary listing, save/recovery with a new repository, null-type drafts, UUID/404, malformed nested models, duplicate IDs, missing endpoints, positions and corrupted files.

Frontend tests cover list/create/open, errors, latest-model save with `tipo: null`, dirty state and the explicit initial-model-applied signal.

Browser tests prove named recovery after reload, distinct persisted content, same-project awareness/convergence, late join, explicit saving of live state, fresh-context recovery, project isolation, dirty confirmation and AI/voice/confirmed-image propagation.

## 20. Runtime Persistence Proof

`npm run proof:proyectos` uses a fresh OS temporary directory and removes it in `finally`. It verifies creation, save, null-type draft, new-repository recovery, class/position/timestamp preservation, update ordering, isolation and summary-only listing.

## 21. E2E Data Isolation

Playwright owns only `backend/generated-test-output/e2e-projects`. Its preparation script clears precisely that path before the backend starts; normal `.sw1-data` is untouched.

## 22. Commands Actually Executed

| Command | Result |
|---|---|
| Backend `npm test` | PASS — 115/115 |
| Backend `npm run typecheck` | PASS |
| Backend `npm run build` | PASS |
| Backend `npm run proof:proyectos` | PASS |
| Backend `npm run proof:http` | PASS |
| Backend `npm run proof:relation` | PASS |
| Backend `npm run proof:xmi` | PASS |
| Frontend `npm test` | PASS — 112/112 |
| Frontend `npm run typecheck` | PASS |
| Frontend `npm run build` | PASS; known Vite chunk warning only |
| Focused Playwright collaboration/project suite | PASS — 12 tests |
| Complete `npm run test:e2e` | PASS — 15/15 |

## 23. Verification Matrix

| Check | Result | Evidence |
|---|---|---|
| CU01 create/list/open | PASS | API, unit and browser tests |
| CU11 save/recover | PASS | API, runtime and browser tests |
| Restart persistence | PASS | New repository instance |
| Incomplete drafts | PASS | `tipo: null` round-trip |
| Structural errors | PASS | Focused API tests |
| Atomic write | PASS | temp + rename |
| Project isolation | PASS | Cliente/Factura E2E |
| Dirty protection | PASS | Unit + browser |
| Same-project collaboration | PASS | Focused E2E |
| Late join | PASS | Live Cliente/Pedido E2E |
| AI/voice/image collaboration | PASS | Focused E2E |
| Complete regressions | PASS | 115 backend + 112 frontend + 15 browser tests; both typechecks/builds and all required proofs passed |

## 24. Files Created / Modified

Changes are limited to project-management implementation/tests, existing app/editor/collaboration composition points, E2E setup/scenarios, `.gitignore`, scripts, README and this report. No external repository or generated Spring architecture changed.

## 25. Risks / Technical Debt

- Filesystem persistence is intentionally single-process and academic.
- Explicit save is latest-write-wins without ETags or merge UI.
- Rename, deletion, history, authentication and authorization remain deferred.

## 26. Acceptance Gates

- `EA-XMI-001`: **OPEN — EXTERNAL ACCEPTANCE PENDING**.
- Groq text, voice and vision gates: closed.
- No Iteration 13 gate was added.

## 27. Deferred Features

Database project storage, users, permissions, autosave, version history, cloud sync, Yjs persistence and CU12 are deferred.

## 28. Recommended Next Activity

Perform comprehensive manual acceptance/stabilization before the exam, and close EA-XMI-001 with real Enterprise Architect evidence when available. Do not start CU12 implicitly.

## 29. Final Status

PASS

CU01/CU11, restart persistence, draft preservation, project isolation, dirty protection, project-derived collaboration, late joining, durable explicit save and all prior regression paths passed their required verification.
