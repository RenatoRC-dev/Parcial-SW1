# 01 — Requirements, Scope and Exam Baseline

> **Status:** Final consolidated requirements baseline  
> **Primary sources:** `Pauta 1.txt`, `Pauta 2.txt`  
> **Rule:** This file distinguishes professor-explicit requirements from our implementation choices.

---

# 1. Problem definition

The assignment is not to build a conventional management information system.

The product is a software-engineering tool whose user is a software designer.

The professor narrowed the problem in stages:

```text
Software lifecycle
    ↓ too broad
Design
    ↓ still too broad
Data design
    ↓
Conceptual model
    ↓
UML class diagram
```

Therefore the real assignment is:

> Build a CASE tool specialized in collaborative conceptual data design through UML class diagrams,
> then use that model as the basis for interoperability and backend generation.

---

# 2. Business / academic objective

## 2.1 Objective

Provide software designers with a collaborative modeling environment that improves productivity by
combining:

- standard UML class modeling;
- real-time collaboration;
- AI-assisted editing;
- voice-based editing;
- image/photo reconstruction of a supplied diagram;
- Enterprise Architect interoperability;
- deterministic generation of a complete Spring Boot backend;
- PostgreSQL persistence derived through object-relational mapping.

## 2.2 Value

The tool creates value by reducing:

- duplicated modeling work;
- manual translation from model to backend;
- collaboration friction;
- tool-switching cost;
- model/code drift;
- repetitive CRUD structure;
- time needed to obtain an executable backend.

The professor repeatedly frames productivity as a central CASE-tool purpose.

---

# 3. Product category

`P-EXPLICIT`

The professor frames the application as a CASE tool and, in the lecture context, places it in the
space of fifth-generation CASE-style tools because its end user is the software engineer and its
purpose is software-engineering productivity.

For the project documentation, this should be presented as the professor's conceptual framing and
supported with proper academic references in the theoretical foundation.

---

# 4. Primary actor

## 4.1 Software Designer

Formal actor name:

**Software Designer**

Responsibilities:

- create the conceptual UML class model;
- edit classes, attributes and relationships;
- decide intended domain semantics;
- collaborate with other designers;
- review AI-generated changes;
- confirm ambiguous image reconstruction;
- validate the model;
- import/export through Enterprise Architect;
- request backend generation;
- review generation issues.

Two simultaneous collaborators are two instances of the same actor, not automatically two business
roles.

## 4.2 AI is not a business actor

The AI assistant is internal system functionality.

It may be shown as an external technical service in an integration diagram if a hosted AI provider
is used, but it is not the business owner of the modeling goal.

## 4.3 Enterprise Architect

Enterprise Architect is an external system for interoperability.

The designer remains the initiating actor for import/export use cases.

---

# 5. Explicit functional scope

## 5.1 Manual UML class modeling

`P-EXPLICIT`

The user must be able to model through a conventional graphical interface.

Required class-model concepts for the project core:

- classes;
- class names;
- attributes;
- attribute types;
- relationships/associations;
- multiplicities/cardinalities;
- relationship roles where needed;
- selected UML relationship semantics needed by the supported subset.

The professor requires UML 2.5 or later as the reference standard for the class-diagram notation
discussed and used in the project.

Important interpretation:

> Conformance to the supported UML subset is required. We must not falsely claim that our tool
> implements every UML 2.5 diagram or construct.

## 5.2 Collaborative editing

`P-EXPLICIT`

Multiple designers must work over the same modeling artifact.

The professor describes the intended experience as a shared virtual whiteboard.

The implementation must address collaboration concerns such as:

- synchronization;
- concurrent changes;
- shared state;
- presence/awareness;
- conflict/convergence behavior;
- rendering consistency.

The professor mentions concepts ranging from mutual exclusion to synchronization. Our implementation
does not have to force lock-based mutual exclusion if a CRDT convergence approach provides a better
fit; it must nevertheless demonstrate a correct collaborative model.

