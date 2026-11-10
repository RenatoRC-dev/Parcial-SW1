# NexoCASE | F8 UI/UX product contract (approved direction)

**Status:** UI direction approved for phased implementation, **not** approval of new UML/JPA/LLM capabilities. **Language:** implementation prompts in English; product UI ES/EN using existing i18n; Codex reports in Spanish. **Source precedence:** user decisions > existing behavior/business rules > this contract > illustrative screenshots. Read only relevant sections per slice.

## 1. Outcome and boundaries

Problem: a crowded UML workspace has redundant CU04 and CU12 entry points, narrow modeling canvas, and technical statuses mixed with routine editing. Goal: a clean collaborative modeling IDE with one visible **Asistente de modelado**, flexible canvas, contextual inspector, and usable feature views. Keep **all 12 use cases working**; unifying the UI **does not merge or remove** the independent CU04 and CU12 backend/domain responsibilities.

**Non-negotiable user decisions**:
- **REMOVE** the three persistent top chips/tabs `Sugerir | Aplicar | Explicar` in the assistant. The user writes naturally; show a contextual action button **only on an actual eligible recommendation**, never a fake persistent mode selector.
- **REMOVE** the separate `Asistente IA` item from the main navigation after the unified assistant reaches feature parity. The assistant lives inside the model workspace and may be reopened through a small assistant toggle; do not leave duplicate prominent assistant surfaces.
- Navigation retains **Modelo, Desde imagen, Validación, XMI, Generar** (CU05 stays accessible as a dedicated experience until equivalent integrated capabilities are proven). Five distinct views, not six duplicate backends.
- **Both assistant and UML properties drawers must collapse independently**, restoring useful modeling width; an obvious reversible control, keyboard accessibility and no loss of draft/conversation/model state. Provide **focus mode** (both closed) and responsive defaults.
- Chat composer: multiline text + **microphone** + **image attachment** + Send. UX02 delivered text; **approved UX03 integrates existing transcription and CU05 analysis**, with no fake controls. Voice stays editable until Send. An attached UML image is processed separately through CU05; accompanying text stays in the draft. No fictional native multimodal understanding. The user must know how attached content is being processed.
- Keep UI minimalist, spacious, orderly. No enormous dashboard on top of the diagram, no repeating summary cards, no decorative toolbar functionality.

## 2. Screen architecture / single navigation

1. **Modelo** (main): header (project, real participants/connection, save, language/theme), compact 5-item nav (collapsible icon rail), assistant drawer, dominant real Apollon UML canvas, contextual properties drawer, compact zoom/toolbars and optional mini-map. **PO correction after rejected UX01 screenshots:** assistant and properties have independent open states at every width; never close one automatically when opening the other or resizing. At 960px desktop, allow both in compact non-overlapping columns with a usable center canvas and independent scrolling. On mobile, adapt layout without forced exclusivity. Focus mode temporarily hides both and restores their exact previous states.
2. **Desde imagen**: existing CU05 upload -> preview -> analysis -> candidate review -> user confirms -> apply through existing safe model pipeline. Don't turn it into a one-click destructive import. Explain accepted formats/size from *actual implementation*; don't invent limits from mockups. The assistant composer may accept images only when a compatible, secure processing contract is truly wired; until then delegate to CU05 while preserving any text context where supported.
3. **Validación**: clearly separates **valid UML** (CU08) from **Spring-generation eligibility** (CU09). Present concise overview with expandable actionable diagnostics and element references. These are distinct judgments, never a single fabricated boolean.
4. **XMI**: import/export, explicit scope/compatibility warnings, confirmation before replacing/merging a model. Preserve supported markers, association names, multiplicities, IDs/semantic equivalence in covered profile; external-tool fidelity unverified. Do not promise complete UML 2.5 XMI interchange.
5. **Generar**: eligibility status and concrete blockers; produce/download via existing CU09/CU10 only when eligible. No unsupported relation/type mapping, silent data loss or invented business logic. No new generator capability from design alone.

