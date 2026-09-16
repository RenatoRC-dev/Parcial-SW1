# SW1 — Collaborative CASE Tool

This repository contains the SW1 collaborative CASE tool. Its current React + TypeScript frontend embeds Apollon for manual class-diagram editing and projects the structured editor state into a small application-owned canonical UML model.

## Iteration status

Iteration 02 — Canonical UML Model + Apollon Adapter implements:

- Business package: `Modelado UML`
- Use case: `CU02 — Modelar diagrama de clases manualmente`
- Canonical contract: `frontend/src/nucleo/modelo_uml/`
- Apollon mapping boundary: `frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/`
- Verified status: `PASS`

Application functionality follows the mandatory hierarchy `paquetes/<paquete>/casos_uso/<caso_de_uso>/`. The canonical UML contract is the explicit exception: it lives in `nucleo/modelo_uml` because it is designed for future cross-package consumption and has no dependency on Apollon.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Google Chrome for `npm run test:e2e`

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

## Project context

The authoritative requirements, architecture decisions, roadmap, and traceability records are in [`SW1_project_records/`](SW1_project_records/).

Iteration evidence is recorded in [`docs/iterations/`](docs/iterations/). The current report is [`ITERATION_02_CANONICAL_MODEL_APOLLON_ADAPTER_REPORT.md`](docs/iterations/ITERATION_02_CANONICAL_MODEL_APOLLON_ADAPTER_REPORT.md).