## 5.3 AI-assisted editing

`P-EXPLICIT`

The CASE application itself must contain AI functionality.

Expected interactions include:

```text
Create a class.
Move a class.
Rename a class.
Delete a class.
Add an attribute.
Modify an attribute.
Create a relationship.
Set multiplicity/cardinality.
```

The professor explicitly rejects the idea that the primary AI behavior is:

```text
"Here is the whole business problem; design the entire diagram for me."
```

The human designer remains the model author.

## 5.4 Voice editing

`P-EXPLICIT`

The designer should be able to perform modeling actions through voice.

Professional interpretation:

```text
Voice
 ↓
Speech-to-text
 ↓
AI intent / structured command
 ↓
Schema validation
 ↓
Domain validation
 ↓
Model operation
```

Voice is an input adapter, not a second implementation of business rules.

## 5.5 Photo/image input

`P-EXPLICIT`

The professor states an exam scenario in which the team may be asked to take a photo of the supplied
class model and put the image into the tool.

Required interpretation:

```text
Existing diagram image
 ↓
Model reconstruction
 ↓
Editable structured UML
```

It is not enough to display the image as a background.

Because visual interpretation can be uncertain, our project decision is:

```text
Image
 ↓
CandidateUMLModel
 ↓
validation
 ↓
human review
 ↓
commit to live model
```

## 5.6 Enterprise Architect import/export

`P-EXPLICIT`

The CASE tool must interoperate specifically with Enterprise Architect.

The professor identifies XMI as the usual exchange mechanism.

Required user goals:

- import an Enterprise Architect class model into our tool;
- export our class model for use in Enterprise Architect.

Do not claim complete interoperability until tested with real Enterprise Architect.

## 5.7 Backend generation

`P-EXPLICIT`

When the designer finishes the model, the tool must generate the **complete backend**.

Generated backend requirement:

```text
100% Spring Boot
```

Minimum layers:

```text
Model / Entity
Repository
Service
Controller
```

Optional fifth layer:

```text
DTO
```

DTO is justified when it prevents unnecessary or inappropriate network data exposure.

## 5.8 PostgreSQL

`P-EXPLICIT`

Generated persistence target:

```text
PostgreSQL
```

The class model is object-oriented while PostgreSQL is relational.

Therefore the tool must implement a set of object-oriented → relational mapping rules.

The professor explicitly points students toward Rumbaugh/OMT/TMO material as theoretical support for
the mapping problem.

## 5.9 ORM-generated schema

`P-EXPLICIT` / `DERIVED`

The generated Spring backend should create/use the database through the generated model/persistence
layer and ORM behavior.

Expected technologies:

- JPA;
- Hibernate;
- PostgreSQL.

A manually authored SQL script is not the primary generation mechanism.

---

# 6. Important AI distinction: editing versus reconstruction

There are two allowed behaviors that must not be confused.

### Editing assistant

```text
"Add an attribute to Customer."
```

The AI modifies a designer-owned model incrementally.

### Image reconstruction

```text
Photo of an existing professor-provided diagram
```

The AI/vision subsystem reconstructs that already-defined diagram.

### Not the primary design goal

```text
"Design a complete sales system from these requirements."
```

The professor explicitly rejects replacing the designer with autonomous full-domain design.

---

# 7. Exam-domain constraint

`P-EXPLICIT`

Professor examples will be management/business software rather than highly specialized systems such
as games or word processors.

Examples mentioned include:

- sales;
- purchases;
- accounting;
- fixed assets;
- budgets;
- banks;
- schools;
- veterinary systems;
- barber systems;
- restaurants;
- dental/clinical scenarios.

This matters for testing.

Our fixtures should resemble ordinary management information systems.

---

# 8. Separate Flutter exam application

## 8.1 Purpose

`P-EXPLICIT`

The generated backend must be credible as an executable backend.

