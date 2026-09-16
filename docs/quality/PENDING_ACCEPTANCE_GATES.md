# Pending Acceptance Gates

Central register for implemented functionality that still requires external or manual acceptance evidence.

At the beginning of future iterations, agents should review this file. Open gates do not block unrelated development and do not authorize automatic fixes. They must be mentioned in the final iteration report/status, should be suggested again near exam readiness, release readiness, final integration, or documentation freeze, and may only be closed with actual acceptance evidence.

## EA-XMI-001 — Real Enterprise Architect bidirectional XMI acceptance

- **Related package:** Interoperabilidad
- **Related use cases:** CU06 — Importar modelo desde Enterprise Architect; CU07 — Exportar modelo hacia Enterprise Architect
- **Origin:** Iteration 08
- **Current status:** **OPEN — EXTERNAL ACCEPTANCE PENDING**

### Internal evidence already completed

- The real `crunch_uml` adapter works.
- Canonical → XMI → canonical round-trip passes.
- Classes and attributes are preserved.
- The supported `1 ↔ 0..*` association is preserved.
- Multiplicities and roles are preserved.
- Canonical → Apollon works, and the imported model is editable.
- Browser XMI import/export E2E passes.

### External acceptance still required

**Direction A — SW1 → Enterprise Architect**

1. Export `modelo.xmi` from SW1.
2. Import it into real Sparx Enterprise Architect.
3. Verify `Cliente`, `Pedido`, their attributes, the association, multiplicities `1` and `0..*`, and roles `cliente` / `pedidos`.
4. Record the Enterprise Architect version and XMI import option.
5. Save screenshots and evidence.

**Direction B — Enterprise Architect → SW1**

1. Create the equivalent model in real Enterprise Architect.
2. Export it as XMI.
3. Import the EA-produced XMI through CU06.
4. Verify equivalent supported semantics in Apollon.
5. Edit one imported class to prove that the model is live and editable.
6. Save evidence.

### Compatibility note

The current `crunch_uml` renderer emits exchange content declaring XMI 2.1 and a UML 2.1 namespace. This must not be confused with the project's UML 2.5+ conceptual notation requirement. Do not modify these namespaces speculatively; any compatibility correction must be driven by real Enterprise Architect evidence.

### PASS condition

Both directions must pass using real Enterprise Architect. Only then may `EA-XMI-001` be changed to `CLOSED` and Iteration 08 be changed to `PASS`.