**Main screen structure**:
- Header occupies one restrained row. Collaboration count = real connected presence; save status = actual CU11 explicit save/revision state, **never imply autosave** based on visual reference.
- Left collapsible drawer `Asistente de modelado`: shared chronological CU12 conversation, sender identity, readable wrapping/bubbles, relevant continuity and pending/error/clarification states. UX03 widens the panel with an accessible width control bounded by workspace space, independently scrollable history and an anchored multiline composer with real attachment/recording controls. Mobile stacks regions; preserve all four independent panel states and focus restoration. Under the explicit UX02 approval, show `Aplicar cambio` only for an eligible pending structured recommendation owned by the requester and correlated to their latest turn, with existing targets. Clicking requests existing backend contextual resolution and CU04 validation; it does not imply a validated plan or completed execution. Answer-only queries have no apply button.
- Center = **real interactive** UML canvas with existing toolset; preserve pan, zoom, select, drag, connectors, keyboard shortcuts and Yjs. No screenshot replacement or redundant hand-built editor.
- Right collapsible drawer `Propiedades UML`: selected node/relation first; editing attributes and relations; concise validation and Spring-eligibility links/sections lower down. Technical JSON/diagnostics behind disclosure, not always expanded.

## 3. Business, safety, and synchronization rules

**Business ownership**: CU12 = collaborative contextual advice/conversation/recipient identity; CU04 = interpreting/validating/executing UML change plans; CU05 = vision candidate + review; CU02 = manual editor; CU03 = Yjs real-time; CU08 = UML validation; CU09/CU10 = Spring eligibility/generation/download; CU11 = explicit save/persistence. UI can orchestrate these, not replicate domain rules.

**Control flow**:
- Read-only question -> CU12 replies, visible to collaborators per current project conversation scope; never mutate model.
- Natural execution request -> existing orchestration invokes CU04 with requester-only authority and change-plan validation; preserve deduplication, plan approval semantics, security and idempotency. Display applied/failed/clarification faithfully. No unconditional `Aplicar` and no new optimistic mutation path.
- Voice: permission -> recording -> stop/cancel -> existing transcription -> visible editable transcript -> user submits (or preserve existing approved explicit flow), no automatic unreviewed modification. Handle permission denied, unsupported browser, missing mic, network error, quotas, loading.
- Image: file select/drop -> preview/rejection (type/size from source rules) -> existing CU05 analysis -> candidate approval. Do not claim attachments automatically enrich CU12 context unless backend and privacy model actually support it. Separate image context from model mutation and report exactly what is sent.
- Collaboration offline/reconnecting/failed: show **real** state without invented participant counts; manual Save must not falsely appear as live sync. Conversations remain correctly scoped to project and user.
- Model UML-valid vs Spring-ineligible stays valid and editable. One authoritative rules source, no copy-pasted front-end checklists, AI capability claims must match actual CU08/CU09 behavior.
- Never invent support for enum `EstadoPrestamo`, arbitrary custom Java types, inheritance, aggregation/composition, 1:1 or N:M JPA. Some mock images show such types; these are **visual placeholders, not functional specifications**.
- Preserve XMI round-trip and canonical IDs, especially associative-class marker, association names and parameter identity (F8-S3); no behavior changes to F8-S4 compatibility contracts.
- Keep sensitive files/keys outside UI and source; no new unprotected Groq endpoints or accidental duplicate billable calls.

## 4. Visual system (pragmatic)

Use **existing design tokens/CSS and components first**; refine incrementally. White or subtle neutral surfaces, restrained blue primary, pale gray separators, one semantic status color at a time; consistent 8px-ish spacing rhythm, approximately 12–16px body and clearly larger headings, strong focus rings, responsive panels. Prefer one main action per surface and contextual disclosure of detail. Avoid dense borders/shadows, duplicate icons/actions and nested scroll traps. The diagram remains the visual focus.

Illustrations in `.codex-local/uiux_refs/` are **inspiration only**. **Written rules above override screenshots**: explicitly remove old assistant nav entry, permanent three-chip selector, fake participant counts, fake automatic save and unsupported enum behavior. The sample model `Socio` / `Prestamo` / `Libro` is illustrative, not a data fixture to hardcode.

