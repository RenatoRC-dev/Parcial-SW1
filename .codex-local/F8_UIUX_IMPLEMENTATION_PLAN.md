# NexoCASE | F8 UIUX implementation roadmap (PO-approved intent)

**Reference:** `F8_UIUX_PO_SPEC.md` is the behavior contract; `F8_UIUX_CURRENT_SLICE.md` is the sole active task. Visual files optional and non-authoritative. **Never start another slice automatically.** Older F8-S1..S4 work must remain intact (some changes are uncommitted). Prior F8-S4 frontend production build passed; this is **not** proof of future UI changes.

| Slice | Goal / minimum scope | In scope | Exit criteria | Approval |
|---|---|---|---|---|
| **F8-UX01** | Independent assistant/canvas/properties; all four layouts including 960px | PaginaModeladoClases.tsx, styles.css, focused test; two necessary focus/restore ES/EN labels in PreferenciasUI.tsx; existing nav/content preserved | Corrected after PO rejection: 19 focused tests + npm run build passed; 4/4 combinations, focus restoration, no forced exclusivity. New visual review pending (F8_UIUX_CURRENT_SLICE.md) | **CORRECTION IMPLEMENTED (4/4) / PO VISUAL REVIEW PENDING** |
| **F8-UX02** | One assistant and text composer via existing orchestrator; duplicate form/nav removed | Own correlated pending proposal CTA requests backend validation; foreign messages visible without execution; ES/EN; UX01 states retained | **45 frontend + 5 capability tests passed; frontend tsc --noEmit exit 0**. Direct commands, questions, recommendations, Ejecuta, target/ownership, confirmation failure without duplicate apply, navigation and independent panels covered. Two-browser/visual acceptance pending | **APPROVED / IMPLEMENTED; INDEPENDENT ACCEPTANCE PENDING** |
| **F8-UX03** | Comfortable chat + real voice/image inputs | Wider keyboard-adjustable panel; independent scrolling; bottom multiline composer; existing transcription to editable draft; CU05 attachment preview and candidate review | **73 frontend + 5 capability tests passed; TypeScript + frontend build exit 0**. Recording cancel/denial/failure, image limits/preview/removal/failure/confirmation, preserved CU04/12 and independent panels covered. Real browser/device/visual acceptance pending | **APPROVED / IMPLEMENTED WITH CONTRACT LIMITS**: image-as-context CU12 and durable attachments unsupported |
| **F8-UX04** | Five consistent central feature views | Modelo, Desde imagen, Validación, XMI, Generar; persistent independent assistant/properties; shared light-blue tokens, forms/actions, named selection/diagnostics; existing rules/services | **112 focused frontend tests / 7 files passed; TypeScript + frontend build exit 0**. Navigation/mount preservation, separate UML/Spring results, CU05/XMI/generation states and ES/EN covered. Actual geometry/Apollon/two-browser review remains external | **APPROVED / IMPLEMENTED; PO VISUAL ACCEPTANCE PENDING** |
| **F8-UX05** | Approved focused QA; UX04 visual acceptance still pending | Actual Chrome 960/1200 + mobile 390/768, panel/focus states, chat/media, real editor/history, local XMI/ZIP, two-client Yjs/Save | **18 browser checks + 3 Playwright regressions passed; TypeScript/frontend build exit 0**. P1 Save-feedback overlay fixed in CSS; current screenshots inspected. Fake mic/deterministic AI/file-backed test projects; production Mongo and physical devices unverified. Existing P2 EN Volver/visual contrast review remains | **QA PASS WITH LIMITATIONS / PO ACCEPTANCE PENDING** |

### Technical touchpoints (suggestions, inspect actual current repo before edits)

- Shell: `frontend/src/paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases.tsx`, `frontend/src/App.tsx`, `frontend/src/styles.css`.
- Assistant: `frontend/src/paquetes/asistencia_contextual/casos_uso/cu12_asistir_usuario/PanelAsistenteContextual.tsx`; `frontend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/PanelAsistenteModelado.tsx`; `frontend/src/paquetes/asistencia_ia/casos_uso/cu04_modelar_con_ia/voz/GrabadorInstruccionVoz.tsx`.
- Image: `frontend/src/paquetes/asistencia_ia/casos_uso/cu05_modelar_desde_imagen/PanelModeladoDesdeImagen.tsx`.
- Inspector/model: `.../cu02_modelar_diagrama_clases/componentes/InspectorPropiedadesUML.tsx` and `AnfitrionEditorApollon.tsx`.
- Other panes: `frontend/src/paquetes/validacion/...`, `frontend/src/paquetes/interoperabilidad/compartido/PanelInteroperabilidadXmi.tsx`, `frontend/src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PanelGeneracionSpring.tsx`.
- Localization: `frontend/src/configuracion/PreferenciasUI.tsx` (inspect actual i18n structure); current test counterparts next to files and `frontend/tests/e2e/`.

**Token discipline:** inspect current source by `rg` and relevant line ranges; do not read all 12 CU. Do not create a new design system or routing framework. Prefer reusing existing state and CSS, small PR-sized changes and no speculative backend operations. Do not replace real editor canvas with custom SVG.

### Maintenance at every completed slice

1. Update `.codex-local/F8_UIUX_CURRENT_SLICE.md`: verified done / remaining / blocker / next proposed.
2. Update `.codex-local/F8_UIUX_IMPLEMENTATION_PLAN.md`: status for this slice only.
3. Update `.codex-local/F8_UIUX_PO_SPEC.md` **only** if a deliberate approved requirement clarification occurred; don't rewrite the contract to match a partial implementation.
4. Update `.codex-local/F8_PO_CONTRACT.md` / `F8_S2_COMPATIBILITY_AUDIT.md` only for **actual changed** capabilities, AI claims or verified findings, with traceable test evidence. Do not mark an untested feature done.
5. Keep `.codex-local/CURRENT_SLICE.md` aligned with the active slice (see activation instructions in user chat). Do not modify `AGENTS.md`, local backups or archived audit evidence.

### External evaluation checkpoints

Before acceptance of UX02, personally test two browsers: distinct users on same project, shared conversation, requester-only execution, synchronization and explicit save/reopen. Before UX03: actual mic permission denied + upload invalid + no silent model mutation. Before UX04: Spring-invalid but UML-valid case plus XMI import/export, and no lost selected project. UX05 is final release proof, not a general redesign phase.
