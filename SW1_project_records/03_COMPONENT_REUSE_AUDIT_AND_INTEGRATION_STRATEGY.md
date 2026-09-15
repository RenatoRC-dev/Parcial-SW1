# 03 — Component Reuse Audit and Integration Strategy

> **Status:** Final consolidated reuse decision  
> **Objective:** Explain exactly what each audited repository contributes, what it does not
> contribute, and how it fits without creating a Frankenstein architecture.

---

# 1. Component-Based Software Development strategy

The professor explicitly expects reuse.

The project should therefore demonstrate two CBSD responsibilities:

1. **Consume reusable components** instead of rebuilding mature infrastructure.
2. **Produce reusable components/interfaces** in our own work.

Our reusable components should include, at minimum:

```text
ApollonAdapter
CanonicalUMLModel
ModelCommand contract
UMLValidator
XmiAdapter
AIModelGateway
SpringModelMapper
SpringBootGenerator
ContextualAssistant
```

Each component should expose a narrow interface and hide implementation details.

---

# 2. Final repository role matrix

| Repository | Final role | Runtime dependency? | Decision |
|---|---|---:|---|
| Apollon | UML editor + collaboration foundation | Yes | Reuse |
| crunch_uml | Enterprise Architect/XMI engine behind our adapter | Likely yes | Isolated reuse |
| OpenFlowKit | AI interaction architecture reference | No by default | Adapt patterns only |
| JHipster Generator | Spring generation architecture reference | No | Adapt patterns only |

This is the final integration strategy.

---

# 3. Apollon

## 3.1 Why it was investigated

The project requires a collaborative UML class editor.

Building from zero would duplicate a mature problem:

- canvas;
- nodes/edges;
- UML rendering;
- class editing;
- multiplicities;
- selection;
- zoom/pan;
- collaboration;
- presence;
- model persistence patterns.

That would consume time without creating the unique value of the assignment.

## 3.2 Code-verified capabilities from the audit

The audit identified:

- React/TypeScript editor;
- embeddable `@tumaet/apollon` library;
- structured `UMLModel`;
- class diagrams;
- class nodes;
- class relationships;
- multiplicities;
- relationship roles;
- association;
- aggregation;
- composition;
- inheritance/generalization;
- realization;
- dependency;
- model-change subscriptions;
- Yjs collaboration;
- awareness/presence;
- live cursors;
- WebSocket support;
- standalone server;
- Redis/RedisJSON persistence patterns;
- version/history concepts;
- Vitest/Playwright and broader quality infrastructure;
- PNG/SVG/PDF rendering/export support.

## 3.3 Critical finding

Apollon exposes a structured model.

It is therefore a modeling component, not merely a screenshot canvas.

That makes it suitable for:

```text
GUI ↔ semantic adapter ↔ validation / AI / XMI / generator
```

## 3.4 What Apollon does not solve

Apollon does not provide our required:

- AI command layer;
- voice pipeline;
- image reconstruction;
- Enterprise Architect XMI bridge;
- persistence semantics for JPA;
- object→relational rules;
- Spring generator;
- Flutter exam client;
- contextual user-learning agent.

## 3.5 Integration decision

Preferred:

```text
our project
   ↓
pinned Apollon component
   ↓
ApollonAdapter
```

Do not expose Apollon-specific types throughout the application.

If collaboration/server functionality requires a deeper integration, vendor/fork only the minimum
necessary package while preserving the same adapter boundary.

## 3.6 Risks

- relying on internal/non-stable APIs;
- upgrading Apollon close to exam;
- losing semantics during canonical mapping;
- duplicating Apollon state in another store;
- over-importing standalone infrastructure.

Mitigations:

- pin version;
- mapping round-trip tests;
- one adapter;
- freeze dependency versions before hardening;
- keep pristine upstream clone.

## 3.7 Final verdict

**USE AT RUNTIME.**

---

# 4. crunch_uml

