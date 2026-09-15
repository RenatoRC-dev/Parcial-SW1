# Iteration 01 — Project Foundation + Apollon Integration

## 1. Objective

Prove the first vertical slice of the SW1 CASE tool: our React application hosts the real Apollon editor, a Software Designer can make a real UML class-diagram change, and our code receives and inspects the resulting structured Apollon `UMLModel`.

The iteration deliberately stops at the Apollon-native model boundary. It does not implement `CanonicalUMLModel`, collaboration, persistence, validation, AI, XMI, generation, or any later use case.

## 2. Business Package and Use Case

**Package:** Modelado UML

**Use Case:** CU02 — Modelar diagrama de clases manualmente

This iteration belongs to CU02 because the user action under proof is manual creation of a class in a UML class diagram. Hosting Apollon and observing the resulting structured state are technical responsibilities needed to complete that use-case path. No CU03 collaboration behavior is configured.

## 3. Project Documents Reviewed

The following authoritative files under `Proyecto-Parcial/SW1_project_records/` were read in the required order before implementation:

1. `README.md`
2. `01_REQUIREMENTS_SCOPE_AND_EXAM_BASELINE.md`
3. `02_SYSTEM_ARCHITECTURE_AND_INTEGRATION_BLUEPRINT.md`
4. `03_COMPONENT_REUSE_AUDIT_AND_INTEGRATION_STRATEGY.md`
5. `04_FUNCTIONAL_AND_TECHNICAL_SPECIFICATION.md`
6. `05_EXECUTION_ROADMAP_QUALITY_RISKS_AND_ADRS.md`
7. `06_PUD_DOCUMENTATION_TRACEABILITY_AND_DEFENSE.md`
8. `PACKAGE_MANIFEST.md`

The consolidated records were sufficient for this iteration; no unresolved professor requirement required reinterpreting `Pauta 1.txt` or `Pauta 2.txt`.

## 4. External Repository Inspected

**Local path:** `D:\2-2026\SW1\Apollon`

**Repository revision inspected:** `506a3037c3c6f88326bb0dfd2b602266d280515a`

**Published library:** `@tumaet/apollon` version `5.3.0`, also confirmed available from the npm registry.

**Upstream package manager:** pnpm `11.8.0` in a pnpm workspace. The embeddable library is the `library/` workspace. Our independent frontend uses npm and a committed npm lockfile; it does not link to or modify the upstream workspace.

Relevant public APIs found:

- React `<Apollon>` component from `@tumaet/apollon`;
- `UMLDiagramType.ClassDiagram`;
- `ApollonEditor.model` getter;
- `ApollonEditor.subscribeToModelChange(callback)`;
- `ApollonEditor.unsubscribe(subscriptionId)`;
- public `UMLModel`, `ApollonNode`, and `ApollonEdge` types;
- public stylesheet `@tumaet/apollon/style.css`.

Relevant files examined:

- `Apollon/package.json`
- `Apollon/pnpm-workspace.yaml`
- `Apollon/library/package.json`
- `Apollon/docs/library/api.md`
- `Apollon/docs/library/api/model-contract.md`
- `Apollon/docs/library/embedding/install.md`
- `Apollon/docs/library/embedding/react.md`
- `Apollon/docs/library/quickstart.md`
- `Apollon/library/lib/index.tsx`
- `Apollon/library/lib/typings.ts`
- `Apollon/library/lib/types/DiagramType.ts`
- `Apollon/library/lib/apollon-editor.tsx`
- `Apollon/library/lib/components/react/Apollon.tsx`
- `Apollon/library/lib/components/react/useApollonSubscription.ts`
- `Apollon/library/lib/modelElementTypes.ts`
- `Apollon/library/lib/types/nodes/NodeProps.ts`

The Apollon repository remained read-only. Its pre-existing untracked files `contenido_apollon_completo.txt` and `estructura_apollon_arbol.txt` were observed but not created or changed during this iteration.

## 5. Technical Findings

### Embedding mechanism

For React hosts, the documented public integration is the `<Apollon>` component exported from the package's main entry. It owns `ApollonEditor` construction and destruction. The host must give it an explicit non-zero height and import `@tumaet/apollon/style.css`.

The imperative alternative is `new ApollonEditor(element, options)`, but the upstream React embedding guide explicitly recommends `<Apollon>` for React applications. This iteration follows that recommendation.

### React and host dependencies

