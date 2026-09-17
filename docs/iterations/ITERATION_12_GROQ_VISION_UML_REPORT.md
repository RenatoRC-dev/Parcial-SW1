# Iteration 12 — Groq Vision UML Candidate Import

## 1. Objective

Prove the CU05 flow image → server-side vision → validated UML candidate → user review → explicit confirmation → additive canonical merge → Apollon/Yjs, without mutating the active model during analysis.

## 2. Business Package / Use Case

- Package: Asistencia Inteligente
- Use case: CU05 — Obtener modelo UML desde imagen

## 3. Starting Baseline

- Branch: `main`
- HEAD: `38d96b366c9e4c9cae974653391763d14e0f661a`
- `main...origin/main`: `0 0`
- Working tree: clean
- Iteration 11: PASS

## 4. Existing Acceptance Gates

- `EA-XMI-001`: OPEN — unchanged and unrelated to CU05.
- `GROQ-AI-001`: CLOSED — REAL GROQ ACCEPTANCE PASS.
- `GROQ-VOICE-001`: CLOSED — REAL GROQ VOICE ACCEPTANCE PASS.
- `GROQ-VISION-001`: CLOSED — REAL GROQ VISION ACCEPTANCE PASS.

## 5. Business Problem

CU05 reduces manual reconstruction of class diagrams found in photographs, whiteboards, screenshots and documentation while preventing uncertain visual interpretation from silently changing the shared model.

## 6. Product Decision — Candidate Before Mutation

CU04 text/voice expresses an explicit incremental instruction and keeps automatic application. CU05 analyzes probabilistic visual evidence, so it returns a local candidate that requires explicit confirmation. Analysis alone never mutates the active model.

## 7. Supported Visual UML Profile

- Class names.
- Attribute names and a type only when visible; absent types remain `null`.
- Associations between candidate classes.
- Multiplicities `0..1`, `1`, `0..*`, `1..*` and endpoint roles when visible.
- One PNG or JPEG per analysis.

## 8. Explicitly Unsupported Visual Semantics

Generalization, aggregation and composition are not executable CU05 candidate relationships. They must be omitted with a warning, never converted to association. Methods, stereotypes, PDFs, multiple images and image-based updates to existing classes are deferred.

## 9. Candidate Contract

`CandidatoModeloUMLImagen` contains candidate classes, attributes, associations and warnings. Elements use `tmp_*` references only. It contains no canonical IDs, coordinates, revision, Yjs state or project identity.

## 10. Groq SDK / Vision API Verification

