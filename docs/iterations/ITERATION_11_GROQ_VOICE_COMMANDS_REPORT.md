# Iteration 11 — Voice Commands with Groq Whisper

## 1. Objective

Allow a Software Designer to record one bounded Spanish UML instruction, transcribe it on the CASE backend and automatically reuse the existing CU04 text-modeling pipeline so the same validated incremental change reaches Apollon and collaborators.

## 2. Business Package / Use Case

- Package: **Asistencia Inteligente**.
- Use case: **CU04 — Modelar mediante inteligencia artificial**, voice input channel.

Voice is an input adapter inside CU04, not a new use case or modeling engine.

## 3. Starting Baseline

- Branch: `main`.
- Starting commit: `01ebdf8c2d2c22ca459810b4797e2cafa31468b9`.
- Working tree: clean.
- `main...origin/main`: `0 0`, synchronized.
- Iteration 10: PASS.

## 4. Existing Acceptance Gates

- `EA-XMI-001`: **OPEN — EXTERNAL ACCEPTANCE PENDING**; unchanged and non-blocking.
- `GROQ-AI-001`: **CLOSED — REAL GROQ ACCEPTANCE PASS**; it was not reopened when the later shell lacked the key.
- `GROQ-VOICE-001`: **CLOSED — REAL GROQ VOICE ACCEPTANCE PASS**, closed by the real fixture proof recorded in section 29.

## 5. Business Problem

Text modeling already worked, but the professor also requires voice input. The business value is lower interaction effort while retaining exactly the same controlled UML interpretation and validation behavior.

## 6. Product Decision — Voice as Input Adapter

Voice performs only audio → text. The transcript is then passed to `procesarInstruccionIA`, the same coordinator used by typed instructions. No voice-specific UML commands, interpreter or executor exists.

## 7. Why Push-to-Talk

One explicit recording produces one instruction. This is demonstrable and avoids continuous listening, wake words, background capture, voice-activity detection and recording history.

## 8. End-to-End Architecture

```text
Microphone → MediaRecorder → multipart HTTP → CASE backend
→ ProveedorTranscripcionGroq → transcript
→ existing procesarInstruccionIA → ComandoModeloUML[]
→ deterministic validation/execution → ModeloUMLCanonico
→ Apollon → Yjs → collaborators
```

## 9. Responsibility Separation

- Frontend: permission, bounded recording, upload, status, transcript display and invocation of existing CU04.
- Backend: multipart validation, private credentials, provider call and normalized transcript.
- Transcription provider: audio → text only.
- Existing CU04: text → validated UML commands → automatic application.
- Database: none.

## 10. Groq SDK Verification

Inspected installed `groq-sdk@1.6.0` source/types. `client.audio.transcriptions.create()` posts multipart to `/openai/v1/audio/transcriptions`; `file` accepts an SDK `Uploadable`; `toFile(Buffer, name, { type })` supports in-memory bytes. The API accepts `whisper-large-v3-turbo`, language, prompt, JSON response format and returns `{ text: string }`. Documented formats include WebM, OGG, WAV, MP3/MPEG, MP4/M4A and FLAC.

## 11. Transcription Provider

`ProveedorTranscripcionAudio` is a narrow independent interface. Production uses `ProveedorTranscripcionGroq`; tests inject `ProveedorTranscripcionDeterministaE2E` or focused fakes. `ProveedorModeloLenguaje` remains unchanged.

## 12. Transcription Model

- Default: `whisper-large-v3-turbo`.
- Override: `GROQ_TRANSCRIPTION_MODEL`.
- Timeout: 25 seconds.
- SDK retries: zero.

## 13. Language / Domain Prompt

- Default language: `es`.
- Override: `GROQ_TRANSCRIPTION_LANGUAGE`.
- A short static Spanish UML vocabulary prompt is used. It contains no current UML model or application state.

## 14. Audio Format

Chromium supports and the SDK explicitly accepts WebM. The frontend prefers `audio/webm;codecs=opus`, then `audio/webm`, then OGG Opus. The backend normalizes MIME parameters and accepts a small whitelist: WebM, OGG, WAV, MPEG and MP4.

## 15. Recording Rules

- Explicit Hablar/Detener push-to-talk.
- One recording per instruction.
- Automatic stop at 30 seconds.
- No overlapping recording, transcription or modeling request from the panel.
- Tracks and timer are released after stop/error/unmount.

