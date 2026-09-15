# 02 — System Architecture and Integration Blueprint

> **Status:** Accepted target architecture  
> **Goal:** Integrate the audited components without creating a fragile multi-framework system.

---

# 1. Architecture drivers

The architecture is driven by six hard realities:

1. the professor requires collaborative editing;
2. UML semantics must survive manual, AI, image and XMI input;
3. Enterprise Architect uses a specialized interchange path;
4. backend generation must be deterministic;
5. the generated backend stack is fixed but the CASE implementation stack is not;
6. the project must survive change and remain understandable for individual defense.

The architecture must therefore optimize for:

- replaceability;
- explicit interfaces;
- testability;
- minimal duplicate state;
- deterministic transformations;
- fast implementation under deadline;
- traceability.

---

# 2. Architecture style

Recommended style:

> **Component-based modular application with explicit adapters and one semantic model contract.**

Do not create microservices merely because different languages/components are involved.

Runtime modules may be deployed together even when internally separated.

---

# 3. System context

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         SW1 CASE TOOL                                │
│                                                                      │
│  Software Designer                                                  │
│      │                                                               │
│      ├── Manual UML editing ───────► Apollon                         │
│      │                                                               │
│      ├── Text/Voice ───────────────► AI Command Adapter              │
│      │                                                               │
│      ├── Image/Photo ──────────────► Vision/Candidate Adapter        │
│      │                                                               │
│      └── EA XMI ───────────────────► XMI Adapter                     │
│                                                                      │
│                      all semantic paths                              │
│                              │                                       │
│                              ▼                                       │
│                    Canonical UML Contract                            │
│                              │                                       │
│             ┌────────────────┼────────────────┐                      │
│             ▼                ▼                ▼                      │
│        Validation       Collaboration     Generation                 │
│                             /storage           │                     │
│                                                ▼                     │
│                                       SpringProjectModel             │
│                                                │                     │
│                                                ▼                     │
│                                       Spring Boot project            │
└────────────────────────────────────────────────┼─────────────────────┘
                                                 ▼
                                            PostgreSQL
```

Enterprise Architect sits outside the tool:

```text
CASE Tool ⇄ XMI Adapter ⇄ crunch_uml ⇄ Enterprise Architect
```

The Flutter exam client is also outside the CASE editor:

```text
Flutter exam client ⇄ Generated Spring Boot API
```

---

# 4. Runtime components

## 4.1 Web application

Technology decision:

```text
React + TypeScript
```

Responsibilities:

- project/model workspace;
- Apollon hosting;
- validation UI;
- AI/voice/image UI;
- XMI import/export UI;
- generation UI;
- contextual guidance UI;
- collaboration presence;
- artifact download.

## 4.2 Apollon editor component

Role:

- visual UML class editing;
- structured editor model;
- relation rendering;
- multiplicity/role UI;
- collaborative editing foundation.

Integration rule:

> Only the editor adapter and collaboration integration layer should depend deeply on Apollon types.

## 4.3 CASE backend

Recommended technology:

```text
Node.js + TypeScript
```

Reason:

- aligns with Apollon ecosystem;
- straightforward web/AI/file integration;
- lets the generated Spring backend remain an output artifact rather than becoming our application backend.

Responsibilities:

- project persistence orchestration;
- XMI adapter orchestration;
- hosted AI provider gateway if used;
- generation service;
- artifact packaging;
- compile verification;
- security limits;
- product APIs.

## 4.4 Collaboration service

Use the Apollon/Yjs collaboration foundation rather than designing a competing protocol.

Responsibilities:

- shared model/session;
- remote updates;
- awareness/presence;
- reconnect behavior;
- persistence integration.

Do not add a second collaboration engine from OpenFlowKit.

## 4.5 XMI adapter

Recommended default:

```text
small Python bridge using crunch_uml
```

Interface remains ours.

The rest of the application must not know:

- crunch SQLAlchemy table names;
- Dutch/GEMMA-specific metadata;
- internal parser classes;
- EA implementation quirks.

Default deployment option:

```text
Node backend
  ↓ fixed subprocess invocation / controlled temp files / JSON
Python XMI bridge
  ↓
