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

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
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

The generated Maven Wrapper downloads its pinned Maven distribution, so a global Maven installation is not required.

## Project context

The authoritative requirements, architecture decisions, roadmap, and traceability records are in [`SW1_project_records/`](SW1_project_records/).

Iteration evidence is recorded in [`docs/iterations/`](docs/iterations/), including the Iteration 06 one-to-many JPA generation report.
