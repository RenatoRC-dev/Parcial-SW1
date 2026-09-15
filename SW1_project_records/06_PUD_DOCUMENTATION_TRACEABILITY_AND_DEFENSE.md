# 06 — PUD, Documentation, Traceability and Defense Plan

> **Status:** Documentation/evidence baseline  
> **Purpose:** Ensure that the software-development process, academic report and implemented product
> remain synchronized through the exam.

---

# 1. Professor's documentation structure

The supplied evaluation transcript explicitly requires three core blocks in the exam documentation:

```text
1. Theoretical Foundation
2. Software Development Process Record
3. Mechanism for the User to Learn and Use the Application
+ Annexes / supporting evidence
```

If the faculty/course format also includes general project sections such as introduction,
objectives, scope and limitations, those may appear before the professor-mandated blocks, but they
must not replace them.

---

# 2. Documentation deadline and format

Professor-explicit:

- upload PDF by **08:00 AM on exam day**;
- use professional formatting;
- include margins/spacing/typography;
- include a fully navigable table of contents;
- include annexes;
- APA is a useful reference for academic formatting/citations.

Operationally:

- export the final PDF the day before;
- verify links/bookmarks;
- reopen the exact uploaded PDF;
- verify file integrity after upload;
- do not rely on a last-minute conversion.

---

# 3. Theoretical Foundation — required topics

The professor's theory is not decorative.

Each topic must answer:

```text
What is it?
Why does it matter here?
Which principle are we applying?
Where is it implemented?
What evidence proves it?
```

---

# 4. CASE / Computer-Aided Software Engineering

Core study questions:

- What is CASE?
- Who is the user of a CASE tool?
- Why is a CASE tool more than a diagram drawing program?
- How does CASE improve productivity?
- What does modeling mean in this project?
- Why does code generation belong to the CASE value proposition?

Project evidence:

- class modeling;
- collaboration;
- model validation;
- AI-assisted editing;
- XMI interoperability;
- Spring generation.

Defense line:

> The product assists software engineering work by transforming a structured engineering model into
> reusable downstream artifacts, rather than only drawing shapes.

---

# 5. Component-Based Software Development

Professor emphasis:

- reuse components;
- do not build everything from zero;
- understand component interfaces/protocols;
- also create reusable components.

Project application:

```text
Apollon → reused modeling/collaboration component
crunch_uml → reused XMI/EA component
OpenFlowKit → learned AI design patterns
JHipster → learned generation patterns

Our reusable components:
ApollonAdapter
XmiAdapter
UMLValidator
ModelCommand
AIModelGateway
SpringModelMapper
SpringBootGenerator
```

Evidence:

- repository audits;
- dependency boundaries;
- adapter interfaces;
- version pinning;
- attribution/license records;
- integration tests.

---

# 6. Software Architecture

Professor key framing:

> The architecture exists to help software live longer by reducing the cost/effort of change.

Project architecture must therefore be explained through change scenarios.

Examples:

### Replace AI provider

Should change:

```text
AI provider adapter
```

Should not change:

```text
canonical model
XMI
generator
```

### Replace/upgrade XMI engine

Should change:

```text
XmiAdapter implementation
```

Should not change:

```text
Apollon
AI
Spring mapping
```

### Change Spring template

Should change:

```text
generation mapper/template
```

Should not change:

```text
editor model
collaboration
```

This is a stronger architecture explanation than merely naming "layers."

---

# 7. UML class diagrams

Professor-explicit study direction:

- UML 2.5 or later;
- class diagrams specifically;
- Booch;
- Rumbaugh;
- Jacobson;
- OMG standards material.

Project emphasis:

- classes;
- attributes;
- relationships;
- multiplicities;
- roles;
- generalization where supported.

Key defense idea:

> The UML model is an engineering input. If its semantics are wrong, every generated artifact can be
> wrong.

---

# 8. Object-oriented → relational mapping

Professor explicitly identifies the conceptual mismatch:

```text
UML class model = object-oriented
PostgreSQL = relational
```

The tool must bridge the two with rules.

Theory/evidence connection:

```text
UML multiplicity
 ↓
relationship mapper
 ↓
JPA annotation
 ↓
foreign key / join table
```

Examples:

```text
1:N → @OneToMany / @ManyToOne
N:M → @ManyToMany + join table
1:1 → @OneToOne + unique FK
```

Rumbaugh/OMT/TMO is a professor-indicated theoretical direction.

---

# 9. AI in Software Development

The professor requires discussion of two different uses.

## 9.1 AI-assisted development by the team

Document actual practices such as:

- requirement decomposition;
- specification-driven tasks;
- code review;
- test generation;
- repository audits;
- controlled agent workflows;
- prompt/spec files;
- human verification.

Do not write "AI made the project."

