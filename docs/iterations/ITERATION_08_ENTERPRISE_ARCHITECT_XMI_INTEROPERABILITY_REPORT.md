# Iteration 08 — Enterprise Architect XMI Interoperability

## 1. Objective

Implement the smallest supported XMI path from Enterprise Architect-oriented XMI to the canonical UML model and editable Apollon diagram, and from the current canonical model back to downloadable XMI.

## 2. Business Package and Use Cases

- Package: **Interoperabilidad**.
- CU06 — Importar modelo desde Enterprise Architect.
- CU07 — Exportar modelo hacia Enterprise Architect.
- Related: CU02 — Modelar diagrama de clases manualmente.

CU06 and CU07 own interchange. CU02 continues to own the live editable Apollon representation.

## 3. Starting Baseline

- Branch: `main`.
- Starting commit: `b53a21e43111308cae60dbaaa6db3f15156f9fb6`.
- Initial state: clean working tree.
- Iterations 01–07: committed and accepted.

## 4. Professor Requirement Addressed

The professor requires class-model exchange with Enterprise Architect through XMI. This iteration adds import, editable loading, export, controlled errors, and internal semantic round-trip evidence. Real EA acceptance remains mandatory before claiming complete interoperability.

## 5. Supported Interoperability Profile

- UML classes, names, and stable element IDs.
- Scalar attribute names and types; an absent EA type is preserved as canonical `null`.
- Independent classes.
- Import of associations with canonical multiplicities `1`, `0..1`, `0..*`, `1..*` or an incomplete end when the EA bound cannot be represented safely.
- Import of aggregation, composition and generalization without pretending they are Spring-generable.
- Endpoint roles when present.
- Abstract class state declared in XMI.
- Class positions from real diagram geometry when available; otherwise deterministic positions.
- Export remains limited to the previously verified `1 ↔ 0..*` association profile.

The imported canonical `version` is the application/editor model version `4.2.0`; it is not labeled as a UML or XMI version. The exchange file rendered by the current `crunch_uml` version declares XMI 2.1 and UML 2.1 namespaces; no UML 2.5 compatibility is claimed.

## 6. Explicitly Unsupported Semantics

Attribute visibility, methods, enumerations, arbitrary multiplicity bounds outside the canonical vocabulary, nested packages, arbitrary stereotypes, notes, and style fidelity remain outside the verified exchange profile. The broader import support does not broaden export or Spring generation: export continues to reject unsupported canonical semantics rather than silently truncating them, and CU09 reports its own readiness limits.

## 7. crunch_uml Source Findings

Read-only repository: `D:\2-2026\SW1\crunch_uml`, revision `89e871f7293ac489233173d915dfe832a18c581b`.

- Package `crunch_uml`, version `0.6.0`; Python `>=3.10,<3.14`.
- `crunch_uml/parsers/eaxmiparser.py`: `EAXMIParser`, registered as `eaxmi`, reads EA extensions, roles, diagrams, and geometry.
- `crunch_uml/parsers/xmiparser.py`: file/URL `parse(args, schema)` API; maps packages, classes, attributes, associations, multiplicity bounds, and generalizations.
- `crunch_uml/renderers/xmirenderer.py`: `XMIRenderer`, registered as `xmi`, writes XMI 2.1 plus the Enterprise Architect extension section.
- `crunch_uml/db.py`: SQLAlchemy `Class`, `Attribute`, `Association`, `Diagram`, and diagram-membership geometry. Multiplicities use lower/upper strings and roles use `src_role`/`dst_role`.
- `crunch_uml/schema.py`: save/query boundary used by the bridge.
- Class geometry is held in `DiagramClass.x/y/width/height`.
- The internal class model has no reliable abstract flag and the attribute model has no persisted visibility field. Both are excluded rather than fabricated.
- APIs are file-based. The bridge uses a fresh in-memory SQLite schema per subprocess.

## 8. Integration Architecture

`Node/TypeScript → execFile(argument array) → Python bridge → crunch_uml`

`AdaptadorCrunchUML` resolves optional `SW1_CRUNCH_UML_PATH`, otherwise discovers the sibling repository. Every operation has a fresh temporary directory, a 30-second timeout, captured output, and `finally` cleanup. Internal Python details do not leak through HTTP.

## 9. Import Flow

`EA/XMI → POST /api/interoperabilidad/xmi/importar → EAXMIParser → normalized JSON → ModeloUMLCanonico → convertirDesdeModeloCanonico → ApollonEditor.model → editable diagram`

