# CURRENT_SLICE | NexoCASE F8-S1 (replace the active slice content when ready)

**Baseline:** `main@103ea46` published; previous regression 466 backend + 234 frontend + 50 E2E. **Do not assume these counts apply after any new changes.**

**Objective:** obtain **real runtime evidence** that a representative *already-supported* NexoCASE-generated Spring Boot CRUD backend compiles, starts against an isolated PostgreSQL database and handles at least create/read/update/delete, without modifying the user's main data or expanding UML support prematurely.

**Read, only if needed:** `AGENTS.md` → this file → `.codex-local/F8_PO_CONTRACT.md` sections 1, 3–4 and 6. Then inspect only: `backend/src/paquetes/generacion_backend/pruebas_runtime/probarFlujoPostgreSQL.ts`, Spring generator/templates, existing generator tests and the relevant `package.json` command. Do not scan all CU folders.

**Steps:**
1. Check current fixture/runtime script and actual prerequisites. Confirm whether it can already demonstrate compilation + Spring startup + PostgreSQL CRUD without destructive operations or production secrets.
2. If already adequate, **do not change code**; report exact safe run command, required environment, isolation, expected assertions and evidence to capture.
3. If there is a **proven** missing assertion or reproducible bug, fix only that narrow test/runtime harness or generator defect; add focused regression. Do not add new UML constructs yet.
4. Record a short compatibility finding: supported example, limitations, observed test evidence. Propose the next smallest F8-S2 case; do not execute it automatically.

**Safety:** no real Groq, full suites, broad audits, Git mutations, Docker/data deletion, production DB writes or large documentation rewrites. If Postgres/Java/Maven execution would affect user infrastructure, provide a safe isolated command instead; don't guess credentials.

**Report in Spanish (<=8 lines):** evidence/gap; changes (if any); focused checks; exact next user action. Stop after S1.
