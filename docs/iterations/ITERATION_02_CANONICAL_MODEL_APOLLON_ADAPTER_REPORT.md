# Iteration 02 — Canonical UML Model + Apollon Adapter

## 1. Objective

Establish a small application-owned UML semantic contract and prove the one-way flow:

```text
Apollon UMLModel
       ↓
AdaptadorApollon
       ↓
ModeloUMLCanonico
```

The canonical result can be inspected without requiring consumers to understand Apollon's element-specific `data` objects.

## 2. Business Package and Related Use Case

**Package:** Modelado UML

**Use Case:** CU02 — Modelar diagrama de clases manualmente

The live model still originates in CU02 because that is where the designer edits the class diagram. `AdaptadorApollon` belongs to the shared area of the Modelado UML package because it isolates the editor-specific representation. `ModeloUMLCanonico` is a cross-cutting semantic contract, not a CU02-owned type: validation, interoperability, intelligent assistance, and backend generation are expected to consume it in later iterations. It therefore lives in the explicit `nucleo/modelo_uml` core.

## 3. Baseline

- Branch: `main`
- Starting commit: `cf18dc0e52423c51201013156994f20ecb7d4062`
- Initial working tree: clean
- Iteration 01 status: `PASS`
- Baseline reviewed for this continuation: Iteration 01 report, functional/technical specification, and architecture/integration blueprint.

## 4. Verified Apollon Findings

The local read-only source inspected was `D:\2-2026\SW1\Apollon`, revision `506a3037`, particularly:

- `library/lib/typings.ts`
- `library/lib/modelElementTypes.ts`
- `library/lib/types/nodes/NodeProps.ts`
- `library/lib/types/nodes/enums/ClassStereotype.ts`
- `library/lib/constants.ts`
- `library/lib/components/popovers/classDiagram/EditableAttributesList.tsx`
- `library/lib/components/popovers/edgePopovers/ClassDiagramEdgeEditPopover.tsx`
- `library/lib/hooks/useEdges.ts`
- `library/lib/components/svgs/nodes/classDiagram/ClassSVG.tsx`
- `library/lib/nodes/classDiagram/Class.tsx`
- `library/lib/utils/versionConverter.ts`
- relevant unit fixtures under `library/tests/unit/`

Verified structures:

- A class node uses discriminator `type: "class"`.
- Its semantic data includes `name`, `attributes`, optional `isAbstract`, and optional `stereotype`.
- Every class attribute is stored as `{ id, name }`; Apollon edits and renders `name` as one UML-notation string. Defaults and upstream fixtures demonstrate `+ attribute: Type`, `+ name: String`, and `- age: int`.
- A node position is stored as numeric `position.x` and `position.y`.
- Abstractness is stored as `data.isAbstract`; it is separate from class stereotype.
- Class stereotypes currently include `interface` and `enumeration`. They are not treated as ordinary canonical classes in this iteration.
- An edge has stable `id`, `source`, `target`, `type`, and `data`.
- Confirmed class edge types are `ClassBidirectional`, `ClassUnidirectional`, `ClassAggregation`, `ClassComposition`, `ClassInheritance`, `ClassDependency`, and `ClassRealization`.
- Roles and multiplicities are stored under `edge.data` as `sourceRole`, `targetRole`, `sourceMultiplicity`, and `targetMultiplicity`.
- Upstream conversion tests explicitly preserve multiplicities `"1"` and `"*"`; this iteration normalizes `"*"` to canonical `"0..*"`.

Not verified as structured Apollon fields:

- Attribute name, type, and visibility are not separate fields. They must be interpreted from the verified textual notation.
- Apollon does not constrain every arbitrary multiplicity string at the type level.

## 5. Canonical UML Model

`ModeloUMLCanonico` has zero imports from Apollon and contains:

- `id`, `nombre`, `version`, `clases`, and `relaciones`.
- `ClaseUML`: stable id, name, attributes, x/y position, and abstract flag.
- `AtributoUML`: stable id, parsed name, parsed type or `null` when it cannot be inferred, and optional verified visibility.
- `RelacionUML`: stable id, supported semantic type, source/target class ids, normalized endpoint multiplicities, and optional roles.
- `Multiplicidad`: `"0..1" | "1" | "0..*" | "1..*"`.
- `PosicionUML`: numeric `x` and `y` only; width and height are intentionally excluded.

`null` represents an absent or unsupported attribute type/multiplicity. The adapter also emits a development warning, so absence is never replaced with fabricated semantics.

## 6. Adapter

`AdaptadorApollon` is the only new module that imports `UMLModel`. It provides:

- `convertirAModeloCanonico(modeloApollon)` for the required direct conversion;
- `convertirAModeloCanonicoConAdvertencias(modeloApollon)` for the same conversion plus diagnostic warnings used by the development inspector;
- a deterministic attribute parser;
- multiplicity normalization;
- explicit class and relation-type filtering.

The canonical projection is derived with `useMemo` from CU02's current Apollon model. It is not a second writable source of truth.

## 7. Project Structure

```text
frontend/src/
├── nucleo/
│   └── modelo_uml/
│       └── ModeloUMLCanonico.ts
└── paquetes/
    └── modelado_uml/
        ├── compartido/
        │   └── integracion_apollon/
        │       ├── AdaptadorApollon.ts
        │       └── AdaptadorApollon.test.ts
        └── casos_uso/
            └── cu02_modelar_diagrama_clases/
                ├── PaginaModeladoClases.tsx
                └── componentes/
                    └── InspectorModeloDesarrollo.tsx
```

Package → Use Case remains the rule for business behavior. The small `nucleo/modelo_uml` exception contains only the cross-package semantic contract.

## 8. Mapping Rules

| Apollon representation | Canonical representation | Status |
|---|---|---|
| `node.type === "class"` | `ClaseUML` | PASS |
| `node.id`, `data.name` | class id and name | PASS |
| `data.attributes[].id` | stable attribute id | PASS |
| textual `+/- nombre: Tipo` | attribute name, type, public/private visibility | PASS |
| `node.position.x/y` | `PosicionUML` | PASS |
| `data.isAbstract` | `abstracta` | PASS |
| bidirectional/unidirectional class edge | `asociacion` | PASS |
| `ClassAggregation` | `agregacion` | PASS |
| `ClassComposition` | `composicion` | PASS |
| `ClassInheritance` | `generalizacion` | PASS |
| edge `source` / `target` | source/target class ids | PASS |
| `sourceRole` / `targetRole` | optional source/target roles | PASS |
| `1`, `0..1`, `0..*`, `1..*`, and `*` | normalized `Multiplicidad`; `*` becomes `0..*` | PASS |
| dependency or realization edge | omitted with warning | DEFERRED |
| unknown multiplicity | `null` plus warning | DEFERRED |

## 9. Files Created / Modified

Created:

- `frontend/src/nucleo/modelo_uml/ModeloUMLCanonico.ts` — Apollon-independent semantic contracts.
- `frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/AdaptadorApollon.ts` — mapping and controlled diagnostics.
- `frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/AdaptadorApollon.test.ts` — focused mapping tests.
- `docs/iterations/ITERATION_02_CANONICAL_MODEL_APOLLON_ADAPTER_REPORT.md` — this iteration evidence.

Modified:

- `README.md` — current iteration, canonical boundary, and report location.
- `frontend/index.html` — Spanish document language and current description/title.
- `frontend/package.json` and `frontend/package-lock.json` — stable package name `sw1-case-frontend`.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases.tsx` — derives the canonical projection from the current Apollon model.
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/componentes/InspectorModeloDesarrollo.tsx` — separate Apollon and canonical evidence, JSON, and warnings.
- `frontend/src/styles.css` — minimal inspector section and warning styles.
- `frontend/tests/e2e/cu02-modelado-clases.spec.ts` — browser proof of the canonical projection.