The professor considers a real client stronger proof than relying only on Postman or Swagger.

During the exam scenario, the team will build a small mobile frontend that consumes the generated
backend.

## 8.2 Technology

`P-EXPLICIT`

```text
Flutter
```

## 8.3 Interaction style

`P-EXPLICIT`

The mobile client should demonstrate AI-assisted interaction.

The professor describes a voice-first assistant-style UX as the preferred direction.

Traditional forms/buttons may exist as a fallback, especially when voice is inconvenient or noisy.

## 8.4 Offline requirement

`P-EXPLICIT`

The mobile application must be prepared to work without internet.

While offline:

- AI must remain available locally on the phone;
- local actions/data must remain usable;
- changes must synchronize after connectivity returns.

## 8.5 Boundary clarification

`P-EXPLICIT`

The professor explicitly clarifies:

> Local/offline AI is for the mobile application, not for the CASE diagram editor.

This boundary must be preserved in architecture and documentation.

---

# 9. Documentation requirements

The supplied evaluation transcript defines the documentation as Gate 1.

## 9.1 Delivery deadline

`P-EXPLICIT`

The PDF must be uploaded by:

```text
08:00 AM on exam day
```

After that time, the professor states it does not count for the exam gate.

## 9.2 Formatting

`P-EXPLICIT`

The professor expects a professional technical document including:

- typography;
- spacing;
- margins;
- table of contents;
- fully navigable index;
- annexes;
- a formal reference style such as APA as a useful reference.

## 9.3 Mandatory documentation block A — Theoretical Foundation

Required core themes include:

### CASE / Computer-Aided Software Engineering

Focus:

- CASE purpose;
- software-engineer productivity;
- modeling rather than merely drawing;
- relationship to the project.

### Component-Based Software Development

Focus:

- reuse;
- component interfaces/contracts;
- assembling instead of rebuilding everything;
- producing reusable components as well as consuming them.

This directly justifies Apollon/crunch_uml reuse and our own adapter/component boundaries.

### Software Architecture

Professor's key framing:

> The purpose of architecture is to help software live longer by making change less expensive.

Project connection:

- collaboration;
- synchronization;
- adapters;
- replaceable external components;
- maintainability.

### UML class diagrams

Focus:

- UML 2.5+;
- Booch, Rumbaugh, Jacobson;
- class-diagram semantics;
- OMG as standards reference;
- why incorrect source models produce incorrect generated systems.

### Object → relational mapping

Focus:

- class model is object-oriented;
- PostgreSQL is relational;
- transformation rules are required;
- Rumbaugh/OMT/TMO is a professor-indicated reference direction.

### AI in Software Development

Two distinct uses must be documented:

1. AI used by the team to accelerate development.
2. AI embedded into the product for the product user.

The professor encourages more mature approaches than ad-hoc prompting, including:

- specification-driven development;
- agents;
- structured AI workflows.

### Spring Boot

Must be understood deeply because generated code is Spring Boot.

### Supporting theory

Project-derived supporting topics should include where actually implemented:

- JPA/Hibernate;
- PostgreSQL;
- XMI and tool interoperability;
- collaborative/real-time systems;
- CRDT/Yjs where used;
- code generation / model-driven development;
- quality assurance/testing.

Rule:

> Theory must be reflected in the implementation. It must not be filler.

## 9.4 Mandatory documentation block B — Software Development Process Record

`P-EXPLICIT`

Use:

```text
PUD — Proceso Unificado de Desarrollo de Software / Unified Process
```

The professor instructs students to follow the process as defined, rather than inventing their own
methodology after the fact.

The record must document the real development process and evidence.

## 9.5 Mandatory documentation block C — User-learning mechanism

`P-EXPLICIT`

The tool must include a mechanism that helps the user learn the application.

The professor favors:

> A contextual agent that observes the user's current state and guides the user step by step.

This is preferable to relying only on:

- a large static manual;
- a long tutorial video;
- disconnected help pages.