Demonstrate controlled engineering use.

## 9.2 AI embedded in the product

Evidence:

- `AIModelGateway`;
- command schema;
- validation;
- repair loop;
- voice;
- image reconstruction;
- contextual assistant.

Key defense rule:

> The AI proposes constrained structured operations; deterministic code validates and executes them.

---

# 10. Spring Boot

Must cover enough theory to explain generated code:

- application bootstrap;
- dependency injection;
- controller;
- service;
- repository;
- entity;
- Spring Data JPA;
- Hibernate;
- Jakarta Validation;
- configuration;
- PostgreSQL datasource;
- REST behavior.

Every generated layer must be understood by the team.

---

# 11. Additional supporting theory

Include only if reflected in software:

- PostgreSQL;
- JPA/Hibernate;
- XMI interoperability;
- collaborative software;
- CRDT/Yjs;
- model-driven/code generation;
- template generation;
- software quality/testing;
- local/offline AI for mobile;
- synchronization strategies.

Avoid theoretical filler.

---

# 12. PUD / Unified Process record

The professor explicitly requires use of the **Proceso Unificado de Desarrollo de Software** and
states that the process record should follow the process rather than inventing/removing arbitrary
steps.

The project record must describe what actually happened.

Do not fabricate historical artifacts after implementation.

---

# 13. PUD evidence strategy

For every iteration/work period record:

```text
Iteration ID
Date
Phase
Objective
Requirements/use cases addressed
Inputs
Analysis/design decisions
Components reused
Implementation work
Tests executed
Evidence produced
Problems/risks found
Decisions/changes
Result
Next action
Git commit(s)
```

Example:

```text
Iteration E-03
Objective:
Prove canonical mapping for one-to-many.

Requirements:
UC02, UC08, UC09.

Implementation:
ApollonAdapter maps Customer 1 ---- * Order.

Tests:
round-trip fixture;
generation mapper test.

Risk found:
endpoint multiplicity orientation was ambiguous.

Decision:
normalize both endpoint multiplicities in canonical model.

Evidence:
test log;
screenshot;
commit hash.
```

---

# 14. What existing project work already belongs in the process record

Do not lose the work already done.

Record as real engineering activities:

- requirement extraction from professor transcripts;
- scope narrowing;
- repository candidate search;
- Apollon source audit;
- crunch_uml source audit;
- OpenFlowKit source audit;
- JHipster Generator source audit;
- architecture decisions;
- risk analysis;
- documentation skeleton;
- technology selection;
- generated-context MD consolidation.

These are analysis/elaboration activities, not wasted pre-coding time.

---

# 15. Evidence repository layout

Recommended:

```text
docs/
├── project-context/
├── pud/
│   ├── iteration-01.md
│   ├── iteration-02.md
│   └── ...
├── evidence/
│   ├── requirements/
│   ├── apollon/
│   ├── collaboration/
│   ├── xmi/
│   ├── ai/
│   ├── generation/
│   ├── postgresql/
│   ├── deployment/
│   └── flutter/
├── decisions/
└── final-report/
```

Evidence should be easy to trace.

---

# 16. Evidence naming convention

Example:

```text
2026-09-16_UC03_collaboration_two_clients.png
2026-09-17_XMI_EA_roundtrip_original.xmi
2026-09-17_XMI_EA_roundtrip_generated.xmi
2026-09-18_GEN_one_to_many_maven_build.txt
2026-09-18_DB_postgresql_relationship.png
```

Do not keep important proof only in chat messages.

---

# 17. Traceability matrix

Maintain continuously.

| Requirement | Use Case | Architecture Component | Implementation | Test | Evidence | Status |
|---|---|---|---|---|---|---|
| Manual UML | UC02 | ApollonAdapter | editor integration | E2E | screenshot/log | |
| Collaboration | UC03 | Yjs/Apollon | collaboration | 2-client E2E | video/log | |
| AI editing | UC04 | AIModelGateway + commands | AI module | command tests | transcript/result | |
| Voice | UC04 | speech adapter | voice module | voice test | recording/log | |
| Image | UC05 | image adapter | candidate model | image fixture | before/after | |
| XMI import | UC06 | XmiAdapter | crunch bridge | EA fixture | imported model | |
| XMI export | UC07 | XmiAdapter | crunch bridge | real EA import | EA screenshot | |
| Validation | UC08 | UMLValidator | validator | unit | issue report | |
| Spring generation | UC09 | generator | mapper/templates | compile | Maven log | |
| PostgreSQL | UC09 | generated JPA | generated backend | integration | DB evidence | |
| Guidance | UC12 | contextual assistant | assistant | guided scenario | recording | |
| Offline mobile AI | exam client | mobile local AI | Flutter | device offline | video/log | |
| Sync recovery | exam client | sync queue | Flutter | reconnect test | log | |

