# UIUX current: F8-UX05 QA

**QA PASS WITH LIMITATIONS / UX04 PO VISUAL ACCEPTANCE STILL PENDING**. Current verified results and limits: [CURRENT_SLICE.md](CURRENT_SLICE.md). 18 Chrome checks + 3 focused Playwright regressions passed; frontend TypeScript/build passed. One reproduced P1 fixed: Save feedback overlay intercepted mobile panel controls; CSS now uses a header row. Browser screenshots inspected; fake audio/deterministic AI and file-backed test projects only. Historical UX01-04 evidence below is retained; no new redesign authorized.

## Historical UX01 evidence (following content retained)

# F8-UX01 — corrección: paneles independientes

Estado: **CORRECTION IMPLEMENTED (4/4) / PO VISUAL REVIEW PENDING**. La aceptación anterior fue rechazada por capturas reales: la exclusión por ancho impedía usar ambos laterales. UX02 no estaba aprobado en esta entrega hist?rica.

## Causa y corrección
- PaginaModeladoClases.tsx: eliminados cierres cruzados y efecto de resize que cerraba herramientas. assistantOpen y propertiesOpen independientes; herramienta activa separada de visibilidad. Desde 960 px ambos abiertos inicialmente; en móvil ambos cerrados por defecto, siempre se pueden abrir ambos.
- Cuatro combinaciones soportadas: ambos / asistente / propiedades / ninguno. Modo foco solo oculta, no modifica esos estados; Restaurar paneles recupera exactamente la combinación previa. Escape cierra solo el panel enfocado y vuelve a su control.
- CSS: a 960 px rejilla de 76 px de navegación, 200 px por lateral y espacio central flexible (~484 px antes de ajustes del contenedor). Sin paneles absolutos/superpuestos; cada contenido mantiene su scroll. Por debajo de 960, paneles apilados bajo el lienzo, sin imponer exclusión ni perder estado al redimensionar.
- Contenidos/editor siempre montados. No se cambian modelo, selección, historial de edición, navegación, CU04/CU12, colaboración, Guardar ni peticiones de servidor. PreferenciasUI.tsx solo añade las dos etiquetas imprescindibles de foco/restauración ES/EN.

## Evidencia actual
- PaginaModeladoClases.test.tsx: **17 aprobadas**. Cuatro combinaciones a 1600/1200/960/800/390 px, independencia, Escape, foco retenido al redimensionar, restauración de las cuatro combinaciones, ES/EN, nodos/borradores y montaje estable, modelo no republicado y cero fetch al alternar.
- AnfitrionEditorApollon.test.tsx: **2 aprobadas** existentes con anfitrión real. Total distinto: **19 pruebas focalizadas**; sin suites amplias ni E2E.
- npm run build → **exit 0** (TypeScript + Vite, una ejecución). Aviso de chunks >500 kB sin optimización fuera del alcance. Diff revisado; git diff --check limpio.
- La evidencia anterior (10 pruebas y validación TypeScript/Vite) era insuficiente para aceptar independencia real; no se presenta como aceptación PO. Se preservan F8-S1..S4, informes, pruebas XMI/Spring previas y cambios ajenos.

## Límites y siguiente revisión
- Tests del shell usan componentes instrumentados para acreditar montaje/estado; JSDOM no mide geometría CSS ni prueba selección/zoom/undo/Yjs/chat reales durante el plegado. Anfitrión real se verifica por separado. No afirmar validación visual completa.
- PO debe revisar de nuevo capturas a 960 y 1200 px con ambos laterales, y móvil con paneles apilados; comprobar edición, selección, zoom/pan, undo/redo, borrador/historial, toolbar/minimapa y Guardar manual. No se generaron capturas ni se ejecutaron llamadas IA/BD.
- F8-UX02 permanece PROPOSED / NOT APPROVED; esperar revalidación de UX01 y aprobación. Especificación y plan reflejan la corrección expresa del PO; sin rediseño ni cambios funcionales ajenos.
