# SW1 Collaborative CASE Tool — Final Master Project Context

> **Status:** Consolidated baseline  
> **Purpose:** Single entry point for recovering the complete project context without rereading the full conversation history  
> **Language:** English for durable technical context; professor-facing artifacts may later be produced in Spanish  
> **Supersedes:** the previous working MD set `00_EVIDENCE_MANIFEST` through `07_REUSE_AUDIT_JHIPSTER_GENERATOR` as the active baseline. Keep the old files only as an audit/archive trail.

---

## 1. Why this record set exists

This project has accumulated requirements from professor transcripts, technical repository audits,
architecture decisions, risk analysis, and implementation strategy.

The purpose of these final MD files is to make that knowledge durable and operational.

A contributor, team member, or AI assistant should be able to read this folder and answer all of the
following without guessing:

- What exactly did the professor ask us to build?
- What is explicitly mandatory and what is our own design decision?
- What is the product problem and who is the user?
- What is in scope and what is intentionally out of scope?
- Which external components were investigated?
- Which components will actually be used at runtime?
- Which repositories are only references?
- How will the components be integrated?
- What is the canonical model?
- How will manual editing, AI, voice, image input and XMI converge into one modeling workflow?
- How will a UML class model become a Spring Boot/PostgreSQL backend?
- What must the generated backend contain?
- What is the separate role of the Flutter mobile application used during the exam?
- Which requirements still need real validation?
- What must be tested before claiming the product is complete?
- What evidence must be preserved for the PUD record, documentation/software contrast, and individual defense?

These files are therefore not general notes. They are the **project operating baseline**.

---

## 2. Source precedence and evidence discipline

When information conflicts, use this order:

1. **Newest professor instruction or transcript**
2. **Observed runtime behavior / source-code evidence**
3. **Accepted project architecture decision**
4. **Derived engineering consequence**
5. **Assumption or pending validation**

Evidence labels used in this record set:

| Label | Meaning |
|---|---|
| `P-EXPLICIT` | Directly stated by the professor in the supplied transcripts |
| `CODE-VERIFIED` | Observed during the source-code audits |
| `DECISION` | Accepted architecture/product decision for this implementation |
| `DERIVED` | Professional consequence required to make an explicit requirement correct/testable |
| `PENDING` | Must still be proven with a real spike, runtime test, professor confirmation, or device test |
| `DEFERRED` | Intentionally outside the current mandatory implementation scope |

Golden evidence rule:

> Never upgrade a `PENDING` statement into a fact because it sounds plausible.  
> Never present a `DECISION` as if the professor explicitly requested that exact technology.

---

## 3. Project in one sentence

Build a **collaborative CASE tool for conceptual data design using UML class diagrams** that lets
software designers model manually or through an AI-assisted agent, exchange models with Enterprise
Architect, and deterministically generate a complete Spring Boot backend whose relational
persistence is PostgreSQL.

---

## 4. Scope narrowing mandated by the professor

The assignment was deliberately narrowed:

```text
Entire software lifecycle
        ↓
Design phase
        ↓
Data design
        ↓
Conceptual data model
        ↓
UML class diagram
```

The product is **not** a complete UML suite and **not** a complete lifecycle CASE platform.

Its center is collaborative conceptual data modeling.

The professor frames the product as a CASE tool whose primary purpose is improved software-engineer
productivity.

---

## 5. Primary user and real product problem

### Primary user

**Software Designer / Software Engineer**

The user is the person designing the conceptual data model, not the eventual business user of the
generated application.

### Real problem

Traditional modeling workflows are fragmented:

- designers work in isolated diagramming tools;
- concurrent modeling is difficult;
- semantic changes are often repeated manually;
- interoperability between tools is fragile;
- converting class models into backend code is repetitive;
- model and implementation can diverge.

### Product value

The CASE tool reduces this friction through:

- collaborative modeling;
- structured UML semantics;
- AI-assisted editing;
- voice commands;
- image/photo reconstruction of an existing diagram;
- Enterprise Architect import/export;
- deterministic UML-to-backend transformation;
- reusable components and clear interfaces.

