# Iteration 06 — Deterministic One-to-Many JPA Relationship Generation

## 1. Objective

Extend the deterministic Spring generator with one precise relationship slice: a canonical UML association whose endpoint multiplicities are exactly `1 ↔ 0..*`, delivered through the existing HTTP/ZIP flow and compiled from scratch with Java 21.

## 2. Business Package / Use Case

**Primary package:** Generación de Backend  
**Primary use case:** CU09 — Generar backend Spring Boot

Related use cases:

- CU02 — Modelar diagrama de clases manualmente.
- CU08 — Validar modelo UML.
- CU10 — Obtener backend generado.

## 3. Starting Baseline

- Branch: `main`.
- Starting commit: `add0842dc42a961a4426380e553fbf073a76734b`.
- Working tree: clean.
- Iteration 05: committed and accepted.

## 4. Previous Limitation

Iteration 05 supported the complete generation/download flow, but CU09 rejected every relationship. Only independent entities could be generated, which excluded common conceptual models such as `Cliente 1 — 0..* Pedido`.

## 5. Supported Relationship Profile

Exactly one semantic profile is supported:

- canonical type: `asociacion`;
- endpoint multiplicities: `1 ↔ 0..*`;
- either source/target orientation;
- one or more such associations when their generated fields do not collide.

No other relationship or multiplicity is claimed as supported.

## 6. UML Meaning

For `Cliente "1" — "0..*" Pedido`, every `Pedido` references exactly one `Cliente`, while a `Cliente` may have zero or many `Pedido`. Therefore `Pedido`, the MANY side, owns the foreign key. The endpoint marked `1` identifies the referenced class; it does not identify the JPA owner.

## 7. Role Mapping Rule

An endpoint role becomes a property in the opposite class:

- `rolOrigen` → property in the target class that references the source.
- `rolDestino` → property in the source class that references the target.

Thus `rolOrigen = cliente` and `rolDestino = pedidos` generate `Pedido.cliente` and `Cliente.pedidos`. Without roles, the deterministic convention uses the lower-camel ONE class name for the MANY-side reference and the lower-camel MANY class name plus `s` for the collection. This is a project convention, not linguistic pluralization.

## 8. Generation Readiness Changes

The frontend CU09 evaluator now accepts independent models and supported `1 ↔ 0..*` associations. It blocks unsupported types/multiplicities, self-relations, invalid role-derived fields, scalar/relation collisions, relation/relation collisions, abstract classes, Java type-name conflicts, and any CU08-invalid model.

## 9. Canonical HTTP Contract Changes

`RelacionUMLEntrada` now carries both canonical multiplicities and optional endpoint roles. The explicit runtime guard validates canonical relation type, source/target ids, multiplicities (`0..1`, `1`, `0..*`, `1..*`, or `null`), and optional string roles. Malformed JSON returns HTTP 400 before generator execution. The backend remains independent of Apollon and geometry.

## 10. Spring IR Changes

`EntidadSpring` now contains prepared `relacionesMuchosAUno` and `relacionesUnoAMuchos`. `prepararRelacionUnoAMuchos` is the authoritative classifier: it identifies ONE/MANY classes, applies opposite-end roles/defaults, computes the join column and `mappedBy`, and rejects unsupported semantics. EJS templates receive resolved JPA semantics and do not interpret UML multiplicities.

## 11. JPA Mapping

The MANY entity receives:

- `@ManyToOne(optional = false)`;
- deterministic `@JoinColumn(name = "<campo_snake_case>_id", nullable = false)`;
- typed field, getter, and setter.

The ONE entity receives:

- `@OneToMany(mappedBy = "<campo_many_to_one>")`;
- initialized `List<ManyEntity>` collection;
- getter.

No cascade or orphan-removal semantics are generated.

## 12. JSON Recursion Strategy

The inverse ONE-side collection is annotated with Jackson `@JsonIgnore`, preventing recursive serialization without introducing DTOs, managed/back references, or mappers. DTO-based API shaping remains deferred.

## 13. Ownership and Service Update Behavior

The generated MANY-side `ServiceImpl.actualizar` copies the owning relationship, e.g. `existente.setCliente(pedido.getCliente())`. The inverse collection is not synchronized by generic update code because it does not own the foreign key.

## 14. Unsupported Relationships

Explicitly rejected:

- `1 ↔ 1`, optional one-to-one, `0..* ↔ 0..*`, and `1..*` semantics;
- aggregation and composition;
- generalization/inheritance;
- self-referencing associations;
- relation fields that collide with `id`, scalar attributes, or other generated relation fields.

## 15. Package Structure

```text
frontend/src/paquetes/
├── validacion/casos_uso/cu08_validar_modelo_uml/
└── generacion_backend/casos_uso/cu09_generar_backend_spring_boot/
    └── EvaluadorAptitudGeneracionSpring.ts

backend/src/paquetes/generacion_backend/
├── api/
│   ├── ValidarEntradaModeloCanonico.ts
│   └── probarFlujoRelacionHttp.ts
└── casos_uso/cu09_generar_backend_spring_boot/
    ├── ContratoModeloUMLCanonico.ts
    ├── ModeloProyectoSpring.ts
    ├── PrepararProyectoSpring.ts
    ├── fixtureClientePedido.ts
    └── plantillas/
        ├── Entidad.java.ejs
        └── ServiceImpl.java.ejs
```

## 16. Files Created / Modified

Created:

- `backend/.../api/probarFlujoRelacionHttp.ts` — reproducible real HTTP relation proof.
- `backend/.../cu09_generar_backend_spring_boot/fixtureClientePedido.ts` — canonical proof fixture.
- `backend/.../cu09_generar_backend_spring_boot/GeneradorRelacionesUnoAMuchos.test.ts` — focused mapping, safety, and rendering tests.
- This report.