crunch_uml
```

If the final cloud platform cannot safely co-host the Python bridge, move the same contract behind a
small internal HTTP service. Do not redesign the domain contract.

## 4.6 AI provider gateway

The project should expose an abstraction such as:

```ts
interface AIModelGateway {
  interpretCommands(request: ModelAIRequest): Promise<ModelAIResult>;
  reconstructImage(request: ImageModelRequest): Promise<CandidateUMLModel>;
}
```

Hosted-provider calls may pass through Node to protect credentials and avoid CORS/provider
inconsistency.

Optional local provider support for the CASE tool is allowed but is not a professor requirement.

## 4.7 Generator

Our own module.

Responsibilities:

```text
Canonical UML
 ↓
generation validation
 ↓
Spring mapper
 ↓
SpringProjectModel
 ↓
EJS rendering
 ↓
compile check
 ↓
ZIP + generation report
```

JHipster is a reference, not a runtime dependency.

## 4.8 CASE persistence

Can reuse Apollon standalone patterns where appropriate.

Conceptually stores:

- project metadata;
- live/persisted diagram representation;
- model snapshots;
- collaboration state/history where supported.

Do not confuse this database with the generated application's PostgreSQL database.

---

# 5. The canonical-model decision, precisely defined

Earlier project notes often say:

> "The canonical model is the source of truth."

That remains correct semantically, but the implementation must avoid two independently writable
stores.

The final interpretation is:

> **Canonical UML semantics are the authoritative contract between subsystems. Apollon/Yjs may hold
> the live collaborative editor representation, but AI, XMI, validation and generation may not
> bypass the canonical semantic mapping.**

Therefore:

```text
Apollon model
   ↕ ApollonAdapter
CanonicalUMLModel
```

No independent feature should maintain a private competing class model.

### Consequence

- manual edits happen natively in Apollon;
- the adapter projects them into canonical semantics;
- automated mutations are expressed as `ModelCommand`;
- those commands are validated and applied through the adapter/editor integration;
- XMI import becomes canonical data and then is applied to the editor;
- generation consumes canonical data only.

This avoids forcing every manual mouse action through our own command bus while still preserving one
semantic boundary.

---

# 6. Canonical state versus geometry

The canonical contract may include geometry needed for:

- editor round-trip;
- XMI layout;
- image reconstruction;
- model persistence.

But geometry and semantics must remain conceptually separate.

```text
Semantic:
class name
attribute type
relationship kind
multiplicity
roles

Layout:
x/y
width/height
edge waypoints
z-order
```

Backend generation ignores geometry.

---

# 7. Integration flow — manual editing

```text
Designer
  ↓
Apollon GUI
  ↓
Apollon/Yjs shared model
  ↓
ApollonAdapter.toCanonical()
  ↓
UML validation
  ↓
canonical snapshot available to AI/XMI/generator
```

No DOM parsing.

---

# 8. Integration flow — AI text command

```text
Designer text
   ↓
AI Gateway
   ↓
ModelCommand[] candidate
   ↓
Schema validation
   ↓
Domain validation
   ├── invalid → bounded repair loop
   └── valid
         ↓
impact policy
   ├── small deterministic change → apply + undo
   └── large/destructive change → preview
         ↓
Command Executor
         ↓
ApollonAdapter
         ↓
Apollon/Yjs model
         ↓
remote collaborator receives update
```

---

# 9. Integration flow — voice

```text
Microphone
  ↓
Speech-to-text
  ↓
same text-command pipeline
```

Voice must not contain its own UML mutation implementation.

---

# 10. Integration flow — image/photo

```text
Image upload
  ↓
size/type validation
  ↓
multimodal AI adapter
  ↓
CandidateUMLModel
  ↓
schema validation
  ↓
semantic validation
  ↓
ambiguity/confidence report
  ↓
preview/confirm
  ↓
candidate → ModelCommand[]
  ↓
ApollonAdapter
  ↓
shared model
```

Image reconstruction never writes directly to the live collaborative model before validation.

---

# 11. Integration flow — Enterprise Architect import

```text
EA-exported XMI
  ↓
upload validation
  ↓
Node orchestration
  ↓
Python XMI bridge
  ↓
crunch_uml parser
  ↓
normalized bridge JSON
  ↓