---

## 6. The professor's critical distinction about AI

The CASE tool must include AI functionality for the designer.

However, the professor explicitly distinguished **editing assistance** from **autonomous
requirements-to-diagram generation**.

Correct intent:

```text
Designer: "Create a Customer class."
Designer: "Add email:String."
Designer: "Relate Customer to Order."
Designer: "Set this multiplicity."
Designer: "Move/Delete/Rename this class."
```

Not the primary intended behavior:

```text
"Here is the whole business problem. Design everything for me."
```

A separate professor exam scenario allows taking a **photo of an already-defined diagram** and
loading it into the tool. That does not contradict the rule above: photo input reconstructs an
existing model; it is not autonomous domain design from requirements.

---

## 7. Mandatory interaction paths

The same UML model may enter or change the system through several paths:

```text
Manual GUI editing
Voice → speech-to-text → AI command
Text → AI command
Photo/image → candidate UML reconstruction
Enterprise Architect XMI import
```

All paths must converge into validated structured semantics.

No feature should generate backend code from:

- pixels;
- raw DOM;
- uncontrolled natural-language text;
- arbitrary canvas labels.

---

## 8. Mandatory output path

```text
Validated UML class model
        ↓
Object-oriented → relational mapping rules
        ↓
Spring-specific generation model
        ↓
Deterministic templates
        ↓
Spring Boot backend
        ↓
JPA / Hibernate
        ↓
PostgreSQL
```

The generated backend must be **100% Spring Boot**.

Minimum professor-explicit layers:

```text
Model / Entity
Repository
Service
Controller
```

DTO may be added when necessary.

The database should arise from the generated model/persistence layer through ORM behavior rather
than requiring a manually written database script as the primary mechanism.

---

## 9. Separate exam client

The CASE tool and the exam mobile frontend are different concerns.

### CASE tool

Prepared before the exam:

- collaborative UML class modeling;
- AI-assisted editing;
- manual/voice/photo input;
- Enterprise Architect interoperability;
- backend generation.

### Flutter client

Built during the exam scenario against the generated backend:

- Flutter;
- mobile;
- AI-assisted/voice-first interaction;
- traditional UI may exist as fallback;
- local AI must keep working without internet;
- locally created updates must synchronize after connectivity returns.

The professor explicitly clarified that the **local/offline AI requirement applies to the mobile
application, not to the CASE diagram editor**.

---

## 10. Final component strategy

Four repositories were audited.

### Apollon — runtime foundation

Use for:

- UML/class-diagram editor;
- structured editor model;
- multiplicities/roles/relationships;
- Yjs-based collaboration foundation;
- presence/cursors;
- model subscriptions;
- relevant persistence/server patterns.

### crunch_uml — isolated runtime adapter candidate

Use for:

- Enterprise Architect XMI parsing;
- EA extension handling;
- XMI rendering;
- multiplicities/roles/generalizations;
- diagram geometry;
- optional `.qea/.qeax` knowledge.

Must remain behind our own adapter.

### OpenFlowKit — reference/pattern donor

Do **not** add its canvas or collaboration stack.

Adapt its useful patterns:

- AI provider abstraction;
- multimodal image packaging;
- local-model pattern;
- deterministic parsing;
- bounded repair loop;
- preview-before-apply;
- focused edits;
- stable identifiers.

### JHipster Generator — reference/pattern donor

Do **not** invoke the full JHipster platform as our primary generator.

Adapt its useful generation principles:

- semantic intermediate representation;
- entity/field/relationship preparation passes;
- deterministic relationship ownership;
- type/naming normalization;
- EJS template architecture;
- generated-project compile tests.

---

## 11. Clean final architecture

