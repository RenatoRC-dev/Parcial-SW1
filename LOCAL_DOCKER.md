# CASE local development

## Start

Prerequisites: Docker Desktop (or a Docker Engine with Compose) and a working Docker daemon.

```sh
docker compose up --build
```

Open <http://localhost:5173>. The frontend proxies `/api` requests and WebSocket connections to the backend. The backend is available at <http://localhost:3001> for direct checks.

Stop the development environment with `Ctrl+C`, or run:

```sh
docker compose down
```

The development containers run Node 22, Vite, and the backend watch process. Source directories are bind-mounted, so edits are reflected without rebuilding.

## Troubleshooting

- Check service state with `docker compose ps` and logs with `docker compose logs -f backend frontend mongodb`.
- If startup is waiting, confirm that MongoDB is healthy: `docker compose ps mongodb`.
- If ports `5173` or `3001` are busy, stop the conflicting process before starting Compose.
- Rebuild after dependency or Dockerfile changes: `docker compose up --build`.
- WebSocket requests use the same frontend origin and Vite proxy; keep the frontend running on port `5173`.

## Persistence and reset

MongoDB data is stored in the named `mongodb-data` volume and survives `docker compose down` and container recreation. To intentionally reset local data, run:

```sh
docker compose down -v
```

This removes the local MongoDB volume and all locally stored projects. Do not use it when data must be preserved.

## Optional Groq features

Basic local startup does not require credentials. To enable Groq-backed assistance, export a key before starting Compose (or place it in the shell environment):

```sh
GROQ_API_KEY=your-key docker compose up --build
```

On PowerShell:

```powershell
$env:GROQ_API_KEY = "your-key"
docker compose up --build
```

Never commit API keys or put them in tracked files. Groq model variables such as `GROQ_MODEL`, `GROQ_TRANSCRIPTION_MODEL`, and `GROQ_VISION_MODEL` can be supplied the same way when needed.

## XMI: real Crunch/Python runtime

The existing XMI engine is pinned by `backend/requirements-xmi.txt` (`crunch-uml==0.6.0`). The Node image has Python3 but does not include Crunch or pip. Installing on the Windows bind mount is slow; use an isolated venv on the container's Linux filesystem:

```sh
docker compose exec --user node backend node scripts/prepararRuntimeXmi.mjs --venv /home/node/.cache/nexocase-xmi --configure
docker compose exec backend npx --no-install tsx src/paquetes/asistencia_contextual/pruebas/probarRoundtripChatXmi.ts
```

The setup uses only project requirements, binary wheels and a hash-verified pip bootstrap inside the venv. It does not install global packages or use apt. It creates the already-ignored `backend/.python-xmi/runtime.json` without overwriting another configuration. An interrupted install can be retried explicitly with `--repair`; an incompatible existing venv is preserved.

Interpreter precedence: `SW1_PYTHON_PATH` > local runtime.json > platform-specific `.venv-crunch` > `python3` on Linux / `python` on Windows. Crunch precedence: explicit `SW1_CRUNCH_UML_PATH` > existing legacy source directory > package installed for that same interpreter. Invalid explicit settings fail rather than silently selecting another runtime. No `.env` edit is required.

**After recreating the backend container, rerun setup.** Its writable Linux cache is not part of the image; restarting the same container preserves it. This development restoration does not change the supported UML/XMI profile or establish Enterprise Architect compatibility.

Frontend development mounts backend source read-only at `/backend/src` because existing pure validators are shared. If Docker Desktop missed source-change events, restart the dev services to avoid testing stale transforms. The normal Compose recreation applies the added read-only mount without deleting data.

### Focused browser + two-participant acceptance

`frontend/tests/e2e/probarXmiChatReal.mjs` connects to an existing isolated Windows Chrome CDP instance on loopback. Pass its WebSocket URL as `CHROME_CDP_URL` (host `host.docker.internal`) and the actual Windows repo path as `F8_HOST_WORKSPACE` to `docker compose exec frontend node tests/e2e/probarXmiChatReal.mjs`.

The script creates one uniquely named acceptance project, uses two separate authenticated browser contexts, explicitly seeds only that new project, downloads an actual XMI into a fresh `frontend/test-results/xmi-s21-*` directory, reimports those bytes, checks warnings and reject/confirm behavior, then checks Yjs convergence without reload and that no implicit Save occurred. Credentials are not written to reports. Download evidence and acceptance projects are deliberately retained, not recursively cleaned. This avoids the general Playwright configuration's fixture preparation and prior-evidence cleanup.