## 16. Audio Upload API

`POST /api/ia/voz/transcribir`, `multipart/form-data`, field `audio`. Success returns `{ transcripcion, modelo }`. Missing/empty audio and unsupported MIME return 400; files over 10 MB return 413.

## 17. Temporary Audio Handling

Multer memory storage passes a request-scoped Buffer to the provider. Groq SDK `toFile` creates the upload in memory. No recording or temporary audio file is retained.

## 18. Error Mapping

- Invalid/missing/unsupported audio: 400.
- Upload over 10 MB: 413.
- Provider quota: 429 with a controlled Spanish message.
- Provider unavailable/invalid response: 503.
- No provider stack, key or internal message is returned.

## 19. Frontend Voice UX

The existing assistant panel now shows Hablar, Detener, Escuchando and Transcribiendo states. Permission denial reports “No se pudo acceder al micrófono.” Unsupported browser media disables only voice; typed CU04 remains available.

## 20. Transcript Visibility

A successful result replaces the text input and remains visible as `Voz reconocida: “…”`, providing exam traceability.

## 21. Reuse of Existing CU04 Text Pipeline

`GrabadorInstruccionVoz` calls its `alReconocer` callback with plain text. `PanelAsistenteModelado` assigns that transcript to the textarea and calls its existing `enviar` function, which still invokes `procesarInstruccionIA` and `solicitarCambioIA`. Voice contains no `ComandoModeloUML`, plan validation or execution logic.

## 22. Automatic Apply

After transcription, the existing CU04 request is sent automatically. There is no voice confirmation, preview, apply or second Send click.

## 23. Interaction with Model Revision Protection

The current model/revision is read only when the transcript enters `procesarInstruccionIA`. Changes while speaking or transcribing are therefore included. Changes during interpretation use Iteration 10 stale-response detection and its single automatic replan.

## 24. Collaboration Propagation

Voice creates no WebSocket protocol. The canonical result is applied through the existing Apollon conversion; Apollon/Yjs propagates it normally. E2E confirms Bruno receives the class created by Ana's voice action.

## 25. Backend Tests

Nine new API/provider-boundary tests cover valid/trimmed and empty transcript, missing file, MIME rejection, 10 MB limit, 429, unavailable provider, byte/MIME metadata and secret-safe responses. Full backend result: **86/86 PASS**.

## 26. Frontend Tests

Tests cover permission request, recording state, one Blob upload, manual/automatic stop, 30-second bound, visible transcript, automatic CU04 reuse, no confirmation, no-speech safety, permission denial, unsupported MediaRecorder, preserved typed text and mutual exclusion. Full frontend result: **96/96 PASS**.

## 27. Voice E2E

**PASS.** Chromium's fake media-device flags exercise real `getUserMedia`/`MediaRecorder`, multipart upload, deterministic backend transcription, visible transcript, automatic existing CU04 processing, real Apollon class creation and canonical inspector update.

## 28. Voice → Collaboration E2E

**PASS.** Ana records; deterministic transcription returns “Crea una clase Factura”; existing CU04 applies it; Bruno receives Factura through Apollon/Yjs without transcribing or receiving a voice-specific message.

## 29. Real Groq Voice Proof

**PASS.** The user executed `npm run proof:voz:groq` with a real Groq credential and a real Spanish audio fixture. The non-secret result confirmed `realGroqVoiceUsed = true`, model `whisper-large-v3-turbo`, `transcriptionReceived = true` and `semanticCondition = true`. No API key, secret value or local fixture path is recorded.

This real audio → Groq Whisper proof is distinct from browser E2E: Playwright uses deterministic providers to prove MediaRecorder → backend → existing CU04 → Apollon/Yjs and does not claim live Groq.

## 30. Manual Microphone Checklist

1. Open CASE in a browser and allow microphone access.
2. Press Hablar.
3. Say “Crea una clase Factura”.
4. Press Detener.
5. Verify the visible transcript.
6. Verify Factura appears automatically.

This is a demo-readiness check, not a separate acceptance gate.

## 31. Regression Results

- Backend tests/typecheck/build: PASS.
- Frontend tests/typecheck/build: PASS; existing large-bundle warning remains non-blocking.
- Playwright: PASS, 8/8.
- `proof:http`, `proof:relation`, `proof:xmi`: PASS.
- `proof:ia:groq`: not re-executable because the key is absent from this shell; prior acceptance remains CLOSED.
- PostgreSQL was not rerun because generation and persistence behavior were not changed.