```text
                        SOFTWARE DESIGNER
                              │
           ┌──────────────────┼───────────────────┐
           │                  │                   │
           ▼                  ▼                   ▼
     Manual Apollon       Text / Voice         Image
           │                  │                   │
           │                  ▼                   ▼
           │             AI Gateway        Vision AI Adapter
           │                  │                   │
           │                  ▼                   ▼
           │           ModelCommand[]      CandidateUMLModel
           │                  │                   │
           │                  └────────┬──────────┘
           │                           ▼
           │                    Domain Validation
           │                           │
           └──────────────┬────────────┘
                          ▼
               Canonical UML Semantics
                / Apollon Adapter Boundary
                          │
         ┌────────────────┼─────────────────┐
         │                │                 │
         ▼                ▼                 ▼
  Yjs Collaboration   XMI Adapter      Spring Mapper
  + Persistence           │                 │
                           ▼                 ▼
                      crunch_uml      SpringProjectModel
                           │                 │
                           ▼                 ▼
                 Enterprise Architect   EJS Templates
                                             │
                                             ▼
                                      Spring Boot/JPA
                                             │
                                             ▼
                                         PostgreSQL
```

Important nuance:

> There must not be two independently writable sources of truth.  
> Apollon/Yjs may hold the live collaborative editor state, but every non-editor subsystem crosses a
> canonical semantic contract. The **canonical semantics** are authoritative for validation,
> interoperability and generation.

---

## 12. Final architecture style

The recommended product architecture is a **modular application with explicit adapters**, not a
distributed microservice system.

Primary runtime pieces:

```text
React + TypeScript web application
Apollon editor component
Node.js/TypeScript application backend
Apollon/Yjs collaboration support
CASE-model persistence
Small Python XMI bridge using crunch_uml
AI provider adapter
Deterministic Spring Boot generator
```

The Python XMI bridge is a language boundary, not justification for a large microservice ecosystem.

---

## 13. Non-negotiable product principles

1. Model semantics are structured; the canvas is not interpreted as pixels.
2. AI edits through constrained operations/contracts.
3. AI does not directly write final Spring code.
4. Backend generation is deterministic.
5. Invalid UML must not silently produce code.
6. External repositories are reused behind clear boundaries.
7. There is one supported backend profile, not a generic low-code platform.
8. PostgreSQL is the generated persistence target.
9. Collaboration must be demonstrated with two real clients.
10. Enterprise Architect compatibility is not considered complete until a real EA round-trip passes.
11. Generated backend success means more than files existing: it must compile and run.
12. Documentation claims must have implementation/test evidence.
13. The team must understand reused and original code well enough for individual defense.
14. No new large repository should be added without a concrete unresolved blocker.

---

## 14. Current project state

### Completed research

- professor requirement reconstruction;
- Apollon audit;
- crunch_uml audit;
- OpenFlowKit audit;
- JHipster Generator audit;
- high-level architecture selection;
- reuse boundaries;
- preliminary UML→JPA mapping strategy;
- risk identification.

### Still pending

- real Enterprise Architect round-trip;
- first Apollon integration in our own project;
- exact canonical model implementation;
- first end-to-end generated Spring Boot backend;
- compile/run verification against PostgreSQL;
- AI command implementation;
- voice pipeline;
- image candidate-model pipeline;
- production deployment;
- Flutter local-AI/device feasibility spike;
- contextual learning agent;
- complete PUD evidence record and final documentation.

### Research status

> General repository hunting is closed.  
> From this point forward, research should be triggered by a concrete implementation blocker.

---

## 15. Required real-world proof points

The following are stronger than screenshots alone:

```text
Two browser sessions collaboratively edit the same model.
Enterprise Architect imports XMI exported by our tool.
Our tool imports an EA-exported model.
AI command modifies the intended UML element without changing unrelated elements.
A diagram photo becomes editable structured UML after confirmation.
Generated Spring Boot project compiles.
Generated Spring Boot project starts.
PostgreSQL schema is created by the persistence layer.
REST CRUD works.
Flutter client consumes the generated backend.
Mobile AI still performs the required local inference while offline.
Queued mobile updates synchronize after connectivity returns.
```

---

## 16. Professor evaluation gates

The supplied transcript defines four sequential gates.

### Gate 1 — Documentation

- PDF uploaded no later than **08:00 on exam day**.
- Professional formatting.
- Navigable table of contents.
- Theoretical foundation.
- PUD development-process record.
- User-learning mechanism.
- Annexes/evidence.

