# CURRENT_SLICE | F8-UX05 QA

Status: **QA PASS WITH LIMITATIONS / UX04 PO VISUAL ACCEPTANCE STILL PENDING** (2026-11-10). UX05 approved for QA only; no new redesign/slice authorized.

## Reproducible finding and fix
- **P1 FIXED:** persistent Save feedback was absolutely positioned below the header and intercepted panel-control clicks at 390px. Reproduced by native Playwright click; observed in uiux-evidence/ux05/failure.png (before fix).
- Only production change this slice: styles.css .topbar-message now occupies its own header grid row, wraps long text and stays above workspace controls. No business/domain/backend change; previous F8 work preserved.
- Focused regression added: frontend/tests/e2e/ux05-paneles.spec.ts, three cases (390/768/960), real Save feedback geometry, native clicks and keyboard panel toggling. No forced clicks.

## Executed and observed evidence
- Chrome 157.0.8103.50 + Playwright: **18/18 browser checks passed**, zero uncaught page errors. Local script ux05-qa.cjs; sanitized results: uiux-evidence/ux05/results.json. These are focused QA checks, not a full E2E suite.
- **3/3 Playwright regression tests passed** with ux05.playwright.config.cjs. Separate local output directory; no resetting/deleting previous E2E data or evidence.
- Real layout checks: desktop 960/1200, all four independent panel combinations, usable center/non-overlap and focus restore. Mobile 390/768: stacked regions, composer/Send reachable by scrolling, no horizontal document overflow, collapsed-state restore.
- Observed screenshots: desktop-960-both.png, desktop-1200-both.png, view-image/validation/xmi/generate.png, english-dark-1200.png, mobile-390-chat.png and mobile-768-chat.png under uiux-evidence/ux05/. Source observed in Chrome, not inferred from JSDOM.
- Real Apollon creation/selection, zoom preservation on navigation, node drag + Undo/Redo verified. Five central views and independent shared assistant preserved.
- Multiline/Shift+Enter, conceptual reply, controlled 503 draft/history preservation; browser getUserMedia/MediaRecorder with FAKE audio device, cancellation and deterministic transcription to editable draft, no automatic execution. Image preview/removal, deterministic CU05 candidate and explicit apply, draft retained; no CU12 image-context claim.
- Existing local XMI export/download and confirmed reimport passed for normal classes/association; Spring ZIP download passed WITHOUT compilation/PostgreSQL. Not proof of external EA fidelity or every XMI construct.
- Two authenticated browser contexts: shared attributed conversation, real Yjs class/attribute propagation, own pending proposal CTA hidden from the other requester, validated CU04 attribute execution, explicit Save and reopening saved project after reload passed.
- Local services: frontend 4185/backend 3105 with explicit deterministic providers, file-backed test projects and in-memory participants/messages. Existing backend on 3001 untouched; no Mongo/PostgreSQL operations or Groq calls. Cross-origin setup corrected through process environment only; no .env edit.
- **Frontend build exit 0**, includes TypeScript tsc -b and Vite; one build. Existing >500 kB chunk warning remains. No broad suites or repeated UX04 unit suite. Targeted diff and git diff --check clean (existing CRLF notices only).

## Remaining PO checks / limits
- UX04 visual acceptance remains the PO's decision: inspect the current desktop/mobile screenshots, density, both panels/focus, long labels/messages and light/dark contrast. Automation confirms interaction/geometry, not design acceptance or comprehensive accessibility.
- Non-blocking existing P2: topbar Volver remains Spanish in EN; pale participant-label contrast and narrow native file control deserve PO review. Not changed under P0/P1-only QA scope. Durable user/provider messages retain their original language; browser-native file labels follow browser locale.
- Physical microphone/audio quality, actual provider reliability, permission/device matrix and production Mongo durability remain unverified. This run used fake audio + deterministic AI; no claim of real speech/vision/Groq validation.
- CU12 visual context and durable/shared attachments remain unsupported; CU05 preview/candidate is local until explicit application. No UML/JPA capability expansion.
- Historical UX04: 112 focused unit tests/7 files + TypeScript/build; UX03: 73 frontend + 5 capability tests; UX02/UX01 and F8-S1..S4 evidence preserved. No Git mutations; no cleanup of unrelated/untracked work.