---

# 10. Evaluation gates

The professor describes 100 total points but makes the four steps sequential.

## Gate 1 — Documentation

Must pass to continue.

Evidence:

- uploaded PDF before deadline;
- required content;
- proper formatting.

## Gate 2 — Software as a Product

The tool must be:

- finished;
- tested;
- reliable;
- deployable/available;
- demonstrably high quality.

The professor emphasizes proof rather than verbal claims.

## Gate 3 — Documentation vs Software Contrast

Everything important documented must exist in software.

Everything important implemented must be represented in the documentation.

This creates a hard traceability requirement.

## Gate 4 — Individual Defense / Authorship

The professor may:

- select code and ask what happens;
- delete code and ask the student to rewrite it;
- request a live modification;
- question theoretical foundations;
- challenge architecture decisions.

Passing all four gates is required to reach the professor's stated minimum passing threshold.

---

# 11. Exam-day operational requirements

The second transcript also records:

- approximately **15:15** as the stated door-closing time for the in-person phase;
- the team should bring **two printed cover pages** from the submitted document;
- software used in product/contrast stages should be available **in production, in the cloud, online**;
- local execution may be used in the individual-defense stage if network conditions are problematic;
- GitHub/deployment synchronization is expected to be under control.

Treat exact schedule details as professor-explicit for the supplied transcript, but reconfirm if the
professor later changes the timetable.

---

# 12. Use-case baseline

## UC01 — Create/Open Modeling Project

**Actor:** Software Designer  
**Goal:** obtain a structured workspace for the UML class model.  
**Result:** project/model id exists and the diagram can be edited.

Acceptance baseline:

```text
Given no active model
When the designer creates a project
Then a class-diagram workspace is initialized and can be persisted
```

## UC02 — Model UML Class Diagram Manually

**Actor:** Software Designer

Operations:

- create;
- rename;
- move;
- delete class;
- add/edit/delete attributes;
- assign attribute types;
- create/edit/delete relations;
- set multiplicities;
- set roles where supported.

Acceptance baseline:

```text
Given an open model
When the designer edits supported UML elements
Then structured model state changes and the canvas reflects the same semantics
```

## UC03 — Edit Model Collaboratively

**Actor:** Software Designer

Acceptance baseline:

```text
Given two designers in the same project
When either edits the model
Then the other receives the change and both clients converge to equivalent model state
```

## UC04 — Edit Model with AI/Text/Voice

**Actor:** Software Designer

Acceptance baseline:

```text
Given a valid model
When the designer gives a supported text or voice command
Then the system produces a validated constrained operation and applies only the intended change
```

## UC05 — Reconstruct Existing Model from Image

**Actor:** Software Designer

Acceptance baseline:

```text
Given an image of a UML class diagram
When the designer submits the image
Then the system creates a structured candidate model, exposes ambiguities, and requires confirmation before commit
```

## UC06 — Import from Enterprise Architect

Acceptance baseline:

```text
Given a supported EA-exported XMI file
When the designer imports it
Then supported classes/attributes/relations/multiplicities are represented as editable UML
```

## UC07 — Export to Enterprise Architect

Acceptance baseline:

```text
Given a valid supported UML model
When the designer exports XMI
Then Enterprise Architect can import the result without losing required supported semantics
```

Real EA import is required before marking this acceptance criterion complete.

## UC08 — Validate UML Model

Acceptance baseline:

```text
Given a model
When validation runs
Then blocking errors and warnings reference the affected semantic elements
```

## UC09 — Generate Spring Boot Backend

Acceptance baseline:

```text
Given a valid supported model
When generation is requested
Then a complete Spring Boot project is produced using the fixed generation profile
```

## UC10 — Download/Obtain Generated Project

Acceptance baseline:

```text
Given a successful generation
When the designer requests the artifact
Then the system provides a complete project package and generation report
```

## UC11 — Save/Recover Modeling Work