### Gate 2 — Software as product

- production/cloud version;
- complete;
- tested;
- reliable;
- product-quality evidence.

### Gate 3 — Documentation ↔ software consistency

- everything documented must exist;
- everything important in software must be documented.

### Gate 4 — Individual authorship/defense

Potential actions:

- explain selected code;
- predict runtime behavior;
- rewrite deleted code;
- perform live changes.

The professor states that all four gates must be passed to reach the minimum passing threshold.

---

## 17. Document map

Read in this order:

| File | Purpose |
|---|---|
| `README.md` | Master context, evidence rules, current state, architecture in one view |
| `01_REQUIREMENTS_SCOPE_AND_EXAM_BASELINE.md` | Professor requirements, actors, scope, use cases, constraints, exam rules |
| `02_SYSTEM_ARCHITECTURE_AND_INTEGRATION_BLUEPRINT.md` | Runtime architecture, components, data flows, integration contracts, deployment |
| `03_COMPONENT_REUSE_AUDIT_AND_INTEGRATION_STRATEGY.md` | Final decisions for Apollon, crunch_uml, OpenFlowKit and JHipster |
| `04_FUNCTIONAL_AND_TECHNICAL_SPECIFICATION.md` | Canonical model, commands, validation, XMI, AI, generator, Flutter/offline behavior |
| `05_EXECUTION_ROADMAP_QUALITY_RISKS_AND_ADRS.md` | Implementation order, spikes, tests, DoD, risk register, ADRs |
| `06_PUD_DOCUMENTATION_TRACEABILITY_AND_DEFENSE.md` | PUD evidence strategy, theory-to-code mapping, traceability, exam/defense checklist |

---

## 18. Glossary

| Term | Meaning in this project |
|---|---|
| CASE | Computer-Aided Software Engineering |
| Canonical UML Model | Stable semantic representation used at subsystem boundaries |
| Apollon UMLModel | Editor-native structured representation |
| ModelCommand | Constrained operation produced by AI or automation |
| CandidateUMLModel | Uncommitted model reconstructed from image/AI input |
| XMI Adapter | Our boundary around Enterprise Architect exchange |
| SpringProjectModel | Spring-specific intermediate representation used by generator |
| Generation IR | Intermediate representation prepared before template rendering |
| EA | Sparx Enterprise Architect |
| PUD | Proceso Unificado de Desarrollo de Software / Unified Process |
| P0 | Mandatory/core implementation priority in the project plan |
| Spike | Focused experiment that proves or disproves a technical assumption |

---

## 19. Fast restart context

> We are building a collaborative CASE tool focused exclusively on conceptual data design using UML
> class diagrams. The professor requires manual and AI/voice editing, collaboration, photo-based
> reconstruction of an existing diagram, Enterprise Architect import/export, and deterministic
> generation of a complete Spring Boot backend with PostgreSQL. Apollon is the selected UML editor
> and collaboration foundation. crunch_uml is the isolated XMI/EA bridge candidate, pending real EA
> round-trip verification. OpenFlowKit is only a reference for AI provider abstraction,
> multimodal input, bounded self-repair and preview/apply. JHipster is only a reference for
> semantic preparation and template-based Spring generation. Our code owns the canonical semantic
> contract, validation, ModelCommand layer, UML→JPA mapping and Spring generator. The separate
> Flutter exam client must use local AI while offline and synchronize changes when connectivity
> returns. Repository research is closed; next work is proof and implementation.

---

## 20. Change-control rule

Every new requirement or architecture change must answer:

1. What source changed?
2. Is the change `P-EXPLICIT`, `CODE-VERIFIED`, `DECISION`, `DERIVED`, or `PENDING`?
3. Which use case is affected?
4. Which component is affected?
5. Does canonical-model schema change?
6. Does XMI mapping change?
7. Does code generation change?
8. What tests must change?
9. What PUD/documentation evidence must change?
10. Does this increase exam risk?

If these questions are not answered, the change is not ready to enter the baseline.
