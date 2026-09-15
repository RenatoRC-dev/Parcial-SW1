# SW1 — Collaborative CASE Tool

This repository contains the SW1 collaborative CASE tool. Its current implementation is the Iteration 01 React + TypeScript foundation: a host for the Apollon UML class-diagram editor and a development inspector that exposes the structured model received by our application.

## Iteration status

Iteration 01 — Project Foundation + Apollon Integration implements:

- Business package: `Modelado UML`
- Use case: `CU02 — Modelar diagrama de clases manualmente`
- Verified status: `PASS`

Application source follows the mandatory hierarchy `paquetes/<paquete>/casos_uso/<caso_de_uso>/`. A file remains inside its use case unless it has a proven second consumer.

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

Iteration evidence is recorded in [`docs/iterations/ITERATION_01_APOLLON_FOUNDATION_REPORT.md`](docs/iterations/ITERATION_01_APOLLON_FOUNDATION_REPORT.md).