Acceptance baseline:

```text
Given persisted work
When the designer returns/reconnects
Then the model can be restored without semantic loss
```

## UC12 — Receive Contextual Guidance

Acceptance baseline:

```text
Given the current modeling state
When the designer asks for help or reaches a blocked stage
Then the assistant explains the next relevant action based on actual model state
```

---

# 13. Requirements that are internal rules, not separate use cases

Do not create actor-level use cases for:

- generate repository;
- create foreign key;
- map multiplicity;
- generate controller;
- render EJS template;
- sync Yjs update.

These are internal steps of higher-level user goals.

---

# 14. Core business rules

| ID | Rule |
|---|---|
| BR-01 | The designer owns domain semantics; AI assists rather than replaces the designer. |
| BR-02 | All non-GUI automation operates on structured model semantics. |
| BR-03 | Stable internal ids are required for classes, attributes and relations. |
| BR-04 | Blocking validation errors prevent backend generation. |
| BR-05 | Multiplicity is semantic and affects persistence mapping. |
| BR-06 | The same valid model must produce semantically equivalent generated backend code. |
| BR-07 | Image reconstruction is provisional until confirmed. |
| BR-08 | Enterprise Architect compatibility is limited to the explicitly supported subset. |
| BR-09 | Generated backend target is Spring Boot only. |
| BR-10 | Generated database target is PostgreSQL only. |
| BR-11 | The CASE implementation stack is independent from the generated backend stack. |
| BR-12 | External components must be isolated behind controlled interfaces where practical. |
| BR-13 | Unsupported UML constructs must be rejected/warned explicitly, never silently flattened. |
| BR-14 | The Flutter client's offline/local-AI concerns remain separate from the CASE editor. |

---

# 15. Non-functional requirements

## Reliability

- persisted models must recover correctly;
- generation must fail explicitly rather than create partially trusted output;
- collaboration must converge in tested scenarios.

## Maintainability

- adapters isolate third-party dependencies;
- generator logic remains outside templates where possible;
- external packages are version-pinned before exam hardening.

## Interoperability

- semantic XMI exchange with Enterprise Architect;
- real round-trip proof for supported subset.

## Usability

- conventional GUI remains available;
- AI editing is constrained and predictable;
- major AI/image changes use preview/confirmation;
- contextual guidance helps new users.

## Testability

- canonical mapping;
- AI commands;
- XMI;
- generation;
- collaboration;
- generated backend;
- offline mobile behavior must have explicit tests/evidence.

## Security/robustness

- uploaded files have size/type limits;
- filenames/paths are sanitized;
- AI cannot execute arbitrary shell code;
- generated identifiers are validated;
- provider secrets must not be hard-coded into client bundles or generated source.

## Deployability

- production/cloud version for product evaluation;
- local fallback for defense/emergency;
- source/deployment synchronization controlled through Git.

---

# 16. Explicit out-of-scope boundaries

Unless the professor changes the assignment, do not expand into:

- full software lifecycle CASE;
- all design disciplines;
- all UML diagram types;
- arbitrary ER modeling as a second modeling paradigm;
- multiple generated backend languages;
- multiple generated databases;
- microservice generation;
- code-first reverse engineering;
- full low-code platform;
- full JHipster feature set;
- OpenFlowKit as a second canvas;
- OpenFlow DSL as our UML canonical representation;
- JDL as our canonical representation;
- autonomous business-problem → complete-diagram design as the principal AI behavior.

---

# 17. Current requirement uncertainties

The following remain `PENDING`:

1. exact Enterprise Architect version/export configuration used in the exam;
2. exact XMI subset that survives real round-trip;
3. whether professor examples will include UML generalization/inheritance;
4. whether image reconstruction must work offline;
5. exact on-device model/runtime for the Flutter offline AI;
6. official final exam date/time if later changed from the transcript context.

These uncertainties require validation, not assumptions.
