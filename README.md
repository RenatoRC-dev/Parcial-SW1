# SW1 — Collaborative CASE Tool

This repository contains the SW1 collaborative CASE tool. The React + TypeScript frontend embeds Apollon, projects its state into an application-owned canonical UML model, validates it, and lets the user request and download a generated Spring Boot backend through the CASE backend API.

## Iteration status

Current completed iterations:

- Iteration 01: Apollon foundation (`Modelado UML` / CU02).
- Iteration 02: canonical UML model and Apollon adapter (`Modelado UML` / CU02).
- Iteration 03: canonical validation and generation readiness (`Validación` / CU08).
- Iteration 04: first deterministic Spring Boot generation slice (`Generación de Backend` / CU09).
- Iteration 05: end-to-end Spring generation and ZIP delivery (`Generación de Backend` / CU09 and CU10).
- Iteration 06: deterministic one-to-many JPA association generation (`Generación de Backend` / CU09).
- Iteration 07: PostgreSQL runtime CRUD and canonical ID integrity (`Generación de Backend` / CU09).

Iteration 08 has a verified internal XMI import/export round-trip and browser flow. Its final status is **PARTIAL** until both directions are executed with a real Sparx Enterprise Architect installation.

Important boundaries:

- Canonical contract: `frontend/src/nucleo/modelo_uml/`
- Apollon mapping boundary: `frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/`
- Validator: `frontend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/`
- Generator: `backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/`
- ZIP delivery: `backend/src/paquetes/generacion_backend/casos_uso/cu10_obtener_backend_generado/`
- Verified status: `PASS`

Application functionality follows the mandatory hierarchy `paquetes/<paquete>/casos_uso/<caso_de_uso>/`. The canonical UML contract is the explicit exception: it lives in `nucleo/modelo_uml` because it is designed for future cross-package consumption and has no dependency on Apollon.

Current generation profile:

- Supported: independent entities, scalar fields, and UML association `1 ↔ 0..*`.
- Deferred: one-to-one, many-to-many, aggregation, composition, and inheritance.

The concise frontend/backend capability contract is documented in [`docs/generation/SPRING_GENERATION_PROFILE.md`](docs/generation/SPRING_GENERATION_PROFILE.md).

Current interoperability profile:

- XMI 2.1 import/export through the isolated local `crunch_uml` bridge.
- Supported: independent classes, scalar attributes, stable element IDs, positions when available, and association `1 ↔ 0..*` in both orientations with endpoint roles.
- Explicitly deferred: attribute visibility, abstract classes, enumerations, generalization, aggregation, composition, 1:1, N:M, methods, and nested-package semantics.
- Real Enterprise Architect acceptance: pending because EA is not available in the current environment.

## Open acceptance gates

- [`EA-XMI-001`](docs/quality/PENDING_ACCEPTANCE_GATES.md) — Real Enterprise Architect bidirectional XMI acceptance. Status: **OPEN**.

Iteration 08 remains **PARTIAL — REAL ENTERPRISE ARCHITECT ROUND-TRIP PENDING**.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Python 3.10–3.13 for the local XMI bridge
- Google Chrome for `npm run test:e2e`
- Java 21 for compiling a generated Spring project

## Run the application

Terminal 1 — CASE backend:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\backend
npm install
npm run dev
```

Terminal 2 — frontend:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\frontend
npm install
npm run dev
```

The frontend development server prints its local URL (normally `http://localhost:5173`) and proxies `/api` to the CASE backend at `http://127.0.0.1:3001`.

## Verification commands

From `D:\2-2026\SW1\Proyecto-Parcial\frontend`:

```sh
npm test
npm run test:e2e
npm run typecheck
npm run build
```

From `D:\2-2026\SW1\Proyecto-Parcial\backend`:

```sh
npm test
npm run typecheck
npm run build
```

Generate and compile the deterministic fixture:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\backend
npm run generate:fixture
cd .\generated-test-output\cliente-backend
.\mvnw.cmd clean test
```

Prove the real HTTP → ZIP → extracted Spring project flow:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\backend
npm run proof:http
cd .\generated-test-output\api-proof\extraido\backend-generado
.\mvnw.cmd clean test
```

Prove one-to-many relationship generation through the real HTTP flow:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\backend
npm run proof:relation
cd .\generated-test-output\relationship-proof\extraido\backend-generado
.\mvnw.cmd clean test
```

Iteration 07 successfully completed the real acceptance proof against PostgreSQL 16.6 using the dedicated `sw1_iteracion07` database. To rerun it, configure the required local PostgreSQL credentials in the process environment and execute:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\backend
npm run proof:postgres
```

The command defaults to the dedicated database `sw1_iteracion07`; it never stores credentials in source or generated evidence. Host, port, admin database, and test database can be overridden through the documented process environment configuration.

The generated Maven Wrapper downloads its pinned Maven distribution, so a global Maven installation is not required.

For XMI interoperability, create the ignored backend-local Python environment once and install the local `crunch_uml` requirements:

```powershell
cd D:\2-2026\SW1\Proyecto-Parcial\backend
python -m venv .venv-crunch
.\.venv-crunch\Scripts\python.exe -m pip install -r ..\..\crunch_uml\requirements.txt
npm run proof:xmi
```

The bridge discovers `crunch_uml` as a sibling repository by default. Set `SW1_CRUNCH_UML_PATH` only when the reference repository is elsewhere; do not copy it into this project.

## Project context

The authoritative requirements, architecture decisions, roadmap, and traceability records are in [`SW1_project_records/`](SW1_project_records/).

Iteration evidence is recorded in [`docs/iterations/`](docs/iterations/), including the Iteration 06 one-to-many JPA generation report.