## 4.1 Why it was investigated

Enterprise Architect interoperability is deceptively difficult.

XMI exchange involves more than generic XML because EA may use:

- extension metadata;
- specific identifiers/GUID conventions;
- diagram layout;
- relationship roles;
- multiplicities;
- tagged values;
- tool-specific conventions.

Writing all of this from zero is high-risk.

## 4.2 Code-verified capabilities from the audit

The audit identified:

- Python package/CLI architecture;
- SQLAlchemy internal meta-model;
- `lxml` XML processing;
- strict XMI parser;
- Enterprise Architect XMI extension parser;
- XMI renderer;
- `.qea/.qeax` parser;
- classes;
- attributes;
- datatypes;
- enumerations;
- associations;
- generalizations;
- endpoint multiplicities;
- role names;
- package information;
- diagrams;
- node geometry;
- edge geometry;
- waypoints;
- hidden state;
- EA GUID conversion;
- documented EA quirks;
- substantial pytest suite;
- internal parse/render/parse round-trip tests.

## 4.3 Internal model

Important concepts observed:

```text
Package
Class
Attribute
Enumeration
EnumerationLiteral
Association
Generalization
Diagram
```

Association semantics include:

```text
source/target classes
source/target multiplicity start/end
source/target roles
```

This maps well into our canonical contract.

## 4.4 Critical limitation

crunch_uml's internal round-trip tests are not proof that our generated XMI will be accepted by the
real Sparx Enterprise Architect application in the exact exam environment.

Therefore:

```text
EA compatibility = PENDING
```

until a real round-trip passes.

## 4.5 Mandatory real spike

Use a small fixture:

```text
Customer
Order
Customer 1 ---- 0..* Order
```

Optionally add:

- role names;
- enum;
- generalization;
- simple geometry.

Then:

```text
EA
 ↓ export
XMI
 ↓
crunch_uml
 ↓
our canonical mapping
 ↓
crunch_uml render
 ↓
XMI
 ↓ import
EA
```

Verify:

- class names;
- attributes;
- types;
- associations;
- multiplicities;
- roles;
- generalization if included;
- layout where supported.

Save screenshots and both XMI files.

## 4.6 Integration boundary

Recommended contract:

```text
importXmi(file) → CanonicalModelCandidate + warnings
exportXmi(canonicalModel) → XMI + warnings
```

Implementation may use:

```text
Node → controlled Python subprocess → crunch_uml
```

Do not port the entire project to TypeScript.

## 4.7 What not to reuse

Ignore unless required:

- Dutch/GEMMA domain semantics;
- translation pipeline;
- RDF outputs;
- CSV/XLSX;
- broad metadata not needed by the professor;
- internal SQLAlchemy database as our product's canonical database.

## 4.8 Final verdict

**USE AS AN ISOLATED RUNTIME ADAPTER CANDIDATE, PENDING REAL EA PROOF.**

---

# 5. OpenFlowKit

## 5.1 Why it was investigated

Not to find another editor.

Questions:

- How does a mature diagram tool integrate AI?
- How does it handle local models?
- How are images passed to AI?
- How are malformed AI responses repaired?
- How are changes previewed before application?
- How is existing graph state preserved?

## 5.2 Code-verified useful patterns

The audit identified:

- common AI provider abstraction;
- hosted providers;
- custom OpenAI-compatible endpoints;
- Ollama through `http://localhost:11434/v1`;
- browser image attachment;
- provider-specific multimodal image packaging;
- streaming responses;
- current-graph context serialization;
- focused selected-node edits;
- stable-id preservation;
- deterministic DSL parser;
- parser-driven repair loop;
- bounded retry;
- preview/apply workflow;
- diff counts;
- position preservation;
- local-first browser persistence;
- Yjs/WebRTC collaboration;
- class-diagram plugin;
- Mermaid-style class relations/cardinalities;
- MCP tools/linter/sanitizer.

## 5.3 Most important finding