Modified:

- `README.md`, `backend/package.json`.
- Backend canonical contract, runtime guard, Spring IR, preparation logic, entity/service templates, generator regression tests, and API integration tests.
- Frontend CU09 readiness evaluator/tests.
- Frontend CU08 validator/tests to remove the obsolete generic generator-capability warning.

## 17. Tests

Backend relationship tests cover supported and reversed orientations, roles, defaults, generated annotations/imports/fields, deterministic join column, JSON recursion protection, owner-side service update, absent cascade/orphan removal, unsupported multiplicities/types, self-relation, scalar collision, and multi-relation collision. API tests cover valid relation ZIP source content and malformed/unsupported relation HTTP 400 responses.

Frontend tests cover independent models, supported/reversed `1 ↔ 0..*`, unsupported multiplicities/types, self-relation, both collision categories, invalid CU08 input, abstract classes, and Java type-name conflicts. CU08 tests prove structural validation no longer emits generic generation-capability warnings.

## 18. Real HTTP Relationship Proof

`npm run proof:relation` started the actual Express application, posted `fixtureClientePedido`, received the ZIP, and extracted it under:

`backend/generated-test-output/relationship-proof/extraido/backend-generado/`

Result: **PASS**.

## 19. Generated Java Evidence

Relevant generated fragments:

```java
@JsonIgnore
@OneToMany(mappedBy = "cliente")
private List<Pedido> pedidos = new ArrayList<>();
```

```java
@ManyToOne(optional = false)
@JoinColumn(name = "cliente_id", nullable = false)
private Cliente cliente;
```

```java
existente.setCliente(pedido.getCliente());
```

No `CascadeType.ALL` or `orphanRemoval` was generated.

## 20. Maven Clean Compilation

The project extracted from the real relationship HTTP ZIP was compiled with:

`mvnw.cmd clean test`

Maven cleaned prior output, compiled 11 main Java source files using `release 21`, found no generated test sources, and finished with **BUILD SUCCESS**.

## 21. Browser Evidence

The existing real-browser regression suite remains automated and passing (2/2): Apollon-to-canonical flow plus scalar generation/download/ZIP inspection. Relationship creation through Apollon was not automated because it is optional for this iteration and the critical new semantic path is fully proven through canonical fixture → real HTTP → ZIP → Java inspection → Maven clean compilation. No hidden state hook or fabricated editor interaction was introduced.

## 22. Commands Executed

| Command | Directory | Result |
|---|---|---|
| Baseline Git commands | repository root | PASS: clean `main`, starting commit recorded |
| `npm test` (initial backend relationship run) | `backend` | One outdated regression fixture failed; corrected to include its referenced class |
| `npm test` | `backend` | PASS: 5 files, 37 tests |
| `npm run typecheck` | `backend` | PASS |
| `npm run build` | `backend` | PASS |
| `npm test` | `frontend` | PASS: 6 files, 56 tests |
| `npm run typecheck` | `frontend` | PASS |
| `npm run build` | `frontend` | PASS; existing bundle warning only |
| `npm run test:e2e` | `frontend` | PASS: 2 tests |
| `npm run proof:http` | `backend` | PASS: scalar regression proof |
| `npm run proof:relation` | `backend` | PASS: relationship HTTP/ZIP proof |
| `.\mvnw.cmd clean test` | extracted relationship project | PASS: 11 sources, release 21, BUILD SUCCESS |

## 23. Verification Matrix

| Check | Result |
|---|---|
| Iteration 05 flow still works | PASS |
| Independent entity generation still works | PASS |
| 1 → 0..* readiness | PASS |
| Reversed orientation | PASS |
| Role mapping | PASS |
| Default role naming | PASS |
| Field collision detection | PASS |
| Many side ownership | PASS |
| `@ManyToOne` | PASS |
| `@JoinColumn` | PASS |
| `@OneToMany` | PASS |
| `mappedBy` | PASS |
| JSON recursion protection | PASS |
| HTTP relationship generation | PASS |
| ZIP relationship project | PASS |
| Maven clean test | PASS |
| Frontend tests | PASS |
| Backend tests | PASS |
| E2E regression | PASS |

## 24. Deferred Features

One-to-one, many-to-many, `1..*`, optional ownership, aggregation/composition persistence, inheritance, enums, association attributes, join entities, cascade/orphan lifecycle rules, DTOs/mappers, live PostgreSQL, H2/Testcontainers, XMI, AI, voice, image reconstruction, collaboration, Flutter, authentication, Docker, and deployment.

## 25. Risks / Technical Debt

- Default collection pluralization is deliberately the simple `<variable>s` convention and is not linguistically complete.
- Frontend readiness mirrors the backend capability rules for immediate UX; future profile expansion must keep both tested against the same documented semantics.
- `@JsonIgnore` is sufficient for this slice but DTOs may later provide cleaner external API representations.
- Maven proves clean compilation; runtime database behavior remains unverified by design.

## 26. Deviations

None. Browser relationship automation was optional and intentionally not added; the existing E2E regression remains passing and the new relationship path has stronger deterministic HTTP/source/Maven evidence.

## 27. Recommended Next Iteration

Add a generated application integration test and the smallest PostgreSQL runtime CRUD proof for the supported MANY-side foreign key, without introducing additional relationship types or lifecycle semantics.

## 28. Final Status

**PASS**

The exact `asociacion 1 ↔ 0..*` profile is accepted in either orientation, roles/defaults and collisions are deterministic, JPA ownership is correct, unsupported semantics remain explicit, and the project generated through the real HTTP ZIP flow compiles cleanly with Java 21.
