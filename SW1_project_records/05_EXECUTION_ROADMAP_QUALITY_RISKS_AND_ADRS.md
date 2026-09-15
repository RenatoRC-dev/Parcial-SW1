# 05 — Execution Roadmap, Quality, Risks and Architecture Decisions

> **Status:** Active delivery plan  
> **Current strategic state:** repository research complete; implementation/proof phase should now dominate.

---

# 1. Delivery strategy

The project should be built as a sequence of **vertical proofs**, not as a set of disconnected
screens.

The first priority is to prove that the architecture works end to end.

Golden progression:

```text
UML class
 ↓
canonical semantics
 ↓
generation IR
 ↓
Spring files
 ↓
compile
 ↓
PostgreSQL
 ↓
REST
```

Then add:

```text
relationships
collaboration
AI
voice
image
XMI
guidance
mobile/offline proof
```

Some of these can proceed in parallel, but no team should spend final days polishing UI while XMI or
generation remains unproven.

---

# 2. Mandatory versus enhancement scope

All professor-explicit features are mandatory targets.

Use priority to sequence work, not to pretend a professor requirement is optional.

## Mandatory/core

- manual UML class modeling;
- collaboration;
- AI editing;
- voice editing;
- photo/image reconstruction;
- Enterprise Architect import/export;
- validation;
- Spring Boot generation;
- PostgreSQL/JPA;
- production deployment;
- documentation traceability;
- contextual learning mechanism;
- Flutter exam-client preparation;
- mobile local-AI/offline synchronization proof.

## Enhancements only after core stability

- sophisticated history comparison;
- rich UML features outside data-design needs;
- DTO-by-default;
- Docker generation;
- advanced code preview;
- multiple AI providers in UI;
- extra XMI formats;
- `.qea` direct import;
- inheritance generation;
- composition cascade semantics.

---

# 3. Phase 0 — Freeze supported semantics

Deliverables:

- canonical schema;
- supported UML subset;
- supported attribute types;
- allowed multiplicities;
- primary-key convention;
- relationship ownership convention;
- unsupported-feature behavior;
- use-case baseline.

Exit criterion:

> Team can explain exactly what is supported and what is rejected.

---

# 4. Phase 1 — Create our product shell

Tasks:

- create `sw1-case-tool`;
- React/TypeScript frontend;
- Node/TypeScript backend;
- embed Apollon;
- subscribe to model changes;
- save/load one model;
- preserve original upstream clones.

Exit criterion:

> A class created in our application is visible as structured editor state.

---

# 5. Phase 2 — Canonical adapter

Tasks:

- implement `CanonicalUMLModel`;
- Apollon → canonical;
- canonical → Apollon;
- stable id rules;
- geometry mapping;
- round-trip tests.

Fixture:

```text
Customer
Order
Customer 1 ---- 0..* Order
```

Exit criterion:

> Supported semantics survive Apollon → canonical → Apollon.

---

# 6. Phase 3 — Validation

Tasks:

- structural validator;
- UML validator;
- generation validator;
- issue model;
- UI error/warning display.

Exit criterion:

> Invalid semantics cannot silently reach code generation.

---

# 7. Phase 4 — First Spring vertical slice

Input:

```text
Customer
- name: String
- email: String
```

Generate:

```text
Customer.java
CustomerRepository.java
CustomerService.java
CustomerServiceImpl.java
CustomerController.java
GeneratedApplication.java
pom.xml
application.yml
```

Then:

```text
mvn test/package
```

Exit criterion:

> Clean generated project compiles.

This milestone is more valuable than adding ten new UI features.

---

# 8. Phase 5 — PostgreSQL vertical slice

Tasks:

- start PostgreSQL;
- generated application starts;
- schema is created;
- POST Customer;
- GET Customer.

Exit criterion:

> Generated entity works against real PostgreSQL.

---

# 9. Phase 6 — Relationship slices

Order:

1. one-to-many / many-to-one;
2. one-to-one;
3. many-to-many;
4. enum;
5. optional inheritance only if core is stable.

Each slice must:

- map canonical relation;
- generate annotations;
- compile;
- start;
- persist data;
- serialize REST correctly.

---

# 10. Phase 7 — Enterprise Architect real spike

This is mandatory before declaring XMI complete.

Fixture:

```text
Customer 1 ---- 0..* Order
```

Flow:

```text
EA → XMI → crunch_uml → canonical → crunch_uml → XMI → EA
```

Save:

- original XMI;
- generated XMI;
- screenshots;
- warnings;
- exact EA version/export option;
- test notes.

Exit criterion:

> EA imports our exported XMI with required semantics intact.

---

# 11. Phase 8 — Collaboration proof

Use two real sessions.

Scenario:

```text
A creates Customer.
B sees Customer.
B adds email.
A sees email.
A changes multiplicity.
B sees multiplicity.
Both serialize equivalent model state.
```

Also test reconnect.

Exit criterion:

> Collaboration is demonstrated, not assumed because Yjs exists upstream.

---

# 12. Phase 9 — AI text commands

Implement:

- provider gateway;
- command schema;
- current-model context;
- selection/focus context;
- validator;
- one repair attempt;
- preview policy;
- executor.

Scenario:

```text
"Add email:String to Customer."
```

Exit criterion:

- only Customer changes;
- ids remain stable;
- unrelated classes unchanged;
- collaborator sees resulting change.

---

# 13. Phase 10 — Voice

Add speech-to-text before the same AI command interpreter.

Test:

```text
typed command result == spoken command semantic result
```

Exit criterion:

> Voice is a first-class input path without duplicate model logic.

---

# 14. Phase 11 — Image/photo

Implement:

- upload;
- multimodal AI adapter;
- candidate schema;
- confidence/ambiguity;
- preview;
- confirm/apply.

Test using a professor-like photographed class diagram.

Exit criterion:

> Photo becomes editable structured UML, not a static background image.

---

# 15. Phase 12 — Contextual learning agent

Implement minimum useful behaviors:

- explain current validation error;
- tell user next step;
- focus affected element;
- explain generation readiness;
- explain supported command.

Exit criterion:

> New user can complete a basic model→generate flow with contextual guidance.

---

# 16. Phase 13 — Flutter/offline proof

Prepare reusable Flutter client scaffold before exam.

Need to prove:

- generated backend contract is easy to consume;
- local AI can run on target phone/emulator;
- one offline operation can be recorded;
- queued change synchronizes after reconnection.

Do not wait until exam day to discover model/runtime incompatibility.

---

# 17. Phase 14 — Production hardening

- cloud deploy;
- WebSocket/collaboration test in production;
- XMI bridge in production;
- generator compile environment;
- environment variables;
- logs;
- local fallback;
- pinned versions;
- Git/deploy synchronization;
- seeded demonstration fixtures;
- final documentation contrast.

---

# 18. Technical spikes

| Spike | Question | Pass condition |
|---|---|---|
| S01 Apollon embed | Can our app host and read the editor? | structured model observed |
| S02 Canonical round-trip | Does mapping lose semantics? | supported fixture equal |
| S03 Collaboration | Does shared state converge? | two-client test passes |
| S04 EA round-trip | Does real EA accept our output? | import succeeds |
| S05 Spring compile | Does generated code compile? | Maven exit 0 |
| S06 PostgreSQL | Does generated persistence work? | CRUD + relation persistence |
| S07 AI safety | Can invalid AI output be contained? | reject/repair works |
| S08 Image reconstruction | Can image become structured model? | candidate + confirm works |
| S09 Mobile local AI | Can required inference run offline? | device test passes |
| S10 Sync recovery | Can offline updates sync? | pending queue clears correctly |

---

# 19. Test strategy

## 19.1 Unit tests

Target:

- type normalization;
- multiplicity parser;
- naming strategy;
- command validation;
- relationship ownership;
- canonical conversion;
- generation mapping.

## 19.2 Golden model fixtures

Maintain:

```text
single-class
one-to-many
one-to-one
many-to-many
enum
invalid-dangling-relation
invalid-type
name-collision
```

## 19.3 Generated-project compile tests

For each generation family:

```text
generate
 ↓
mvn test/package
 ↓
must succeed
```

## 19.4 PostgreSQL integration tests

At least:

- create entity;
- list entity;
- retrieve entity;
- update entity;
- delete entity;
- persist 1:N relation;
- persist N:M relation if supported.

## 19.5 XMI tests

- import fixture;
- export fixture;
- internal round-trip;
- real EA round-trip.

## 19.6 Collaboration E2E

Two clients.

Check:

- propagation;
- convergence;
- reconnect;
- AI-originated change;
- manual change.

## 19.7 AI tests

- supported command;
- unknown class;
- ambiguous name;
- invalid multiplicity;
- broad destructive command preview;
- invalid first output repaired once;
- failed repair rejected.

## 19.8 Image tests

- clear image;
- blurred image;
- ambiguous multiplicity;
- missing type;
- partial diagram.

The correct behavior on uncertainty is to ask/review, not hallucinate.

---

# 20. Product quality evidence

For Gate 2, collect evidence rather than saying "it works."

Evidence:

- test reports;
- build logs;
- generated Maven success;
- PostgreSQL screenshots/logs;
- two-client collaboration video/screenshots;
- XMI import/export proof;
- deployment health;
- error-handling cases;
- generation report;
- Git commit/tag;
- known limitations.

---

# 21. Definition of Done

## Manual modeling

Done when:

- supported class elements work;
- model persists;
- canonical mapping passes.

## Collaboration

Done when:

- two sessions converge;
- reconnect works;
- remote updates are visible.

## AI

Done when:

- command contract is strict;
- validation works;
- repair is bounded;
- unrelated model state is preserved.

## Voice

Done when:

- speech command reaches same semantic pipeline;
- ambiguity does not mutate model.

## Image

Done when:

- candidate model is structured;
- preview exists;
- ambiguities are explicit.

## XMI

Done when:

- EA import and export both work in real EA.

## Generator

Done when:

- expected layers exist;
- project compiles;
- application starts;
- PostgreSQL works;
- REST behavior is correct.

## Documentation

Done when:

- each important claim points to actual evidence;
- software and document agree.

## Defense

Done when:

- each team member can explain architecture;
- each can trace an edit through subsystems;
- each can modify their owned code.

---

# 22. Risk register

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---:|---:|---|
| R01 | EA rejects generated XMI | Medium | Critical | real round-trip early |
| R02 | canonical mapping loses multiplicity/roles | Medium | Critical | round-trip fixtures |
| R03 | AI edits wrong element | Medium/High | High | stable ids + selection context + preview |
| R04 | AI returns invalid command | High | Medium | schema/domain validation + one repair |
| R05 | image misreads multiplicity | High | High | candidate review + ambiguity |
| R06 | collaboration loops between canonical/editor state | Medium | High | one live editor state + adapter boundary |
| R07 | generated code does not compile | Medium | Critical | compile fixtures on every mapping change |
| R08 | generated JPA relation is semantically wrong | Medium | Critical | relation integration tests |
| R09 | REST serialization recurses | High | High | Jackson/DTO policy + tests |
| R10 | inheritance consumes deadline | Medium | Medium | block/defer unless core stable |
| R11 | Python XMI bridge complicates deployment | Medium | High | freeze bridge contract; CLI first, service fallback |
| R12 | Apollon internal API changes | Low/Medium | High | pin version, adapter |
| R13 | mobile model cannot run on target device | Medium/High | Critical | early device spike |
| R14 | offline sync conflicts | Medium | High | small queue model + deterministic sync policy |
| R15 | documentation drifts from software | High | Critical | traceability matrix updated each iteration |
| R16 | team cannot defend reused code | Medium | Critical | walkthroughs + ownership |
| R17 | production environment fails exam day | Medium | Critical | cloud + local fallback |
| R18 | scope expands into full UML/low-code | High | Critical | supported-subset freeze |
| R19 | dependency upgrades break stable build | Medium | High | version freeze |
| R20 | credentials/security leak | Low/Medium | High | env vars, secrets scan, no client hardcoding |

---

