# NexoCASE — Existing architecture (read only for boundary changes)

## Stack
- Frontend: React + TypeScript + Vite; visual editor `@tumaet/apollon`; canonical UML from `frontend/src/nucleo/modelo_uml/` and editor adapter.
- Backend: Node.js/TypeScript/Express, functional code under `backend/src/paquetes/`.
- MongoDB driver, four durable collections `projects`, `participants`, `messages`, `events` (no Mongoose/new collections needed).
- Yjs + authorized WebSocket `/api/colaboracion` for live UML; app WebSocket `/api/colaboracion-aplicacion` for `message_created` notifications, **not executable commands**.
- Groq key in backend `GROQ_API_KEY`; `GROQ_CU04_MODEL` / `GROQ_CU12_MODEL` override `GROQ_MODEL`, falling back to `openai/gpt-oss-20b`. See GROQ_STRATEGY.md.

## HTTP contract (verify real route code before editing)
- `POST /api/proyectos/:id/asistente-colaborativo/interactuar`: authorized participant question; returns `advisory`, `clarification`, or `action`.
- `POST /api/proyectos/:id/modelado-ia/interpretar`: CU04 direct authorized structured plan.
- `POST /api/proyectos/:id/modelado-ia/acciones/:actionId/completar`: requester-bound idempotent completion after frontend actually applies commands.
- `GET /api/proyectos/:id/mensajes`: durable shared history.
- Old `/api/ia/modelado/interpretar`, `/api/ia/contextual/preguntar` deliberately retired; do not revive.
- Code + participant credential is per project. HTTP Bearer; WS first frame. Never put credentials in URLs or Groq prompts.

## Happy path / non-negotiable invariants
1. Human request persisted (requestId idempotent) → backend classifies and resolves from participant chain/context.
2. Advisory → CU12 persists/publishes reply. Ambiguity → safe question, no side effects.
3. Clear authorized change → CU04 interpreter validates structured commands. Only requesting client gets plan over HTTP.
4. Requesting client checks its **live editor revision** (not durable Mongo model revision), applies to canonical model and Apollon/Yjs; other clients observe Yjs changes but never execute same plan.
5. Client confirms `actionId`; backend records AI message/event with mechanism `ai_cu04`, human requester, optional `sourceMessageId` (null for direct CU04).
6. Only CU11 explicit save advances durable `revisionModelo` (Mongo CAS; 409 preserves local work). No autosave.

## Known code areas (locations may have evolved)
- `backend/src/paquetes/asistencia_contextual/casos_uso/cu12_asistir_usuario/{OrquestarInteraccionIA,AsistirColaborativamente,ConstruirContextoAsistenteColaborativo}.ts`
- `backend/src/paquetes/asistencia_contextual/compartido/proveedores/groq/ProveedorAsistenteContextualGroq.ts`
- `backend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/`
- `backend/src/paquetes/mensajeria_colaborativa/infraestructura/RepositorioMensajesMongo.ts`
- `frontend/src/paquetes/asistencia_contextual/casos_uso/cu12_asistir_usuario/{PanelAsistenteContextual,consultarAsistenteContextual}.tsx/ts`
- `frontend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/`
- `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases.tsx`
- `frontend/src/styles.css`

## Deployment/development
- Local: Docker `mongo:8.0` only; React/Vite `npm run dev` at typical `http://localhost:5173` proxy to Node backend `http://127.0.0.1:3001`.
- Backend requires `MONGODB_URI`, `MONGODB_DB_NAME`, `PROJECT_ACCESS_PEPPER` and `GROQ_API_KEY` for real IA; loaded via process vars or `backend/.env` (never commit `.env`).
- Tests use injected deterministic providers, real Mongo test container on separate port. Do not start/stop Docker during ordinary coding without explicit request.

## Context/provider boundaries
- `RepositorioMensajes.buscarRecomendaciones` reads up to 32 proposals from existing messages, joined to the authenticated participant's human request in the same project. Mongo uses a self-lookup; no extra collection or full-history replay.
- Orchestrator resolves topic and immediate participant-thread correlation from those proposals and up to 16 recent messages. CU04 receives the selected explicit instruction and live canonical model, not the chat history.
- CU12 scopes concrete queries to named/selected classes and connected relations; general reviews keep the bounded model. Canonical live input takes priority over a stale consultative view for context.
- Strict JSON shape does not replace semantic validation. Shared in-process cooldown is per model; no automatic provider retries. Known operational errors retain typed responses; unexpected exceptions remain sanitized HTTP 500, not provider outages.
