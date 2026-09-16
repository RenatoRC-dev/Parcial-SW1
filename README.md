# SW1 — Collaborative CASE Tool

This repository contains the SW1 collaborative CASE tool. The React + TypeScript frontend embeds Apollon, projects its state into an application-owned canonical UML model, and validates generation readiness. A separate TypeScript generator produces the first deterministic Spring Boot CRUD slice from canonical semantics.

## Iteration status

Current completed iterations:

- Iteration 01: Apollon foundation (`Modelado UML` / CU02).
- Iteration 02: canonical UML model and Apollon adapter (`Modelado UML` / CU02).
- Iteration 03: canonical validation and generation readiness (`Validación` / CU08).
- Iteration 04: first deterministic Spring Boot generation slice (`Generación de Backend` / CU09).

Important boundaries:

- Canonical contract: `frontend/src/nucleo/modelo_uml/`
- Apollon mapping boundary: `frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/`
- Validator: `frontend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/`
- Generator: `backend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/`
- Verified status: `PASS`

Application functionality follows the mandatory hierarchy `paquetes/<paquete>/casos_uso/<caso_de_uso>/`. The canonical UML contract is the explicit exception: it lives in `nucleo/modelo_uml` because it is designed for future cross-package consumption and has no dependency on Apollon.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Google Chrome for `npm run test:e2e`
- Java 21 for compiling a generated Spring project

## Commands

Run these commands from `frontend/`:

```sh
npm install
npm run dev
npm test
npm run test:e2e
npm run typecheck
npm run build
```

The development server prints its local URL in the terminal (normally `http://localhost:5173`).

Run these commands from `backend/`:

```sh
npm install
npm test
npm run typecheck
npm run build
npm run generate:fixture
```

The fixture is written to the ignored `backend/generated-test-output/cliente-backend/` directory. Compile it on Windows with:

```powershell
.\mvnw.cmd test
```

The generated Maven Wrapper downloads its pinned Maven distribution, so a global Maven installation is not required.

## Project context

The authoritative requirements, architecture decisions, roadmap, and traceability records are in [`SW1_project_records/`](SW1_project_records/).

Iteration evidence is recorded in [`docs/iterations/`](docs/iterations/), including the current Iteration 03 validation and Iteration 04 Spring generation reports.