# 23. Architecture Decision Records

## ADR-001 — Scope is conceptual data design, not full lifecycle

**Status:** Accepted  
**Source:** professor requirement

## ADR-002 — UML class diagram is the modeling notation

**Status:** Accepted  
**Source:** professor requirement

## ADR-003 — Apollon is the UML editor/collaboration foundation

**Status:** Accepted  
**Reason:** strongest verified reuse fit.

## ADR-004 — Our project repository is separate from pristine upstream clones

**Status:** Accepted

## ADR-005 — Prefer Apollon public/controlled integration before deep fork

**Status:** Accepted  
**Fallback:** minimal vendor/fork only if a required capability is inaccessible.

## ADR-006 — Canonical UML semantics are the subsystem contract

**Status:** Accepted

## ADR-007 — There will not be two independently writable semantic stores

**Status:** Accepted

## ADR-008 — Automated edits use `ModelCommand`

**Status:** Accepted

## ADR-009 — AI does not directly generate final Java

**Status:** Accepted

## ADR-010 — AI output is validated and gets at most a bounded repair loop

**Status:** Accepted

## ADR-011 — Large/destructive/image changes use preview-before-apply

**Status:** Accepted

## ADR-012 — Voice reuses the text-command path

**Status:** Accepted

## ADR-013 — Image produces `CandidateUMLModel`, not direct live-state writes

**Status:** Accepted

## ADR-014 — crunch_uml is isolated behind `XmiAdapter`

**Status:** Accepted

## ADR-015 — Do not rewrite crunch_uml in TypeScript

**Status:** Accepted

## ADR-016 — Real EA round-trip is the acceptance gate for XMI

**Status:** Accepted

## ADR-017 — OpenFlowKit is a pattern donor, not a second runtime editor

**Status:** Accepted

## ADR-018 — OpenFlow DSL is not our UML canonical format

**Status:** Accepted

## ADR-019 — JHipster is a generation reference, not our primary runtime generator

**Status:** Accepted

## ADR-020 — JDL is not our generation IR

**Status:** Accepted

## ADR-021 — Use a Spring-specific generation IR

**Status:** Accepted

## ADR-022 — Use deterministic EJS templates

**Status:** Accepted

## ADR-023 — Fixed generated backend profile

**Status:** Accepted

Profile:

```text
Java 21 + Maven + Spring Boot + Spring MVC + JPA + Validation + PostgreSQL
```

## ADR-024 — One generated id per entity in P0

**Status:** Accepted

## ADR-025 — Composite ids are deferred

**Status:** Accepted

## ADR-026 — Liquibase is deferred

**Status:** Accepted

## ADR-027 — Relationship ownership is decided before templates

**Status:** Accepted

## ADR-028 — Generated projects must compile in automated fixture tests

**Status:** Accepted

## ADR-029 — Flutter client remains separate from CASE editor

**Status:** Accepted

## ADR-030 — Local AI requirement belongs to Flutter/mobile

**Status:** Accepted  
**Source:** explicit professor clarification.

## ADR-031 — Repository-research phase is closed

**Status:** Accepted

New repository audits require a concrete blocker.

---

# 24. Stop conditions for scope

Stop adding features when:

- all mandatory requirements have a working path;
- EA round-trip passes;
- generator compiles;
- collaboration is stable;
- AI/voice/image paths work;
- mobile local-AI proof exists;
- documentation is traceable;
- team is defense-ready.

Do not add optional architecture while any of those remain red.

---

# 25. Immediate next actions

In order:

```text
1. Create/finalize our own project repository.
2. Integrate Apollon.
3. Freeze canonical schema.
4. Complete canonical adapter.
5. Generate one class into compiling Spring Boot.
6. Add PostgreSQL.
7. Add 1:N relation.
8. Execute real EA round-trip.
9. Prove collaboration.
10. Add AI commands.
11. Add voice.
12. Add image.
13. Add contextual agent.
14. Prove Flutter local AI + sync.
15. Harden cloud/local deployment.
16. Finish traceability and individual-defense rehearsal.
```

This is now an execution project, not a repository-research project.