## 32. Package → Use Case Structure

```text
backend/src/paquetes/asistencia_ia/
├── compartido/proveedores/transcripcion/
│   ├── ProveedorTranscripcionAudio.ts
│   └── groq/ProveedorTranscripcionGroq.ts
├── casos_uso/cu04_modelar_con_ia/voz/
│   ├── transcribirInstruccionVoz.ts
│   ├── registrarRutaTranscripcionVoz.ts
│   └── registrarRutaTranscripcionVoz.test.ts
└── pruebas/
    ├── ProveedorTranscripcionDeterministaE2E.ts
    └── probarVozGroqReal.ts

frontend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/
├── PanelAsistenteModelado.tsx
└── voz/
    ├── GrabadorInstruccionVoz.tsx
    ├── GrabadorInstruccionVoz.test.tsx
    └── transcribirAudio.ts
```

## 33. Files Created / Modified

Created: transcription contract/Groq provider, CU04 voice use-case function/route/tests, deterministic E2E provider, real proof script, frontend recorder/API/tests, voice E2E and this report.

Modified: backend manifests/lockfile and CASE composition/startup; existing assistant panel/tests; Playwright launch flags; frontend styles; README; pending acceptance register.

## 34. Commands Actually Executed

- Baseline `git` status/branch/HEAD/origin commands: PASS; clean synchronized start.
- Installed `multer@2.0.2` and `@types/multer@2.0.0`: PASS; npm reported two existing high-severity audit findings, not auto-fixed.
- Focused backend typecheck and nine voice API tests: PASS.
- Focused frontend typecheck and voice/panel tests: PASS.
- Focused voice Playwright: PASS, 2/2.
- Backend `npm test`, `npm run typecheck`, `npm run build`: PASS.
- Frontend `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`: PASS.
- `npm run proof:http`, `npm run proof:relation`, `npm run proof:xmi`: PASS.
- `npm run proof:ia:groq`: prerequisite unavailable in this later shell; accepted gate unchanged.
- Initial `npm run proof:voz:groq` attempt: BLOCKED by absent prerequisites in the implementation shell; subsequent user-executed real acceptance: PASS.

## 35. Verification Matrix

| Check | Result |
|---|---|
| Iterations 01–10 regressions | PASS |
| EA-XMI-001 unchanged | PASS |
| GROQ-AI-001 remains closed | PASS |
| Voice uses same CU04 | PASS |
| No duplicate UML interpreter | PASS |
| Groq transcription server-side | PASS |
| GROQ_API_KEY absent from frontend | PASS |
| Push-to-talk | PASS |
| Recording max 30 seconds | PASS |
| Permission denied handling | PASS |
| Unsupported MediaRecorder handling | PASS |
| Audio size limit | PASS |
| MIME validation | PASS |
| No permanent audio storage | PASS |
| Transcript visible | PASS |
| Transcript auto-submitted to CU04 | PASS |
| No confirmation UI | PASS |
| No-speech causes zero mutation | PASS |
| Existing revision protection reused | PASS |
| Voice change reaches Apollon | PASS |
| Voice change reaches collaborator | PASS |
| Backend tests | PASS — 86 tests |
| Frontend tests | PASS — 96 tests |
| Typechecks | PASS |
| Builds | PASS |
| Browser E2E | PASS — 8 tests |
| Real Groq voice proof | PASS |

## 36. Deferred Features

Streaming speech, continuous/background listening, wake words, VAD, audio history, language-selection UI, offline/browser Whisper, speech synthesis, image recognition and conversational agents.

## 37. Risks / Technical Debt

- Physical microphone behavior remains a manual exam-readiness check; automated Chromium coverage uses its supported fake audio device.
- Multer introduced no broad upload subsystem, but npm currently reports two high-severity dependency audit findings requiring separate evidence-based review.

## 38. Recommended Next Iteration

With `GROQ-VOICE-001` closed, the recommended next iteration is **CU05 — image/photo → candidate UML model**. Do not duplicate CU04 or implement it within Iteration 11.

## 39. Final Status

**PASS**

All local product behavior and regressions pass. The separate real audio fixture → Groq Whisper proof also passed its semantic acceptance condition.
