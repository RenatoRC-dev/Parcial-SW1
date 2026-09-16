# Iteration 04 — First Deterministic Spring Boot Generation Vertical Slice

## 1. Objective

Prove one small end-to-end generation path from valid canonical UML semantics to a real Spring Boot CRUD project that compiles with Java 21.

## 2. Business Package / Use Case

**Package:** Generación de Backend

**Use Case:** CU09 — Generar backend Spring Boot

The CASE application's generator resides under `backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/`. It is not itself the generated Spring application.

## 3. Input Contract

The generator never imports Apollon. It accepts `ModeloUMLCanonicoEntrada`, a backend boundary DTO structurally matching the canonical fields needed by this generation slice.

This uses the prompt's strategy B: an explicit backend boundary instead of introducing a monorepo/shared-package toolchain only to share one TypeScript interface. Extra canonical fields such as geometry and multiplicities are irrelevant to scalar generation and remain outside the generator IR.

## 4. Generation Architecture

```text
ModeloUMLCanonico
        ↓
CU08 validation / generator boundary checks
        ↓
ModeloProyectoSpring
        ↓
EJS templates
        ↓
Spring Boot project
        ↓
Maven Wrapper test with Java 21
```

The intermediate model contains fixed project settings, entities, scalar fields, normalized Java types, imports, variable names, and table/column names. Templates render this already interpreted model and do not decide UML semantics.

## 5. Supported Scope

- One or more independent concrete classes.
- Scalar attributes from the supported type table.
- Generated `Long id` with `GenerationType.IDENTITY`.
- JPA entity with explicit constructor, getters, and setters.
- Repository, Service, ServiceImpl, and REST Controller CRUD layers.
- Spring Boot 3.5.16, Java 21, Maven, Spring Web, Spring Data JPA, Jakarta Validation dependency, Hibernate, and PostgreSQL driver.
- Environment-overridable local PostgreSQL properties.
- Maven Wrapper 3.3.4 using Maven 3.9.16.

Spring Boot 3.5.16 was selected from its official stable line and officially supports Java 17 through 25: <https://docs.spring.io/spring-boot/3.5/system-requirements.html>.

## 6. Explicitly Unsupported Scope

- Relationships and all JPA relation annotations.
- Abstract classes and inheritance.
- Enumerations.
- DTOs and mappers.
- Composite or inferred identifiers.
- Custom queries, security, database migrations, Docker, and a live PostgreSQL proof.

The generator rejects relationships and invalid inputs before rendering; it does not silently ignore them.

## 7. Type Mapping

| Canonical | Java |
|---|---|
| `String` | `String` |
| `Integer`, `int` | `Integer` |
| `Long`, `long` | `Long` |
| `Decimal`, `BigDecimal` | `BigDecimal` |
| `Double`, `double` | `Double` |
| `Float`, `float` | `Float` |
| `Boolean`, `boolean` | `Boolean` |
| `Date`, `LocalDate` | `LocalDate` |
| `DateTime`, `LocalDateTime` | `LocalDateTime` |
| `UUID` | `UUID` |

Unknown or missing types throw before template rendering.

## 8. Naming Rules

- `Cliente` → class `Cliente`, variable and endpoint `cliente`, table `cliente`.
- `DetallePedido` → table `detalle_pedido`.
- `fechaCreacion` → column `fecha_creacion`.
- REST paths use the deterministic singular convention `/api/<nombreVariable>`; linguistic pluralization is deferred.

## 9. Generated Layers

For every entity the generator creates:

- `modelo/<Entidad>.java`
- `repositorio/<Entidad>Repository.java`
- `servicio/<Entidad>Service.java`
- `servicio/impl/<Entidad>ServiceImpl.java`
- `controlador/<Entidad>Controller.java`

It also creates the main application, `pom.xml`, `application.properties`, and Maven Wrapper files.

## 10. Generated Fixture

Input:

```text
Cliente
- nombre: String
- email: String
- edad: Integer
```

Generated proof directory, intentionally ignored by Git:

```text
backend/generated-test-output/cliente-backend/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── .mvn/wrapper/maven-wrapper.properties
└── src/main/
    ├── resources/application.properties
    └── java/com/sw1/generated/
        ├── BackendGeneradoApplication.java
        ├── modelo/Cliente.java
        ├── repositorio/ClienteRepository.java
        ├── servicio/ClienteService.java
        ├── servicio/impl/ClienteServiceImpl.java
        └── controlador/ClienteController.java
```

The compiled `target/classes` directory contained all six expected Java `.class` files.

## 11. Tests

Thirteen generator tests verify:

- expected file set;
- entity, identity, and fixture fields;
- Repository, Service, ServiceImpl, and Controller CRUD content;
- required Maven dependencies and Java 21;
- `snake_case` naming;
- supported type aliases;
- rejection of unknown types;
- rejection of relationships before rendering.

## 12. Maven Compilation Result

PASS.

The generated fixture was compiled using Java `21.0.3` and its generated Maven Wrapper:

```text
.\mvnw.cmd test
[INFO] No tests to run.
[INFO] BUILD SUCCESS
[INFO] Total time: 44.448 s
```

The command compiled the generated main sources successfully. A live PostgreSQL server was not required or started.

## 13. Files Created / Modified

Created under `backend/`:

- npm manifest/lockfile, TypeScript and Vitest configuration.
- small build scripts to clean `dist` and copy EJS templates.
- canonical input boundary, Spring IR, mapper/readiness boundary, generator, fixture, and CLI.
- generator tests.
- EJS templates for POM, application, entity, repository, service, implementation, controller, properties, and wrapper scripts.

Modified project files:

- `.gitignore` for backend dependencies, build output, and generated test projects.
- `README.md` for Iterations 03/04 and executable commands.
- Iteration 03 frontend files listed in its separate report.

## 14. Commands Executed

| Command | Result |
|---|---|
| `java -version` | PASS: Java 21.0.3 |
| `mvn -version` | Not available globally; generated wrapper selected |
| `npm install` in `backend` | PASS: 55 packages, 0 vulnerabilities |
| initial `npm test` | FAIL: Vitest also discovered stale compiled tests whose templates had not been copied |
| `npm test` after build-boundary correction | PASS: 1 file, 13 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; clean TypeScript output plus copied templates |
| `npm run generate:fixture` | PASS: 11 files |
| first `.\mvnw.cmd test` | FAIL before Maven because a quoted Windows base path ended in `\` |
| `.\mvnw.cmd test` after wrapper correction | PASS: generated Java compiled; BUILD SUCCESS |
| final frontend `npm test` | PASS: 4 files, 39 tests |
| final frontend `npm run typecheck` | PASS |
| final frontend `npm run build` | PASS: 2,243 modules; known bundle warning only |
| final frontend `npm run test:e2e` | PASS: 1 real Chrome test |
| final backend `npm test` | PASS: 1 file, 13 tests |
| final backend `npm run typecheck` and `npm run build` | PASS |
| final fixture generation and `.\mvnw.cmd test` | PASS: 11 files; 6 Java sources compiled with `release 21` |

## 15. Risks / Technical Debt

- Frontend CU08 rules and the backend generation boundary intentionally duplicate a small safety subset. A later real network/shared-contract boundary should prevent rule drift without introducing a monorepo framework prematurely.
- Generated services use `IllegalArgumentException` for not-found behavior; a small API exception contract may be added later.
- The first wrapper/Maven run requires network access to download its pinned distribution and project dependencies.
- No generated application tests exist yet; current Maven proof compiles all main sources.

## 16. Deviations

None.

Maven was not installed globally, so the generated project includes a pinned Maven Wrapper, exactly as allowed by the iteration instructions.

## 17. Recommended Next Step

Add the first PostgreSQL runtime vertical slice and generated CRUD integration test for one entity. Relationship generation should remain deferred until multiplicity and ownership rules are specified and tested.

## 18. Final Status

PASS

CU09 exists in the required package hierarchy, consumes canonical semantics instead of Apollon, uses a small generation IR and deterministic templates, produces every required CRUD layer and project file, rejects unsupported input, passes generator tests, and the generated Spring Boot fixture compiles successfully with Java 21.