XmiAdapter.toCanonical()
  ↓
UML validation
  ↓
preview/import report
  ↓
ApollonAdapter
  ↓
shared model
```

Import report should distinguish:

- imported;
- ignored;
- unsupported;
- warning;
- error.

---

# 12. Integration flow — Enterprise Architect export

```text
Apollon/Yjs live model
  ↓
CanonicalUMLModel
  ↓
XmiAdapter
  ↓
bridge JSON
  ↓
Python/crunch_uml renderer
  ↓
EA-oriented XMI
  ↓
download
```

Definition of success:

> Real Enterprise Architect imports the file and preserves the supported semantic subset.

Internal parse→render→parse is useful but insufficient by itself.

---

# 13. Integration flow — backend generation

```text
Live model
  ↓
CanonicalUMLModel
  ↓
UMLValidator
  ↓
SpringGenerationValidator
  ↓
SpringModelMapper
  ↓
SpringProjectModel
  ↓
EJS TemplateRenderer
  ↓
temporary generated project
  ↓
optional/required verification step
  ↓
mvn test/package
  ↓
ZIP + generation-report.json
```

The generator never reads:

- raw Apollon React components;
- raw DOM;
- AI text;
- XMI XML directly.

---

# 14. Spring generation architecture

```text
CanonicalUMLModel
        ↓
  NamingStrategy
  TypeMapper
  RelationshipMapper
  IdentityPolicy
  ValidationMapper
        ↓
SpringProjectModel
        ↓
templates
```

Templates should be deliberately simple.

A template should not be responsible for interpreting UML semantics.

---

# 15. Generated backend profile

Fixed target profile:

```text
Java 21
Maven
Spring Boot (one pinned/tested version)
Spring Web / MVC
Spring Data JPA
Jakarta Validation
Hibernate
PostgreSQL Driver
```

Optional only after the core is stable:

- DTO/Mapper;
- OpenAPI;
- Docker Compose.

Explicitly avoid in P0:

- microservices;
- reactive R2DBC;
- multiple databases;
- caches;
- Elasticsearch;
- auth framework generation;
- Liquibase;
- Gradle alternative;
- Lombok dependency.

---

# 16. Generated project structure

Recommended:

```text
generated-backend/
├── pom.xml
├── README.md
└── src/
    └── main/
        ├── java/
        │   └── <package>/
        │       ├── GeneratedApplication.java
        │       ├── controller/
        │       ├── domain/
        │       ├── repository/
        │       └── service/
        │           └── impl/
        └── resources/
            └── application.yml
```

Per persistent class:

```text
domain/<Class>.java
repository/<Class>Repository.java
service/<Class>Service.java
service/impl/<Class>ServiceImpl.java
controller/<Class>Controller.java
```

DTO may be added where necessary, but it is not mandatory for every entity.

---

# 17. CASE repository strategy

Recommended:

```text
D:\2-2026\SW1\
├── Apollon-original\
├── crunch_uml-original\
├── openflowkit\
├── generator-jhipster\
└── sw1-case-tool\
```

The first four repositories remain research/upstream references.

Our application belongs in:

```text
sw1-case-tool/
```

Recommended practical structure:

```text
sw1-case-tool/
├── frontend/
│   └── src/
│       ├── editor/
│       ├── ai/
│       ├── xmi/
│       ├── validation/
│       ├── generation/
│       └── assistance/
│
├── backend/
│   └── src/
│       ├── projects/
│       ├── ai/
│       ├── xmi/
│       ├── generation/
│       └── artifacts/
│
├── xmi-adapter/
│   └── python/
│
├── shared/
│   ├── canonical-model/
│   ├── model-commands/
│   └── contracts/
│
├── flutter-client/
│
├── tests/
└── docs/
    └── project-context/