## 5. Acceptance criteria (Given / When / Then)

- **UX-01** Given model workspace (including 960px desktop), When either panel is toggled, Then support both open / assistant only / properties only / both closed independently, with no desktop overlap or component remount. Focus mode must restore the previous combination; model, selection, draft/thread, zoom, undo/redo and collaboration must survive. Original acceptance was rejected for width-driven mutual exclusion; corrected implementation requires PO visual revalidation.
- **UX-02** Given assistant is available, When user asks a conceptual UML question, Then shared CU12 answer shows requester context and no irrelevant `Aplicar cambio` action.
- **UX-03** Given an eligible own pending structured recommendation, When requester clicks Aplicar cambio or explicitly requests execution, Then existing backend resolves/revalidates the live model and CU04 plan, applies exactly once only if valid, rejects/clarifies otherwise, and reports the confirmed outcome. A recommendation is not a validated plan; other participants never execute it from realtime messages.
- **UX-04** Given text/voice/image entry, When microphone/upload is unavailable or invalid, Then useful failure/fallback is shown without data loss or unintended model change; do not show misleading success.
- **UX-05** Given UML-valid but Spring-ineligible model, When Validación or Generar is opened, Then the reason and affected element are visible without corrupting or deleting model.
- **UX-06** Given main navigation, When entering Modelo / Desde imagen / Validación / XMI / Generar, Then existing use cases remain reachable and `Asistente IA` is not redundantly listed once chat parity is achieved.
- **UX-07** Given unsaved changes and live collaborators, When header updates, Then saved/unsaved and collaboration-connected are accurate **separate** statuses.
- **UX-08** Given keyboard-only use, When toggling drawers/upload/mic/submit, Then controls have labels, focus visibility, correct tab order, keyboard activation, and ESC for dismissible overlays.
- **UX-09** Given Spanish/English preference, When switched, Then all new strings resolve through existing translations, no hard-coded mixed-language UI.
- **UX-10** Given a UI change, When deployed, Then existing CU02/CU03/CU04/CU05/CU08/CU09/CU10/CU11/CU12 behavior is unchanged unless explicitly specified and tested.

## 6. Implementation responsibilities and release gates

- **Frontend:** layout/drawers, accessible composer, view routing, user feedback, i18n; reuse existing clients/components.
- **Backend:** only add or adjust a contract if a proven integration gap requires it; enforce access, validation, request boundaries, quota, model scope. Do not create one new model or service just for visuals.
- **Database:** no schema/persistence change for panel positions or local UI preferences; retain Mongo project's conversation and manual save behavior.
- **AI:** reuse CU12/CU04/CU05 providers and capability validation; never invent new model support. Any changed public capability must update AI context/guidance and regression tests.

**Release gate per slice:** preserve dirty working tree, focused tests and necessary build (not per every small edit), `git diff --check`, human review of screenshots **before moving to next slice**, update 3 local UIUX Markdown; update F8 PO contract only when behavior/capabilities materially change. No staging/commit/push/reset/clean/stash/checkout. No broad suites, Groq calls or DB writes absent explicit approval.

## F8-UX02 delivery (2026-11-10)

Historical UX02 delivery: one text composer/shared history, no duplicate CU04 form or Asistente IA navigation; contextual requester-only CTA, existing orchestrator/executor, ES/EN and independent UX01 panels retained. 45 focused frontend + 5 capability tests passed; frontend TypeScript exit 0. At that delivery audio remained deferred. Visual/two-browser acceptance pending. UX03 was subsequently explicitly approved; UX04 remains proposed.

## F8-UX03 delivery and limits (2026-11-10)