- Installed package: `groq-sdk@1.6.0` (`npm ls groq-sdk --depth=0`).
- Installed types expose multimodal `content` parts with `type: "image_url"`, a URL/base64 value and `detail`.
- Client construction supports bounded `timeout` and `maxRetries`.
- Completion response content is available through `choices[0].message.content`.
- Official [Groq Vision documentation](https://console.groq.com/docs/vision) confirms local data URLs and JSON Object Mode for the Qwen vision family. A direct account diagnostic found `qwen/qwen3.6-27b` inaccessible and `qwen/qwen3.8-27b` available.
- Official [Structured Outputs documentation](https://console.groq.com/docs/structured-outputs) does not list Qwen 3.6 for strict JSON Schema. CU05 therefore uses JSON Object Mode followed by deterministic parsing and validation; it does not claim strict structured output.

## 11. Vision Model Decision

Default: `qwen/qwen3.8-27b`, centralized in `ProveedorVisionGroq` and overridable with `GROQ_VISION_MODEL`. The direct diagnostic also proved that this account/tier needs an explicit conservative `max_tokens: 512`; the production request now includes it. Groq documents the model as preview, so availability/deprecation remains a real risk.

## 12. Provider Boundary

`ProveedorVisionUML` is separate from the text and transcription providers. The production implementation is `ProveedorVisionGroq`; E2E composition injects one deterministic implementation.

Provider errors preserve controlled 429/503 behavior. A Groq `404` with code `model_not_found` is mapped separately to `modelo_no_disponible`, so the API explains that the configured vision model does not exist or is unavailable for the current account instead of reporting generic temporary unavailability.

## 13. Vision Prompt Rules

The compact prompt requires visible-only extraction, no domain inference, no invented types/cardinalities, temporary references only, supported associations only, warnings for uncertainty and JSON-only output.

## 14. Untrusted Image Text / Prompt-Injection Boundary

The prompt explicitly treats all text inside the image as diagram data that cannot override system extraction rules. Deterministic candidate validation remains authoritative.

## 15. Image Upload API

`POST /api/ia/imagen/analizar`, multipart field `imagen`, returns either `candidato` or `sin_modelo`. The route only analyzes; it has no browser model access and performs no mutation.

## 16. Image Validation

The route accepts only PNG/JPEG, one file, non-empty bytes and at most 10 MB. It validates MIME plus the PNG/JPEG magic-byte prefix. Invalid input returns 400 and oversized input returns 413.

## 17. No Permanent Image Storage

Multer memory storage passes bytes directly to the provider. No upload directory, image table or persistent image record was created. Base64 conversion exists only inside `ProveedorVisionGroq`.

## 18. Candidate Validation

The backend validates object shape, non-empty/unique case-insensitive class names, unique temporary references, attributes, internal relationship endpoints, supported multiplicities/type, warnings and limits of 30 classes, 50 attributes per class and 60 relationships. A malformed provider response is rejected in full.

## 19. Candidate Preview UX

The separate “Desde imagen” panel shows selected file information, an Object URL preview, detected classes/attributes, relationships, roles and warnings. All detected attributes remain visible. Attributes without a visible type are marked “tipo no visible · no se importará”; visible types outside the CU08 profile are marked “tipo no soportado · no se importará”. It is a semantic review, not a second UML editor.

## 20. Confirmation / Cancellation

`Agregar al diagrama` is required. `Cancelar` clears the candidate without mutation. A new image also clears the previous candidate. Overlapping analyses are disabled.

## 21. Additive Merge Policy

Confirmation builds `current model + candidate`. It never replaces the existing active model and never performs image-based delete, rename or inferred update.

## 22. Collision Rules

A case-insensitive class-name collision with the latest current model blocks the complete operation. Attributes are not silently merged and classes are not automatically renamed.

## 23. Temporary → Stable ID Mapping

The application maps temporary references to stable application-generated IDs at confirmation using the established `categoria-crypto.randomUUID()` convention. Candidate relationships are resolved through that single mapping. IDs are generated only for attributes that will actually be imported.

## 24. Deterministic Positioning

Candidate classes use a two-column grid. Empty models start at `(100, 100)`; non-empty models place the candidate cluster 350 pixels to the right of the current maximum x position. AI never returns coordinates.

## 25. Reuse of CU08 Validation

CU05 reuses the exported `TIPOS_GENERACION_SOPORTADOS` vocabulary from CU08. Untyped or unsupported attributes remain unchanged in the visual candidate but are deterministically excluded from the importable subset; no replacement type is invented. The complete merged `ModeloUMLCanonico`, containing all classes, supported attributes and supported relationships, is then passed to the existing `validarModelo`.

## 26. Atomic Application

Importability filtering, collision checks, endpoint resolution and CU08 validation complete before `alAplicarModelo` is called. Atomicity applies to the complete importable subset: all supported candidate semantics are applied together or none are. Excluded attributes remain visible findings in the unchanged candidate and are never silently converted.

## 27. Apollon Integration

The page passes the valid merged canonical model through the existing `convertirDesdeModeloCanonico` replacement boundary. CU05 does not create Apollon internals directly.

## 28. Collaboration Behavior

Image selection, bytes, analysis state and candidate preview remain local. After confirmation, the existing Apollon/Yjs mechanism propagates ordinary UML elements; no new collaboration protocol was added.

## 29. Concurrent Model Change During Preview

The panel receives the latest canonical model on every render. Confirmation evaluates collisions, merge and validation against that latest model, so a class created by a collaborator while preview is open can safely block confirmation.

## 30. Backend Tests

Backend tests cover valid PNG/JPEG, missing/empty/unsupported/oversized content, signatures, provider metadata, controlled 429/503 mapping, explicit `404 model_not_found` mapping, selected default model, secret suppression, candidate limits and malformed/duplicate/unsupported semantics. Result: 14 files, 110 tests PASS.

## 31. Frontend Tests

Frontend tests cover selection without automatic analysis, analysis state, Object URL cleanup, candidate rendering, warnings, explicit non-importable labels, no mutation before confirmation, cancel, exactly-once confirm, supported-subset import, absence of invented types, CU08 validation, additive placement and invalid endpoints. The latest-model collision test now analyzes against an empty model, rerenders with a newly conflicting `Factura`, and proves confirmation revalidates without clearing the candidate. Result: 14 files, 108 tests PASS.

## 32. Image Preview E2E

PASS. A real multipart PNG request reaches the deterministic backend; `Factura` appears in the candidate while Apollon and the canonical summary remain empty.

## 33. Confirm Apply E2E

PASS. Confirmation creates real Apollon classes, attributes and the association; the canonical inspector reports two classes and one relationship.

## 34. Cancel / Collision Evidence

Cancel is proven in browser E2E with zero model mutation. Case-insensitive collision is proven after a candidate is already visible and the component receives a newer conflicting model through rerender. Atomic no-mutation behavior is proven in focused component/unit tests.

## 35. Image → Collaboration E2E

PASS. Bruno sees neither candidate nor model changes before Ana confirms. After confirmation, both real Apollon editors show `Factura` through the existing Yjs channel.

## 36. Real Groq Vision Proof

PASS. The user executed `npm run proof:imagen:groq` with a real PNG/JPEG UML fixture and the real Groq API. The non-secret evidence was:

```json
{
  "realGroqVisionUsed": true,
  "model": "qwen/qwen3.8-27b",
  "candidateReceived": true,
  "containsClassFactura": true,
  "containsNumero": true,
  "containsTotal": true,
  "numeroTypeRecognized": true,
  "totalTypeRecognized": true,
  "semanticCondition": true
}
```

The initial account diagnostic found `qwen/qwen3.6-27b` unavailable and confirmed access to `qwen/qwen3.8-27b`. The application uses a bounded `max_tokens: 512` output configuration to stay within the observed account OTPM restriction; this is an application/account decision, not a universal Groq requirement. The final semantic proof passed against the real provider.

## 37. Regression Results

- `proof:http`: PASS.
- `proof:relation`: PASS.
- `proof:xmi`: PASS; it correctly reports `realEnterpriseArchitectUsed: false`.
- Existing browser scenarios and the three CU05 scenarios: 11/11 PASS.

## 38. Package → Use Case Structure

```text
backend/src/paquetes/asistencia_ia/
├── casos_uso/cu05_modelar_desde_imagen/
├── compartido/contrato/CandidatoModeloUMLImagen.ts
├── compartido/proveedores/vision/
└── pruebas/ProveedorVisionDeterministaE2E.ts, probarVisionGroqReal.ts

frontend/src/paquetes/asistencia_ia/casos_uso/
└── cu05_modelar_desde_imagen/
```

## 39. Files Created / Modified

- Backend: candidate contract; provider interface/Groq provider; candidate validator; image use case/route and tests; deterministic E2E provider; real proof; CASE composition and package script.
- Frontend: CU05 contract, HTTP client, atomic candidate merger and tests, image panel and tests, page composition, styles, and `asistente-imagen.spec.ts`.
- Documentation: root README, pending gate register and this report.

## 40. Commands Actually Executed

| Command | Result |
|---|---|
| Initial Git baseline commands | PASS — clean, `main`, HEAD recorded, synchronized |
| `npm ls groq-sdk --depth=0` (backend) | PASS — 1.6.0 |
| Focused CU05 merger/panel tests | PASS — 12/12 after audit correction |
| `npm test` (backend) | PASS — 110/110 |
| `npm run typecheck` (backend) | PASS |
| `npm run build` (backend) | PASS |
| `npm test` (frontend) | PASS — 108/108 |
| `npm run typecheck` (frontend) | PASS |
| `npm run build` (frontend) | PASS — known non-blocking bundle warning |
| `npm run test:e2e` (frontend) | PASS — 11/11 |
| `npm run proof:http` | PASS |
| `npm run proof:relation` | PASS |
| `npm run proof:xmi` | PASS |
| `npm run proof:imagen:groq` | PASS — user-executed real provider acceptance |

## 41. Verification Matrix

| Check | Result |
|---|---|
| Iterations 01–11 regressions | PASS |
| EA-XMI-001 unchanged | PASS |
| GROQ-AI-001 remains closed | PASS |
| GROQ-VOICE-001 remains closed | PASS |
| CU05 separate from CU04 | PASS |
| Vision server-side only | PASS |
| GROQ_API_KEY absent from frontend | PASS |
| One image per request | PASS |
| Image size bounded | PASS |
| MIME validated | PASS |
| No permanent image storage | PASS |
| Candidate returned before mutation | PASS |
| Analysis alone causes zero mutation | PASS |
| Candidate visible | PASS |
| Explicit confirmation required | PASS |
| Cancel causes zero mutation | PASS |
| Additive import only | PASS |
| Existing model never replaced automatically | PASS |
| Name collision blocks import | PASS |
| No AI stable IDs | PASS |
| No AI coordinates | PASS |
| Deterministic IDs | PASS |
| Deterministic positions | PASS |
| CU08 validator reused | PASS |
| Atomic candidate application | PASS |
| Confirmed candidate reaches Apollon | PASS |
| Confirmed candidate reaches collaborator | PASS |
| Candidate preview not synchronized | PASS |
| Unsupported semantics not silently converted | PASS |
| Backend tests | PASS |
| Frontend tests | PASS |
| Typechecks | PASS |
| Builds | PASS |
| Browser E2E | PASS |
| Real Groq vision proof | PASS |

## 42. Risks / Technical Debt

- `qwen/qwen3.8-27b` is a preview model and can be deprecated; configuration is centralized for an evidence-driven replacement.
- The candidate preview is intentionally read-only. Untyped or unsupported attributes are omitted from the confirmed import and must be added or corrected manually in Apollon if the designer needs them.

## 43. Deferred Features

PDF/multi-image input, camera controls, OCR libraries, candidate editing/history/persistence/collaboration, unsupported relationship kinds, image-based patching, automatic replacement, authentication and database storage.

## 44. Recommended Next Iteration

CU01 + CU11 — project creation/opening plus save/recovery. Not implemented here.

## 45. Final Status

PASS

All deterministic implementation, regression and browser evidence passes. The external real Groq image fixture proof also passed with `qwen/qwen3.8-27b`, so `GROQ-VISION-001` is closed and Iteration 12 is complete.