The main AI path generally asks the LLM to output a **complete updated OpenFlow DSL graph**.

That is acceptable for its product but is too broad for persistence-generating UML.

We should not copy:

```text
AI → regenerate complete UML text → replace model
```

for ordinary edits.

We should use:

```text
AI → atomic ModelCommand[] → validate → apply
```

## 5.4 AI repair pattern to adapt

OpenFlowKit's strongest pattern:

```text
AI output
 ↓
deterministic parser
 ├─ valid → continue
 └─ invalid
      ↓
 exact error + prior output
      ↓
 one controlled repair attempt
      ↓
 parser again
```

Our equivalent:

```text
ModelCommand[]
 ↓
schema validation
 ↓
UML domain validation
 ├─ valid
 └─ repair once with structured error
```

## 5.5 Preview pattern to adapt

Use preview when the operation is:

- destructive;
- broad;
- image-based;
- multi-element;
- ambiguous.

Small safe commands may apply directly with undo.

## 5.6 Image pattern to adapt

OpenFlowKit passes images to multimodal models rather than running a dedicated deterministic diagram
CV parser.

Our adaptation:

```text
Image
 ↓
vision model
 ↓
CandidateUMLModel
 ↓
validation
 ↓
ambiguity report
 ↓
human confirmation
```

## 5.7 Ollama lesson

The audit confirms a useful local OpenAI-compatible pattern.

But:

> Desktop/local Ollama does not prove Flutter/mobile local-AI feasibility.

Mobile local AI remains a separate spike.

## 5.8 Why OpenFlowKit is not our UML engine

Its generic OpenFlow DSL is built around generic graph nodes and does not losslessly preserve the
full class-specific semantics required for our generator.

Its class-diagram support is real, but creating a second UML model beside Apollon would increase
translation complexity.

## 5.9 Collaboration decision

Do not use OpenFlowKit's collaboration stack.

Reasons:

- Apollon already owns editor collaboration;
- duplicate Yjs models would create synchronization risk;
- OpenFlowKit describes its P2P collaboration path as evolving/beta in the audited context.

## 5.10 Final verdict

**REFERENCE / SELECTIVE PATTERN DONOR ONLY.**

---

# 6. JHipster Generator

## 6.1 Why it was investigated

The final large technical uncertainty was how to structure robust model-to-Spring generation.

We wanted to understand:

- parsing;
- semantic intermediate models;
- validation;
- entity preparation;
- field preparation;
- relationship preparation;
- ownership;
- type mapping;
- repository/service/controller generation;
- templates;
- generated-project testing.

## 6.2 Code-verified generation pipeline

The audited JHipster flow is broadly:

```text
JDL
 ↓
lexer/parser
 ↓
structured representation
 ↓
JDL domain model
 ↓
business validation
 ↓
JSON entity definitions
 ↓
entity preparation
 ↓
derived generation properties
 ↓
technology-specific mapping
 ↓
EJS templates
 ↓
Spring project
```

This strongly validates our decision to insert a Spring-specific generation IR between UML and
templates.

## 6.3 Key patterns to adapt

### Preparation passes

```text
prepareProject
prepareEntity
prepareField
prepareRelationship
preparePrimaryKey
preparePersistence
```

### Derived values before templates

Compute:

- Java class name;
- field name;
- table name;
- column name;
- Java type;
- primary key;
- relation type;
- owner side;
- join column;
- join table;
- imports.

Templates should not interpret raw UML.

### JPA relationship patterns

Observed support includes:

```text
@OneToOne
@OneToMany
@ManyToOne
@ManyToMany
@JoinColumn
@JoinTable
mappedBy
required/optional handling
```

### PostgreSQL knowledge

Observed:

- reserved-word handling;
- datasource templates;
- JDBC configuration;
- relational/JPA generation.

### Quality

JHipster has extensive tests around parsers, converters, preparation logic and generated code.