Gate 3 depends on this discipline.

---

# 18. User-learning mechanism

The professor prefers an agent over a static manual.

The mechanism should be documented as a product feature.

Minimum state model:

```text
current screen
current selected UML element
current validation issues
current workflow stage
recent action
generation readiness
```

Agent behaviors:

- explain what the user is seeing;
- suggest next action;
- explain validation;
- focus an element;
- explain an AI command format;
- guide import/export;
- guide generation.

Example:

```text
"You have finished defining classes, but two relationships do not have multiplicities.
Resolve those before generating the backend."
```

Evidence:

- guided walkthrough;
- screenshots;
- assistant logs;
- acceptance test.

---

# 19. Software-as-product evidence — Gate 2

The professor wants proof of quality.

Prepare:

- production URL;
- current version/commit;
- test summary;
- known limitations;
- generated build logs;
- uptime/health proof;
- collaboration proof;
- XMI proof;
- error-handling proof;
- local fallback instructions.

Do not answer:

```text
"Yes, it is high quality."
```

Answer with evidence.

---

# 20. Documentation ↔ software contrast — Gate 3

Use two checks.

## Document → software

For every major claim:

```text
Where is it implemented?
Which module?
Which test?
Which evidence?
```

## Software → document

For every important module:

```text
Which requirement?
Which theoretical concept?
Which process iteration?
Which report section?
```

No undocumented "bonus" architecture that the team cannot explain.

---

# 21. Individual defense — Gate 4

Prepare every team member to explain:

- why the project is a CASE tool;
- why class diagrams are not mere drawings;
- why canonical semantics are necessary;
- why Apollon was reused;
- why crunch_uml is isolated;
- why OpenFlowKit was not adopted as a second editor;
- why JHipster was not embedded;
- how AI commands are validated;
- how image reconstruction is controlled;
- how 1:N becomes JPA;
- how PostgreSQL is created;
- how collaboration converges;
- how XMI flows;
- how generated code compiles;
- why Flutter/local AI is separate.

---

# 22. Code-defense rehearsal

Practice:

### Explain code

Pick a random function and answer:

```text
input
precondition
what it changes
output
failure behavior
tests
```

### Delete/rewrite

Team member should be able to reconstruct their own:

- adapter mapping;
- command validator;
- relationship mapper;
- template;
- controller endpoint.

### Live change

Examples:

- add a supported type;
- add a new validation;
- change REST path;
- add a field to canonical model;
- adjust relation mapping.

---

# 23. Production and local versions

Professor transcript expectation:

### Gates 2 and 3

Production/cloud/online version.

### Gate 4

Local is acceptable if connection is problematic.

Therefore maintain both:

```text
production deployment
local reproducible environment
```

Both should correspond to known Git commits.

---

# 24. Git discipline

Before final delivery:

- clean working tree;
- meaningful commits;
- no secrets;
- tagged release;
- deployment commit recorded;
- generated artifacts not confused with source;
- upstream reused code/license tracked.

Every team member should know how to return to the exam release tag.

---

# 25. Final report integrity checklist

Before PDF export:

- [ ] theoretical foundation uses real references;
- [ ] CASE connected to implementation;
- [ ] CBSD connected to actual reused components;
- [ ] architecture connected to change/maintainability;
- [ ] UML 2.5+ class-diagram scope clear;
- [ ] OMT/object-relational transformation explained;
- [ ] AI development use documented honestly;
- [ ] embedded AI architecture documented;
- [ ] Spring/JPA/PostgreSQL explained;
- [ ] PUD record reflects actual work;
- [ ] contextual learning agent documented;
- [ ] diagrams match software;
- [ ] traceability table updated;
- [ ] screenshots are current;
- [ ] annexes contain real evidence;
- [ ] bibliography complete;
- [ ] navigable TOC works;
- [ ] final PDF reopened and checked.

---

# 26. Exam operational checklist

Based on the supplied transcript:

- [ ] PDF uploaded before 08:00;
- [ ] upload verified;
- [ ] two printed cover pages;
- [ ] arrive before stated door-closing time;
- [ ] production URL works;
- [ ] local fallback works;
- [ ] Git synchronized;
- [ ] Java/Maven available;
- [ ] PostgreSQL available;
- [ ] XMI/EA fixture available;
- [ ] collaboration can be demonstrated;
- [ ] generated backend compiles;
- [ ] mobile client preparation available;
- [ ] every member ready for oral questions/live code.

Reconfirm exact exam logistics if the professor publishes newer instructions.

---

# 27. Final documentation principle

> Never document an aspirational feature as completed.  
> Never leave a completed architecture decision undocumented.  
> The report, software, tests and defense must describe the same system.