Import accepts XML content, enforces 5 MB, returns structured warnings, and asks for confirmation before replacement.

## 10. Export Flow

`Apollon → existing forward adapter → current ModeloUMLCanonico → POST /api/interoperabilidad/xmi/exportar → crunch schema → XMIRenderer → modelo.xmi`

Raw Apollon state never crosses the export API.

## 11. Canonical → Apollon Adapter

The existing editor boundary now includes `convertirDesdeModeloCanonico`. It creates the public `UMLModel` representation with class nodes, attributes, positions, association edges, multiplicities, roles, and stable IDs. `AnfitrionEditorApollon` uses the verified public `ApollonEditor.model` setter and `updateDiagramTitle`; no internal Apollon store is mutated.

Apollon 5.3.0 declarations in `frontend/node_modules/@tumaet/apollon/dist/index.d.ts` explicitly expose `set model(incoming: UMLModel)` and document one-way host model replacement.

## 12. Stable ID Strategy

XMI/crunch class, attribute, and association IDs are preserved through canonical and Apollon elements. No random or name-based element IDs are generated. If an imported XMI has no package ID, the model container receives a deterministic content-hash ID. The Apollon container model ID remains editor-owned; semantic element IDs remain stable.

## 13. Geometry Strategy

The first imported EA diagram supplies `x/y` where available. Otherwise classes use a deterministic three-column grid starting at `(100,100)`. Export creates one deterministic diagram and writes canonical positions with fixed readable dimensions. No auto-layout engine was added.

## 14. Unsupported-Semantics Policy

- Import supported content and emit warnings for omitted enumerations, generalizations, abstraction, visibility, aggregation, composition, and unsupported associations.
- Export rejects unsupported relation types/multiplicities, abstract classes, and attribute visibility.
- Aggregation/composition are never reinterpreted as association.

## 15. API Endpoints

- `POST /api/interoperabilidad/xmi/importar`: raw `application/xml`/`text/xml`; returns `{ modelo, advertencias }`.
- `POST /api/interoperabilidad/xmi/exportar`: canonical JSON; returns `application/xml` and `attachment; filename="modelo.xmi"`.
- 400: invalid XMI or unsupported canonical export.
- 413: payload over 5 MB.
- 503: Python/crunch configuration unavailable.
- 500: unexpected controlled bridge failure.

## 16. Frontend UX

The designer workspace has a compact **Interoperabilidad XMI** panel. It accepts `.xmi`/`.xml`, reads text, confirms destructive replacement, displays progress/errors/warnings, loads the imported model into Apollon, and downloads the current canonical model as `modelo.xmi`.

## 17. Automated Tests

- Real bridge canonical → XMI → canonical.
- Independent class and Cliente/Pedido fixture import.
- Stable IDs, attributes, positions, association, multiplicities, and roles.
- Malformed and oversized XMI handling.
- Unsupported import warning/export rejection.
- XML media type and download filename.
- Canonical → Apollon → canonical.
- Import cancellation and visible frontend service errors.
- Browser import, replacement, visible classes, download, and backend reimport.

## 18. Internal XMI Round-Trip Proof

`npm run proof:xmi` executed the real Python/crunch bridge in both directions. Ignored evidence is written under `backend/generated-test-output/xmi-proof/`.

Result: export, import, class count, attributes, association, multiplicities, and roles all `true`; `realEnterpriseArchitectUsed` is explicitly `false`.

## 19. Round-Trip Semantic Comparison

The deterministic fixture preserved Cliente and Pedido; `nombre`, `email`, and `fecha` types; association endpoints; multiplicities `1` and `0..*`; and roles `cliente` and `pedidos`. The comparison is semantic, not byte/order based.

## 20. Real Enterprise Architect Test — Tool → EA

**BLOCKED.** No Enterprise Architect executable was found. No successful import or screenshot is claimed.

## 21. Real Enterprise Architect Test — EA → Tool

**BLOCKED.** No EA-produced acceptance fixture was available. Internal crunch output is not presented as EA-origin evidence.

## 22. EA Version and Settings

Unavailable because Enterprise Architect is not installed in the execution environment. No version or option is invented.

## 23. Package → Use Case Structure