```

Do not create every folder before it has a real responsibility.

---

# 18. Apollon dependency strategy

Preferred:

> Our repository + pinned Apollon library/integration.

Fallback:

> If required collaboration/editor functionality cannot be accessed through stable/public APIs,
> vendor or fork the minimum necessary Apollon package/server code behind the same adapter.

Never modify the pristine audit clone directly as the only copy.

---

# 19. Collaboration architecture

Apollon/Yjs provides the foundation.

Our product adds:

- project/session identity;
- access controls if needed;
- persistence/recovery;
- product-level presence UI;
- validation after changes;
- reconnection behavior;
- model/project lifecycle.

Conflict approach:

- prefer CRDT convergence;
- use awareness/presence to reduce accidental simultaneous edits;
- do not introduce hard locks unless real tests show a need.

---

# 20. AI architecture

OpenFlowKit taught a strong pattern:

```text
unstructured request
 ↓
strict candidate
 ↓
deterministic parser/schema
 ↓
semantic validator
 ↓
one bounded repair attempt
 ↓
preview if impactful
 ↓
apply
```

Our version replaces OpenFlow DSL with UML-specific commands/candidate models.

The AI cannot:

- execute arbitrary shell commands;
- write arbitrary code into the generated project;
- bypass validation;
- mutate unrelated model elements silently.

---

# 21. Contextual learning-agent architecture

The user-learning mechanism should use actual product state.

Inputs:

- current model;
- validation issues;
- current screen;
- current workflow stage;
- recent user action;
- supported next actions.

Outputs:

- concise explanation;
- recommended next step;
- optional deterministic tool/action.

Example:

```text
"You have three classes, but Order–Customer has no multiplicity.
Set both endpoint multiplicities before generating the backend."
```

The agent should guide rather than overwhelm.

---

# 22. Flutter/mobile architecture boundary

The mobile client is not part of Apollon's architecture.

Conceptual offline flow:

```text
Voice/user action
  ↓
On-device AI / intent layer
  ↓
local application action
  ↓
local persistence + pending-sync queue
  ↓
[offline]
  ↓ connectivity restored
Sync service
  ↓
Generated Spring Boot REST API
```

The exact on-device model/runtime remains pending device validation.

Do not reuse Ollama desktop assumptions blindly for Flutter/mobile.

---

# 23. Hosted/cloud deployment

For Gates 2 and 3:

```text
Browser
  ↓ HTTPS
Web deployment
  ↓
Node backend
  ├── collaboration/WebSocket
  ├── AI gateway
  ├── XMI bridge
  └── generator
       ↓
CASE persistence / temp artifacts
```

Requirements:

- deployed URL;
- version tied to Git commit;
- environment variables;
- stable WebSocket behavior;
- XMI bridge available;
- generator toolchain available;
- logs sufficient for diagnosis.

---

# 24. Local fallback deployment

Must be documented and tested.

Possible dependencies:

```text
Node
pnpm/npm
Python environment for XMI bridge
Redis/RedisJSON if retained
Java 21
Maven
PostgreSQL
```

Local startup must be short and repeatable.

Do not discover missing prerequisites on exam day.

---

# 25. Security boundaries

Minimum controls:

- upload file-size limits;
- MIME/extension checks;
- safe temporary directory;
- no shell interpolation for user filenames;
- subprocess timeouts;
- temp-file cleanup;
- path traversal prevention;
- generated Java identifier validation;
- package-name validation;
- no provider secrets in generated source;
- no arbitrary AI code execution;
- API error normalization;
- rate limit/retry policy for AI calls.

---

# 26. Architecture anti-patterns explicitly rejected

Do not:

- add Kafka;
- add Kubernetes for academic prestige;
- split every module into a microservice;
- run Apollon and OpenFlowKit canvases together;
- use OpenFlow DSL as the UML model;
- convert UML to JDL and then invoke full JHipster as the normal path;
- let image AI write directly into shared state;
- let AI generate uncontrolled Java;
- use database schema as the canonical design model;
- support multiple generated stacks;
- use two collaboration engines.

---

# 27. Architecture defense statement

> The project uses a component-based modular architecture centered on a canonical UML semantic
> contract. Apollon provides the graphical and collaborative modeling capability; crunch_uml is
> isolated behind an Enterprise Architect/XMI adapter; AI interactions are converted into validated
> UML-specific commands or candidate models; and backend generation transforms the canonical model
> through a Spring-specific intermediate representation into deterministic EJS templates. This
> structure keeps external components replaceable, prevents duplicated sources of truth, and
> concentrates our original work in the semantics, validation, interoperability boundary and
> model-to-code transformation required by the assignment.