`@tumaet/apollon@5.3.0` requires Node.js `>=22` and React/React DOM `^19`. Its required peer dependencies are:

- `react`;
- `react-dom`;
- `@xyflow/react`;
- `yjs`;
- `y-protocols`.

The host pins these dependencies rather than relying on an implicit local workspace resolution.

### Class-diagram setup and initial state

The public class-diagram literal is `UMLDiagramType.ClassDiagram`, serialized as `"ClassDiagram"`. No initial model is required. When no `defaultModel` is supplied, Apollon creates an empty diagram, generates a model id, uses the class-diagram type by default, and exposes empty `nodes`, `edges`, and `assessments` collections.

The implementation nevertheless passes `defaultType={UMLDiagramType.ClassDiagram}` explicitly so CU02's intended diagram type is visible in our boundary.

### Model access and change mechanism

`editor.model` returns the current diagram as a plain structured `UMLModel`. The current public envelope contains:

- `version` — currently `4.2.0`;
- `id`;
- `title`;
- `type`;
- `nodes`;
- `edges`;
- `assessments`;
- optional `interactive` data.

`subscribeToModelChange(callback)` returns a numeric subscription id. The callback receives the current `UMLModel` after diagram-store changes. Cleanup uses `editor.unsubscribe(id)`. The channel is coarse-grained, so future consumers should avoid expensive processing on every callback.

The class node's public discriminator is `type: "class"`; class-specific content such as its name, attributes, methods, stereotype, and abstract flag is held under `node.data`. Relationships are structured `edges` with stable ids, endpoints, an edge type, handles, and edge data.

### Public versus internal APIs

The package root explicitly documents its exports as the public surface. `@tumaet/apollon/internals` exists but is marked unstable. CU02 imports only from:

- `@tumaet/apollon`;
- `@tumaet/apollon/style.css`.

No internal source path or `/internals` export is used.

### Limitations found

- The public JSON schema intentionally leaves each node/edge `data` object open because its exact shape depends on element type. The later canonical adapter will need explicit, tested mapping of the supported class-diagram subset.
- `subscribeToModelChange` is a coarse subscription, not a semantic diff stream.
- The library contributes a substantial frontend bundle; the production build warns that the main minified chunk exceeds 500 kB.

None of these limitations blocks Iteration 01.

## 6. Package / Use Case Structure Created

```text
frontend/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── test/
│   │   └── setup.ts
│   └── paquetes/
│       └── modelado_uml/
│           └── casos_uso/
│               └── cu02_modelar_diagrama_clases/
│                   ├── PaginaModeladoClases.tsx
│                   ├── resumenModeloApollon.ts
│                   ├── resumenModeloApollon.test.ts
│                   └── componentes/
│                       ├── AnfitrionEditorApollon.tsx
│                       ├── AnfitrionEditorApollon.test.tsx
│                       ├── InspectorModeloDesarrollo.tsx
│                       └── LimiteErrorEditor.tsx
└── tests/
    └── e2e/
        └── cu02-modelado-clases.spec.ts
```

Responsibility chain:

```text
Modelado UML
└── CU02 — Modelar diagrama de clases manualmente
    ├── compose the CU02 page and state
    ├── host Apollon through its public React API
    ├── receive and minimally guard the public UMLModel
    ├── summarize structured state for development evidence
    └── render controlled initialization/model errors
```

`App.tsx` only composes `PaginaModeladoClases`. No empty folders or placeholder use cases were created. The test setup is tool-level test infrastructure, and the browser test remains in the frontend E2E test area while exercising CU02 by name.

## 7. Decisions Taken

### Decision: use the pinned published package

**Reason:** The public package exposes everything required for the iteration. A local file dependency or source fork would reduce portability without adding value.

**Evidence:** `library/package.json` exposes the package root, model, stylesheet, and documented React surface; npm confirmed `@tumaet/apollon@5.3.0` is published.

**Baseline compatibility:** Matches ADR-003 and ADR-005: reuse Apollon and prefer its public/controlled integration.

### Decision: use React 19 and the public `<Apollon>` wrapper

**Reason:** React 19 is an explicit peer requirement, and upstream documentation identifies `<Apollon>` as the recommended React lifecycle boundary.

**Evidence:** `library/package.json`, `docs/library/embedding/install.md`, `docs/library/embedding/react.md`, and `library/lib/components/react/Apollon.tsx`.

**Baseline compatibility:** Matches the accepted React + TypeScript web architecture.