## 10. Tests

The adapter tests cover:

1. Empty class diagram.
2. Class id and name preservation.
3. Attribute id, name, type, and verified public/private notation.
4. Class position.
5. Abstract class flag.
6. Association, aggregation, composition, and inheritance mapping.
7. Endpoint ids, roles, and normalized multiplicities, including `*` to `0..*`.
8. Unsupported relation omission with an explicit warning.
9. Unsupported multiplicity represented as `null` with an explicit warning.

The existing tests for the Apollon host and model summary remain active. The Playwright scenario creates a real class and verifies both representations plus canonical JSON.

## 11. Commands Executed

| Command | Purpose | Actual result |
|---|---|---|
| `git status --short` | Verify starting tree | Clean |
| `git rev-parse HEAD` | Verify baseline | `cf18dc0e52423c51201013156994f20ecb7d4062` |
| focused `rg` / `Get-Content` in local Apollon source | Verify exact mapping fields and values | Findings in section 4; reference repository not modified |
| `npm test` | Run unit/component tests | PASS: 3 files, 15 tests |
| first `npm run typecheck` | Validate the initial implementation | FAIL: two nullable-result errors in the inspector; corrected immediately |
| `npm run typecheck` after correction | Validate strict TypeScript | PASS |
| `npm run build` | Build the production frontend | PASS: 2,242 modules; existing non-blocking large-chunk warning |
| `npm run test:e2e` | Verify the real browser flow | PASS: 1 Playwright test |

Dependencies were already installed and unchanged, so `npm install` was intentionally not repeated.

## 12. Verification

| Check | Result |
|---|---|
| Iteration 01 still works | PASS |
| Empty canonical mapping | PASS |
| Class mapping | PASS |
| Attribute mapping | PASS |
| Position mapping | PASS |
| Abstract mapping | PASS |
| Relationship mapping | PASS |
| Multiplicity mapping | PASS |
| Canonical inspector | PASS |
| `npm test` | PASS |
| typecheck | PASS |
| build | PASS |
| E2E | PASS |

## 13. Unsupported / Deferred Semantics

- Canonical-to-Apollon conversion is intentionally outside Iteration 02.
- Class methods are not part of the current generation-oriented semantic subset.
- Apollon interface and enumeration stereotypes are omitted with a warning.
- Dependency and realization relations are omitted with a warning.
- Attribute visibility `#` and `~` is recognized as notation but deferred because only public/private examples were verified in the inspected local fixtures.
- Attributes without a parseable `nombre: Tipo` keep their stable id and text name, receive `tipo: null`, and produce a warning.
- Multiplicities outside the normalized set become `null` and produce a warning.
- Width, height, edge waypoints, navigability, and round-trip layout are deferred because they are not required by this read adapter.

## 14. Deviations From Baseline

None.

The baseline's semantic boundary is implemented in the mandatory Apollon-to-canonical direction. Bidirectional synchronization remains deferred as explicitly allowed by the iteration scope.

## 15. Technical Debt

- Attribute semantics depend on Apollon's free-text UML notation; malformed or nonstandard text can only be reported, not fully interpreted.
- The development inspector remains exam/debug evidence and should later be gated or replaced by an end-user interface.
- The existing production bundle-size warning remains; optimization was explicitly outside this iteration.

## 16. Recommended Next Step

Implement focused model validation and generation-readiness rules over `ModeloUMLCanonico`: valid identifiers, required attribute types, supported relationship constraints, and actionable diagnostics. Do not begin Spring generation until those rules have a small tested contract.

## 17. Final Status

PASS

Iteration 01 remains operational; the canonical contract has no Apollon dependency; the adapter owns editor-specific knowledge; required semantic mappings and warning behavior are tested; the dual inspector and real-browser scenario demonstrate Apollon-to-canonical conversion; and all required final commands pass.
