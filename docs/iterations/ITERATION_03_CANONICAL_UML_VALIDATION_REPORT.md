# Iteration 03 — Canonical UML Validation + Generation Readiness

## 1. Objective

Determine deterministically whether a `ModeloUMLCanonico` is ready to enter the initial Spring Boot generator, returning actionable diagnostics instead of a simple boolean.

## 2. Business Package / Use Case

**Package:** Validación

**Use Case:** CU08 — Validar modelo UML

The implementation resides under `paquetes/validacion/casos_uso/cu08_validar_modelo_uml`. It consumes the cross-cutting canonical contract and has no dependency on Apollon.

## 3. Validation Contract

`ResultadoValidacion` contains:

- `valido`: false when at least one error exists;
- `diagnosticos`: explicit `DiagnosticoValidacion` entries;
- severity `error` or `advertencia`;
- stable code, readable message, optional element type, and optional element id.

Warnings do not invalidate the model.

## 4. Rules Implemented

| Code | Severity | Rule |
|---|---|---|
| `MODELO_SIN_CLASES` | Error | At least one class is required for generation |
| `CLASE_NOMBRE_REQUERIDO` | Error | Class name is required |
| `CLASE_IDENTIFICADOR_INVALIDO` | Error | Class name must match the supported Java class convention |
| `CLASE_NOMBRE_DUPLICADO` | Error | Class names are unique after ASCII case normalization |
| `ATRIBUTO_NOMBRE_REQUERIDO` | Error | Attribute name is required |
| `ATRIBUTO_IDENTIFICADOR_INVALIDO` | Error | Attribute name must match the supported Java field convention |
| `ATRIBUTO_ID_RESERVADO` | Error | `id` is reserved for the generated `Long` identity field |
| `ATRIBUTO_NOMBRE_DUPLICADO` | Error | Attribute names are unique within their class after case normalization |
| `ATRIBUTO_TIPO_REQUERIDO` | Error | Attribute type cannot be null or empty |
| `ATRIBUTO_TIPO_NO_SOPORTADO` | Error | Type must belong to the initial generation profile |
| `RELACION_EXTREMO_INEXISTENTE` | Error | Both relation endpoints must reference canonical classes |
| `RELACION_MULTIPLICIDAD_INCOMPLETA` | Warning | Future JPA mapping needs both endpoint multiplicities |
| `RELACION_GENERACION_DIFERIDA` | Warning | Iteration 04 does not generate relationships |

Class identifiers use `[A-Z][A-Za-z0-9]*`; field identifiers use `[a-z][A-Za-z0-9]*`. Duplicate comparison trims and lowercases the accepted ASCII names. This intentionally small convention accepts examples such as `Cliente`, `DetallePedido`, `nombre`, and `fechaNacimiento` while rejecting clearly unsafe generation input.

## 5. Errors vs Warnings

Errors identify input that would make the supported generator empty, ambiguous, or uncompilable. Any error makes `valido` false.

Warnings describe supported canonical structures that the next generator slice intentionally defers. Structurally valid relationships therefore keep the UML model valid but clearly signal that relationship generation is not ready.

## 6. Files Created / Modified

Created:

- `frontend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.ts`
- `frontend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.test.ts`
- `docs/iterations/ITERATION_03_CANONICAL_UML_VALIDATION_REPORT.md`

Modified:

- `PaginaModeladoClases.tsx` to validate the derived canonical model.
- `InspectorModeloDesarrollo.tsx` to show validation state, counts, and diagnostics.
- `styles.css` for compact validation evidence.
- `cu02-modelado-clases.spec.ts` for browser-level validation evidence.

## 7. Tests

Focused tests cover empty model, valid class, required and valid class names, duplicate class names, required and valid attribute names, duplicate attributes, required type, unsupported type, supported profile types, dangling relations, and structurally valid deferred relations.

The existing Apollon host, adapter, and browser tests remain active.

## 8. Commands Executed

| Command | Result |
|---|---|
| `git status --short` | PASS: clean starting tree |
| `git branch --show-current` | PASS: `main` |
| `git rev-parse HEAD` | PASS: `8a739ba7badb6e34713e61314895953833e04884` |
| `npm test` | PASS: 4 files, 39 tests after the generation-safety additions |
| `npm run typecheck` | PASS |
| `npm run build` | PASS: 2,243 modules; known bundle-size warning only |
| `npm run test:e2e` | PASS: 1 real Chrome test |

## 9. Verification Results

| Check | Result |
|---|---|
| CU08 package exists | PASS |
| Explicit errors and warnings | PASS |
| Invalid and duplicate names | PASS |
| Missing and unsupported types | PASS |
| Dangling relationship | PASS |
| Generation readiness warning | PASS |
| Frontend validation evidence | PASS |
| Unit/component tests | PASS |
| Typecheck | PASS |
| Production build | PASS |
| Browser E2E | PASS |

## 10. Deferred Validations

- Full UML 2.5 validation.
- Relationship-specific JPA ownership and mapping rules.
- Inheritance and enumeration generation readiness.
- Methods, indexes, DTOs, security, and database constraints.
- General Unicode Java-identifier support.

## 11. Deviations

None.

## 12. Final Status

PASS

The canonical validator exists under CU08, produces deterministic errors and warnings, exposes visible frontend evidence, and all required frontend commands pass. The gate to Iteration 04 is satisfied.