### Decision: let Apollon create the empty initial model

**Reason:** The constructor/wrapper supports a valid empty class diagram without a supplied model. Creating a hard-coded demo model would add unnecessary state.

**Evidence:** `docs/library/quickstart.md` and initialization logic in `library/lib/apollon-editor.tsx`.

**Baseline compatibility:** Matches the iteration's minimal-model requirement.

### Decision: capture the model through `onMount` and `subscribeToModelChange`

**Reason:** This is the supported save-on-change pattern. Feeding subscribed state back into the wrapper's reactive `model` prop would create a loop, explicitly warned against by upstream documentation.

**Evidence:** `docs/library/embedding/react.md` and `library/lib/components/react/Apollon.tsx`.

**Baseline compatibility:** Establishes a controlled Apollon boundary without implementing the future canonical adapter.

### Decision: keep all business implementation in Modelado UML → CU02

**Reason:** Only CU02 has a real implementation consumer in this iteration. Moving the host to a premature shared area would violate the package/use-case organization rule.

**Evidence:** Current iteration scope and mandatory source-code structure.

**Baseline compatibility:** Matches the Business Package → Use Case baseline.

### Decision: add one real browser acceptance test

**Reason:** A jsdom initialization test proves construction and initial model access, but only a browser can credibly prove rendering and a real drag-to-create edit. The single Playwright test uses the locally installed Chrome channel and verifies the inspector update.

**Evidence:** `tests/e2e/cu02-modelado-clases.spec.ts` and the passing `npm run test:e2e` result.

**Baseline compatibility:** Supplies evidence for technical spike S01 without expanding product scope.

## 8. Files Created or Modified