Our generator should therefore test both the transformation and the generated artifact.

## 6.4 Why not call JHipster directly

Rejected normal flow:

```text
UML → JDL → JHipster → Spring
```

Problems:

- unnecessary intermediate language;
- not all UML semantics map to JDL;
- large generated architecture;
- large dependency surface;
- harder debugging;
- weaker individual defense;
- harder control over exactly what professor expects.

## 6.5 Why not copy full JHipster

It solves far more than our problem:

- multiple clients;
- microservices;
- multiple DBs;
- authentication;
- caches;
- search engines;
- reactive stacks;
- migrations;
- multiple build tools;
- large deployment matrix.

That is precisely the overengineering we must avoid.

## 6.6 Patterns intentionally not adopted in P0

- full Yeoman lifecycle;
- blueprints;
- JDL source language;
- Liquibase;
- composite keys;
- multiple persistence engines;
- reactive Spring;
- auth generation;
- user management;
- cache/search;
- Gradle alternative.

## 6.7 Final verdict

**REFERENCE / SELECTIVE ALGORITHM AND TEMPLATE DONOR ONLY.**

---

# 7. Final component integration map

```text
                   ┌─────────────────────┐
                   │   OUR APPLICATION   │
                   └──────────┬──────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
         Apollon          crunch_uml       Our Generator
      runtime editor      XMI adapter      + EJS templates
      + collaboration       engine
             ▲
             │
      Our adapter layer
             ▲
             │
      Canonical UML semantics
             ▲
             │
    AI patterns inspired by
         OpenFlowKit

Generation architecture inspired by
         JHipster
```

OpenFlowKit and JHipster do not create additional runtime centers.

---

# 8. Component boundaries we own

## 8.1 ApollonAdapter

Responsibilities:

- `toCanonical()`;
- apply validated commands;
- load imported canonical model;
- subscribe to model changes;
- resolve editor ids/selection;
- preserve geometry.

## 8.2 XmiAdapter

Responsibilities:

- canonical ↔ bridge DTO;
- warnings;
- unsupported constructs;
- id mapping;
- multiplicity/role mapping;
- geometry mapping where required.

## 8.3 AIModelGateway

Responsibilities:

- provider abstraction;
- request context;
- structured output;
- image payload;
- retry;
- repair.

## 8.4 ModelCommandExecutor

Responsibilities:

- id resolution;
- domain validation;
- atomic mutation;
- change report;
- undo-compatible behavior where practical.

## 8.5 UMLValidator

Responsibilities:

- semantic correctness;
- supported-subset enforcement;
- generation readiness.

## 8.6 SpringModelMapper

Responsibilities:

- naming;
- types;
- primary keys;
- JPA cardinality;
- ownership;
- join names;
- generated REST naming.

## 8.7 SpringBootGenerator

Responsibilities:

- render;
- package;
- verify;
- report.

---

# 9. Reuse governance

Before taking source code from any repository:

1. verify its license;
2. record exact upstream commit/version;
3. preserve required notices;
4. isolate copied/adapted code;
5. document what was changed;
6. ensure every team member understands the reused section;
7. add tests around our adapter behavior.

General preference:

> Reuse through stable APIs before copying source.

---

# 10. Version-freeze policy

Before exam hardening:

- pin Apollon version/commit;
- pin crunch_uml version/commit;
- pin Node/package lock;
- pin Python requirements;
- pin Java;
- pin Maven wrapper if used;
- pin Spring Boot version;
- record AI provider/model used for product demo;
- record deployment commit.

Do not upgrade dependencies during final defense preparation without a blocking reason.

---

# 11. Final no-Frankenstein rule

Every external project must have exactly one reason to exist.

```text
Apollon → editor/collaboration
crunch_uml → EA/XMI
OpenFlowKit → learned AI patterns
JHipster → learned generator patterns
```

If a new repository duplicates one of these roles, reject it unless the current component fails a
specific mandatory requirement.