```text
backend/src/paquetes/interoperabilidad/
├── casos_uso/
│   ├── cu06_importar_modelo_xmi/importarModeloXmi.ts
│   └── cu07_exportar_modelo_xmi/exportarModeloXmi.ts
├── compartido/crunch_uml/
│   ├── AdaptadorCrunchUML.ts
│   ├── bridge_crunch_uml.py
│   ├── ContratoInteroperabilidadXmi.ts
│   └── fixtureInteroperabilidad.ts
└── pruebas_runtime/probarFlujoXmi.ts

frontend/src/paquetes/interoperabilidad/
├── casos_uso/
│   ├── cu06_importar_modelo_xmi/importarModeloXmi.ts
│   └── cu07_exportar_modelo_xmi/exportarModeloXmi.ts
└── compartido/PanelInteroperabilidadXmi.tsx

frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/
└── AdaptadorApollon.ts
```

## 24. Files Created / Modified

Created: backend interoperability contract, adapter, Python bridge, CU06/CU07 exports, fixture, proof and tests; frontend CU06/CU07 services, shared panel/tests and E2E; EA checklist; this report.

Modified: `.gitignore`, backend scripts/build-copy/API composition, Apollon reverse adapter/tests/host, CU02 page, styles, and README.

No tracked source modification was detected in the read-only `crunch_uml` or Apollon repositories. Their working trees contain pre-existing local untracked audit text files (`contenido_*_completo.txt` and `estructura_*_arbol.txt`), so this report does not claim that those repositories are completely clean.

## 25. Commands Actually Executed

- Mandatory Git baseline: PASS; clean `main`, starting HEAD recorded.
- Python 3.13.5 verified; initial import exposed missing dependencies, then an ignored local venv was created from the local requirements.
- Focused backend/frontend tests during implementation: initial failures were diagnosed and corrected.
- Final backend: `npm test`, `npm run typecheck`, `npm run build`, `npm run proof:xmi`, `npm run proof:http`, `npm run proof:relation`.
- Final frontend: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`.
- EA executable discovery: none found.

## 26. Verification Matrix

| Check | Result |
|---|---|
| Existing iterations regressions | PASS |
| crunch source verified | PASS |
| Python bridge import | PASS |
| Python bridge export | PASS |
| XMI malformed handling | PASS |
| Classes import | PASS |
| Attributes import | PASS |
| 1:N association import | PASS |
| Multiplicities import | PASS |
| Roles import | PASS |
| Canonical → Apollon | PASS |
| Imported diagram editable | PASS |
| Canonical → XMI export | PASS |
| Internal XMI round-trip | PASS |
| Semantic preservation | PASS |
| Browser import | PASS |
| Browser export | PASS |
| Real EA imports our XMI | BLOCKED |
| Tool imports real EA XMI | PASS — real EA model loaded (approximately 37 classes, 315 attributes and 37 relationships) |

## 27. Risks / Technical Debt

- Full interoperability remains unaccepted until a real EA test passes both directions.
- This external acceptance remains traceable as [`EA-XMI-001`](../quality/PENDING_ACCEPTANCE_GATES.md); it may only be closed with real Enterprise Architect evidence.
- The bridge depends on the read-only sibling repository and an ignored Python environment.
- Attribute visibility remains excluded because the verified crunch model does not preserve it reliably.
- Only the first imported diagram contributes positions.

### Post-iteration import stabilization

A real EA-produced conceptual model exposed a distinction that the original profile blurred. CU08 now treats absent attribute types as one summarized completeness warning and preserves each `tipo = null`; CU09 alone rejects missing or unsupported types for Spring generation. Import no longer discards representable association multiplicities, aggregation, composition, generalization, or abstraction merely because the generator cannot consume them. Warning text uses semantic class/attribute names rather than raw `EAID_*` identifiers. The property inspector lists relationships compactly and opens one editor on demand, avoiding dozens of permanently expanded forms.

The real EA import is evidence for the EA → SW1 direction only. `EA-XMI-001` remains open until the documented SW1 → EA direction and complete bidirectional semantic checks also pass.

## 28. Deviations

Automated and browser paths are complete, and an EA-produced conceptual model has now been imported. The reverse SW1 → EA acceptance direction and the complete bidirectional semantic checklist have not yet been recorded, so the iteration cannot be marked PASS.

## 29. Recommended Next Iteration

Complete the remaining SW1 → EA acceptance direction and record the full bidirectional semantic checklist. Make only evidence-driven compatibility corrections if needed.

## 30. Final Status

**PARTIAL — REAL ENTERPRISE ARCHITECT ROUND-TRIP PENDING**

Internal automation and the EA → SW1 import direction are verified. The SW1 → EA direction and final bidirectional acceptance evidence remain pending under `EA-XMI-001`.