- `.gitignore` — excludes dependency, build, coverage, Playwright, and TypeScript build metadata.
- `README.md` — practical project purpose, package/use-case rule, current implementation, prerequisites, commands, and documentation locations.
- `frontend/package.json` — pinned runtime/tool dependencies and development, test, E2E, type-check, and build commands.
- `frontend/package-lock.json` — reproducible npm dependency resolution.
- `frontend/index.html` — Vite application entry document.
- `frontend/tsconfig.json` — TypeScript project references.
- `frontend/tsconfig.app.json` — strict browser/application TypeScript configuration.
- `frontend/tsconfig.node.json` — strict tool configuration for Vite and Playwright configs.
- `frontend/vite.config.ts` — React plugin and focused Vitest configuration.
- `frontend/playwright.config.ts` — one-browser CU02 acceptance-test configuration using installed Chrome.
- `frontend/src/main.tsx` — React root bootstrap.
- `frontend/src/App.tsx` — composition root for the implemented CU02 page.
- `frontend/src/styles.css` — minimal responsive workspace, inspector, and error-state styling; supplies the editor's explicit height.
- `frontend/src/test/setup.ts` — jsdom browser API shims needed by the real Apollon wrapper test.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases.tsx` — CU02 page composition and current Apollon model state.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/resumenModeloApollon.ts` — minimal public-model guard, summary, and error normalization.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/resumenModeloApollon.test.ts` — summary and model-envelope tests.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/AnfitrionEditorApollon.tsx` — public Apollon embed, initial model capture, change subscription, cleanup, and controlled errors.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/AnfitrionEditorApollon.test.tsx` — real public-wrapper initialization test under jsdom.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/InspectorModeloDesarrollo.tsx` — visible structured-model evidence panel.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/LimiteErrorEditor.tsx` — render/initialization error boundary with a visible recovery action.
- `frontend/tests/e2e/cu02-modelado-clases.spec.ts` — real Chrome test for render, manual class creation, subscription propagation, inspector count, and structured JSON.
- `docs/iterations/ITERATION_01_APOLLON_FOUNDATION_REPORT.md` — this iteration/PUD evidence report.

No file under `SW1_project_records` or an external reference repository was modified.

## 9. Commands Executed

| Command | Purpose | Result | Status |
|---|---|---|---|
| `rg --files` and PowerShell `Get-Content -Raw` over the eight authoritative records | Inventory the project and read the baseline in order | Documentation-only project confirmed; all eight records reviewed | PASS |
| `git rev-parse HEAD`, `rg`, and `Get-Content` in `Apollon/` | Inspect the upstream revision, manifests, docs, exports, editor implementation, model types, and React wrapper | Public integration facts recorded; upstream remained unchanged | PASS |
| `npm view @tumaet/apollon@5.3.0 version peerDependencies engines --json` | Confirm published availability and host requirements | Version `5.3.0`, Node `>=22`, React 19 peers confirmed | PASS |
| Initial `npm install` attempts with Vite 8 / Vitest 4 | Bootstrap the first toolchain draft | Network timeouts occurred, followed by an npm Arborist `edgesOut` resolver failure; no usable installation produced | FAIL |
| `npm install` after pinning the conservative Vite 7 toolchain | Install the host dependencies | Dependencies and lockfile created successfully | PASS |
| Initial `npm test` | Exercise the first test configuration | Exposed missing Vitest globals and canvas jsdom support; corrected in test config/setup | FAIL |
| `npm test` (final) | Run focused unit and real-wrapper initialization tests | 2 files, 4 tests passed with Vitest 5.0.1 | PASS |
| `npm run typecheck` (final) | Validate strict TypeScript compilation | Exit code 0 | PASS |
| `npm run build` (final) | Produce the real optimized frontend build | 2,241 modules transformed; build completed; non-blocking large-chunk warning recorded | PASS |
| `npm run test:e2e` (final) | Start the frontend, render Apollon in Chrome, create a class, and observe inspector/model JSON updates | 1 browser test passed | PASS |
| `npm audit` (final) | Check runtime and development dependency advisories after pin updates | `found 0 vulnerabilities` | PASS |
| `git status --short` in `Apollon/` | Confirm the reference repository was not changed by this work | Only two pre-existing untracked audit text files remained visible | PASS |

No lint command exists in this minimal frontend, so no lint result is claimed.

## 10. Verification Results

| Check | Result | Evidence |
|---|---|---|
| Frontend starts | PASS | Playwright `webServer` started `npm run dev` at `127.0.0.1:4173`; browser test completed |
| Apollon renders | PASS | Real Chrome found visible `.react-flow` canvas |
| UML class can be modified | PASS | Browser test dragged the visible Apollon `Class` palette item onto the canvas |
| Host receives structured UML model | PASS | CU02 inspector class count changed to `1`, and JSON contained a node with `"type": "class"` |
| Inspector shows model information | PASS | Browser verified the visible Spanish inspector, `ClassDiagram`, counts, and collapsible JSON |
| Tests | PASS | Vitest: 2 files and 4 tests passed |
| Type check | PASS | `npm run typecheck`, exit code 0 |
| Production build | PASS | Vite 7.3.6 production build completed successfully |

## 11. Deviations From Baseline

None.

The real Apollon source added precise implementation facts—React 19, public model version `4.2.0`, and current package version `5.3.0`—but did not contradict an accepted architecture decision or professor requirement.

## 12. Risks / Blockers

No blocker remains for Iteration 01.

Real risks observed:

- The optimized main JavaScript chunk is approximately 1.27 MB before gzip, and Vite emits a large-chunk warning. Route-level lazy loading should be considered once the product has multiple real pages; introducing it for this single-page spike would be premature.
- Apollon's element-specific `data` fields are an open envelope in the public JSON schema. The next adapter iteration must map and test only the supported class-diagram semantics rather than assuming arbitrary fields.
- The E2E configuration uses an installed Chrome channel. CI will need Chrome available or an explicitly installed Playwright browser.

## 13. Technical Debt

- The model guard validates the public top-level envelope needed by this spike, not every nested Apollon element. Deep semantic validation belongs to the later adapter/validation iterations and is intentionally absent here.
- The inspector is intentionally development evidence and has no production visibility toggle yet. It should be removed or gated when a real end-user CU02 interface replaces the spike shell.

## 14. Recommended Next Iteration

**CanonicalUMLModel + initial ApollonAdapter**

The next iteration should define the supported canonical class-diagram subset, map Apollon class nodes/attributes/relationships into it, preserve stable ids and geometry, and add round-trip fixtures. It should keep the adapter within the Modelado UML package until a real second business-package consumer justifies a broader shared contract.

This work was not implemented in Iteration 01.

## 15. Final Iteration Status

PASS

All Iteration 01 success criteria were verified: the authoritative baseline was reviewed first; only `Proyecto-Parcial` was changed; source follows Package → Use Case organization; React and Apollon run; a real class creation works in Chrome; CU02 receives the structured model; the Spanish development inspector proves access; focused tests, type checking, production build, browser acceptance, and dependency audit pass; this report exists; and no future use case was implemented.