- Implemented: readable scrollable conversation, bottom multiline composer, wider adjustable panel (compact bounds at 960px), ES/EN. Existing voice transcription populates editable text; stop/cancel never authorizes modeling. Permission/service/unavailable states preserve text.
- Images: PNG/JPEG up to backend's 10 MiB limit, preview/removal before Send. Send calls existing CU05 analysis only, preserves the text for a separate turn, and requires candidate confirmation against the live model. Existing four-image review limit, warnings, activity attribution and explicit Save preserved. Dedicated Desde imagen remains accessible.
- **Unsupported:** CU12 visual question/context and durable/shared image attachments. Existing contracts accept image-only CU05 analysis, not image+conversation context. Preview/candidate remain local to the requesting browser; confirmed model changes synchronize normally. A future feature needs an explicit authorized project/participant attachment/context/retention contract; do not add endpoints or promise support implicitly.
- Historical UX03 evidence: 73 focused frontend + 5 capability tests passed; frontend build including TypeScript exited 0. No real provider/device/geometry verification; visual, real microphone and two-browser acceptance remain external. UX04 was subsequently explicitly approved; UX05 is not approved.

## F8-UX04 delivery (2026-11-10)

- Five central functional views now use existing components/services. Navigation selection is independent of assistant/properties controls; editor, conversation and feature components remain mounted across navigation. UX01 panel combinations/focus and UX02/03 text/voice/CU05 input retained.
- Existing tokens/CSS establish blue/white hierarchy, consistent spacing, headings, actions, focus-visible controls and responsive surfaces. Selected class heading names the actual class. CU05 has an explicit upload/preview/review area; no duplicate composer or new visual-AI capability.
- Validation groups existing UML errors/warnings and resolves known target IDs to names. Spring eligibility and blocking reasons remain a separate authoritative assessment. No invented validation/JPA mappings or new automatic diagram-selection API.
- XMI import/export have separate actions, busy/result/error states and expandable profile limitations; confirmation and data-loss protections unchanged. Generation keeps its existing action visible above diagnostics, preserves download, and explains bounded scope.
- Evidence: **112 focused frontend tests in 7 files**, TypeScript and frontend build passed. Empty-model regression expectation corrected to current UML-valid/Spring-ineligible rules; production validation unchanged. No broad suites, live AI/DB or backend edits.
- **PO visual acceptance pending**: review 960/1200/mobile, light/dark, all five views, both panels/focus, scrolling/long labels, actual Apollon selection/zoom/undo after returning to Modelo, CU05/XMI state, two-user synchronization and Save/reopen. At UX04 delivery, UX05 had not yet been approved; subsequent QA authorization/evidence follows below. Previous runtime/XMI audit evidence and external Enterprise Architect limitations are preserved.

## F8-UX05 approved QA (2026-11-10)

- UX05 explicitly approved for QA; UX04 visual acceptance remains pending. No general redesign or domain/backend changes authorized.
- Actual Chrome observations: 960/1200 desktop four-panel combinations/non-overlap/focus restoration; mobile 390/768 stacking and reachable composer; five views, ES/EN/light/dark; real selection, zoom, drag + Undo/Redo and navigation persistence. Screenshots in uiux-evidence/ux05/ were inspected, not merely generated.
- **P1 reproduced and fixed:** Save notification overlaid mobile workspace controls and intercepted clicks. Only production change: .topbar-message uses its own header grid row instead of absolute positioning below the header. Native click/keyboard regressions at 390/768/960 pass.
- **18/18 focused browser checks + 3/3 Playwright regressions**, zero uncaught page errors; frontend TypeScript/build passed. Covered deterministic voice-to-draft without autoexecution, image preview/candidate confirmation, controlled error state, local XMI export/confirmed import, Spring ZIP download, requester-owned proposal/CU04 execution, two-client Yjs and explicit Save/reopen.
- Boundaries: browser fake microphone, existing deterministic providers, file-backed test projects and in-memory messages; no live Groq, production Mongo, PostgreSQL or Spring compilation. Normal-class/association XMI workflow is not external Enterprise Architect or full-profile proof. CU12 visual context/durable attachments remain unsupported.
- **Remaining PO review:** current screenshots/spacing/contrast and long text, physical microphone/permission/device matrix, production persistence/provider behavior. Existing non-blocking P2: hardcoded Volver in EN and pale participant-label/native file-control presentation; no P2 redesign undertaken. QA results do not grant PO visual acceptance or claim comprehensive accessibility/full regression.
