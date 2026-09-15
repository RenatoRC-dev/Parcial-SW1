# 04 — Functional and Technical Specification

> **Status:** Implementation baseline  
> **Purpose:** Convert the requirements/architecture into explicit contracts, rules and generated
> behavior.

---

# 1. Supported UML subset

The tool is focused on conceptual data design.

P0 semantic subset:

- class;
- class name;
- abstract flag where available;
- attribute;
- attribute name;
- attribute type;
- visibility where available;
- association;
- aggregation;
- composition;
- multiplicity;
- role name;
- enum if implementation time permits;
- generalization preserved where supported by editor/XMI.

Important generation distinction:

> A UML element may be supported for editing/import/export before it is supported for backend
> generation.

Unsupported generation semantics must be reported explicitly.

---

# 2. Canonical UML model

A concrete baseline:

```ts
interface CanonicalUMLModel {
  id: string;
  name: string;
  version: number;

  umlVersionReference: "2.5+";

  classes: UMLClass[];
  enums: UMLEnum[];
  relationships: UMLRelationship[];

  diagram?: UMLDiagramLayout;

  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    source?: "manual" | "xmi" | "image" | "mixed";
  };
}
```

## 2.1 Class

```ts
interface UMLClass {
  id: string;
  name: string;
  abstract?: boolean;
  stereotype?: string;

  attributes: UMLAttribute[];

  position?: {
    x: number;
    y: number;
  };

  size?: {
    width: number;
    height: number;
  };
}
```

## 2.2 Attribute

```ts
interface UMLAttribute {
  id: string;
  name: string;
  type: UMLType;

  visibility?: "public" | "private" | "protected" | "package";

  required?: boolean;
  unique?: boolean;

  identity?: {
    enabled: boolean;
    strategy?: "AUTO" | "IDENTITY";
  };
}
```

## 2.3 Enum

```ts
interface UMLEnum {
  id: string;
  name: string;
  literals: string[];
}
```

## 2.4 Relationship

```ts
type UMLRelationshipKind =
  | "association"
  | "aggregation"
  | "composition"
  | "generalization";

interface UMLRelationship {
  id: string;
  kind: UMLRelationshipKind;

  sourceClassId: string;
  targetClassId: string;

  sourceMultiplicity?: Multiplicity;
  targetMultiplicity?: Multiplicity;

  sourceRole?: string;
  targetRole?: string;

  sourceNavigable?: boolean;
  targetNavigable?: boolean;

  waypoints?: Array<{ x: number; y: number }>;
}
```

## 2.5 Multiplicity

```ts
interface Multiplicity {
  min: number;
  max: number | "*";
}
```

Canonical normalized forms:

```text
0..1
1
0..*
1..*
```

Input `*` may normalize to `0..*`.

---

# 3. Methods/operations in class diagrams

Apollon may support methods/operations visually.

For this data-design project:

- operations are not needed to generate relational database structure;
- they should not influence JPA mapping unless a future requirement explicitly says so;
- importing unsupported operation metadata must not corrupt the class model.

P0 may either:

1. preserve operations as non-generation metadata if easy; or
2. report them as unsupported/pass-through.

Do not pretend that methods map to PostgreSQL columns.

---

# 4. Stable identifiers

Names are not identities.

Every class, attribute and relationship requires a stable internal id.

Why:

- AI focused edits;
- collaboration;
- XMI identity mapping;
- rename operations;
- geometry retention;
- traceability;
- generation reports.

Renaming:

```text
class id remains the same
name changes
```

---

# 5. ModelCommand contract

Automated edits use constrained operations.

Recommended baseline:

```ts
type ModelCommand =
  | {
      type: "CREATE_CLASS";
      classId?: string;
      name: string;
      x?: number;
      y?: number;
    }
  | {
      type: "RENAME_CLASS";
      classId: string;
      newName: string;
    }
  | {
      type: "MOVE_CLASS";
      classId: string;
      x: number;
      y: number;
    }
  | {
      type: "DELETE_CLASS";
      classId: string;
    }
  | {
      type: "ADD_ATTRIBUTE";
      classId: string;
      attribute: {
        id?: string;
        name: string;
        dataType: string;
        required?: boolean;
      };
    }
  | {
      type: "UPDATE_ATTRIBUTE";
      classId: string;
      attributeId: string;
      patch: {
        name?: string;
        dataType?: string;
        required?: boolean;
        unique?: boolean;
      };
    }
  | {
      type: "DELETE_ATTRIBUTE";
      classId: string;
      attributeId: string;
    }
  | {
      type: "CREATE_RELATION";
      relationId?: string;
      kind: UMLRelationshipKind;
      sourceClassId: string;
      targetClassId: string;
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
      sourceRole?: string;
      targetRole?: string;
    }
  | {
      type: "SET_MULTIPLICITY";
      relationId: string;
      endpoint: "source" | "target";
      multiplicity: string;
    }
  | {
      type: "SET_RELATION_ROLE";
      relationId: string;
      endpoint: "source" | "target";
      role?: string;
    }
  | {
      type: "DELETE_RELATION";
      relationId: string;
    };
```

The AI cannot invent command names outside the whitelist.

---

# 6. AI request context

For model-edit requests, provide the AI with:

- supported command schema;
- supported attribute types;
- allowed multiplicities;
- current canonical model or relevant subset;
- selected/focused element ids;
- explicit rule to preserve unrelated ids;
- user instruction.

Do not serialize the raw DOM.

---

# 7. AI validation and repair

Pipeline:

```text
LLM output
 ↓
JSON/schema validation
 ↓
command-domain validation
 ├── valid
 └── invalid
      ↓
structured errors + previous response
      ↓
one repair attempt
      ↓
validate again
```

Default repair limit:

```text
1 controlled retry
```

Avoid infinite AI loops.

Example error:

```json
{
  "code": "INVALID_MULTIPLICITY",
  "elementId": "rel-123",
  "field": "targetMultiplicity",
  "allowed": ["0..1", "1", "0..*", "1..*"],
  "received": "many"
}
```

---

# 8. AI impact policy

## Apply directly after validation

Examples:

- rename one class;
- add one attribute;
- move one class;
- set one multiplicity.

Requirements:

- reversible/undoable where practical;
- change report visible.

## Require preview/approval

Examples:

- delete class with relationships;
- create/delete many elements;
- broad refactor;
- image import;
- replace significant model area;
- uncertain target.

Human remains responsible for model semantics.

---

# 9. Voice specification

Voice pipeline:

```text
microphone
 ↓
speech-to-text
 ↓
plain-text user command
 ↓
AI command interpretation
 ↓
ModelCommand[]
```

Acceptance rules:

- transcript is visible or inspectable;
- unsupported/ambiguous command does not mutate model;
- same command semantics work whether typed or spoken.

---

# 10. Image/photo specification

## 10.1 Candidate model

```ts
interface CandidateUMLModel {
  classes: CandidateClass[];
  relationships: CandidateRelationship[];

  warnings: CandidateIssue[];

  source: {
    type: "image";
  };
}
```

Candidate elements may carry:

```ts
interface CandidateEvidence {
  confidence?: number;
  ambiguous?: boolean;
  notes?: string[];
}
```

## 10.2 Required behavior

- recognize candidate classes;
- recognize candidate attributes/types where visible;
- recognize relations;
- recognize multiplicities where visible;
- flag uncertain semantics;
- show preview;
- allow correction;
- commit only after confirmation.

A misread `1` versus `*` is a semantic error, not a cosmetic error.

---

# 11. Validation architecture

Use three levels.

## 11.1 Structural/schema validation

Examples:

- invalid JSON shape;
- unknown command type;
- missing required field;
- malformed id.

## 11.2 UML/domain validation

Examples:

- duplicate class id;
- duplicate class name where unsupported;
- duplicate attribute name inside class;
- dangling relation endpoint;
- unsupported multiplicity;
- self-relation missing disambiguating roles;
- unsupported imported construct.

## 11.3 Generation validation

Examples:

- Java-invalid class name;
- Java-invalid field name;
- unsupported UML type;
- generated table-name collision;
- reserved PostgreSQL identifier;
- unresolved relation ownership;
- unsupported inheritance mapping.

Only generation-blocking errors stop generation.

Warnings may allow the model to remain editable.

---

# 12. Validation issue contract

```ts
interface ModelIssue {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";

  elementId?: string;
  elementType?: "MODEL" | "CLASS" | "ATTRIBUTE" | "RELATION";

  message: string;
  suggestion?: string;
}
```

This same structure can feed:

- UI badges;
- contextual assistant;
- generation report;
- documentation evidence.

---

# 13. XMI bridge contract

Keep crunch_uml behind a narrow bridge.

## Import

Input:

```text
EA-exported XMI file
```

Output:

```json
{
  "candidateModel": {},
  "warnings": [],
  "unsupported": [],
  "sourceMetadata": {}
}
```

## Export

Input:

```text
CanonicalUMLModel
```

Output:

```text
EA-oriented XMI file
+ warnings/report
```

No Node module outside the adapter should know crunch_uml SQLAlchemy internals.

---

# 14. XMI supported semantic target

P0 target:

- packages if required by file structure;
- classes;
- attributes;
- common datatypes;
- enums where supported;
- associations;
- multiplicities;
- roles;
- generalizations if supported;
- geometry where practical.

Unsupported elements must be reported rather than silently discarded if their loss changes required
semantics.

---

# 15. Enterprise Architect round-trip acceptance

Test fixture:

```text
Customer
- name: String

Order
- date: Date
- total: Decimal

Customer "1" ---- "0..*" Order
```

Pass conditions:

- EA export can be imported by our tool;
- our model matches expected semantics;
- our exported XMI imports back into EA;
- class/attribute/relation/multiplicity values survive;
- any geometry difference is documented.

Repeat with role names and generalization if those become generation scope.

---

# 16. Spring generation intermediate representation

Do not render raw UML directly.

```ts
interface SpringProjectModel {
  groupId: string;
  artifactId: string;
  packageName: string;

  javaVersion: 21;
  database: "postgresql";

  entities: SpringEntity[];
  enums: SpringEnum[];
}
```

```ts
interface SpringEntity {
  umlClassId: string;

  className: string;
  instanceName: string;
  tableName: string;

  primaryKey: SpringField;
  fields: SpringField[];
  relationships: SpringRelationship[];

  imports: string[];
}
```

```ts
interface SpringField {
  umlAttributeId?: string;

  javaName: string;
  columnName: string;

  umlType: string;
  javaType: string;

  primaryKey: boolean;
  generated: boolean;

  nullable: boolean;
  unique: boolean;
}
```

```ts
interface SpringRelationship {
  umlRelationId: string;

  type:
    | "ONE_TO_ONE"
    | "ONE_TO_MANY"
    | "MANY_TO_ONE"
    | "MANY_TO_MANY";

  sourceEntity: string;
  targetEntity: string;
  ownerEntity: string;

  sourceProperty?: string;
  targetProperty?: string;

  joinColumn?: string;
  joinTable?: string;

  required: boolean;
}
```

---

# 17. Generation lifecycle

Recommended:

```text
validateModel()
prepareProject()
prepareEntities()
prepareFields()
preparePrimaryKeys()
prepareRelationships()
preparePersistence()
renderFiles()
verifyGeneratedProject()
packageOutput()
```

Complexity belongs in preparation/mapping code, not in EJS templates.

---

# 18. Naming strategy

Deterministic baseline:

```text
UML class: CustomerOrder
Java class: CustomerOrder
instance: customerOrder
table: customer_order

UML attribute: createdAt
Java field: createdAt
column: created_at
```

Generated components:

```text
CustomerOrderRepository
CustomerOrderService
CustomerOrderServiceImpl
CustomerOrderController
```

Collision validation must run after normalization.

---

# 19. Type mapping

Recommended P0 mapping:

| UML/Input | Java |
|---|---|
| `String` | `String` |
| `Integer`, `int` | `Integer` |
| `Long` | `Long` |
| `Decimal` | `BigDecimal` |
| `Double` | `Double` |
| `Float` | `Float` |
| `Boolean`, `bool` | `Boolean` |
| `Date` | `LocalDate` |
| `DateTime` | one pinned policy: `LocalDateTime` or `Instant` |
| `UUID` | `UUID` |
| Enum | generated Java enum |

Unknown types:

```text
ERROR — generation blocked
```

Do not silently coerce unknown types to `String`.

---

# 20. Identity policy

Simplest deterministic P0:

If the model does not define a usable explicit identity:

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;
```

Rules:

- one primary key per generated entity;
- no composite ids in P0;
- custom id support only if deliberately implemented/tested.

This is a generation convention and must be documented as such.

---

# 21. Multiplicity → JPA mapping

## 21.1 One-to-many

UML:

```text
Customer 1 ---- 0..* Order
```

Generation:

```text
Order owns FK
Order → @ManyToOne Customer
Customer → @OneToMany(mappedBy="customer") collection
```

## 21.2 One-to-one

Generation:

```text
owner → @OneToOne + unique @JoinColumn
inverse → @OneToOne(mappedBy=...)
```

If UML does not specify ownership, apply one deterministic project rule and record it in the
generation IR.

Recommended fallback:

```text
canonical target side owns
```

unless explicit navigability/role semantics determine otherwise.

## 21.3 Many-to-many

Pure relation:

```text
@ManyToMany
@JoinTable
```

Use a deterministic owner.

If business data belongs to the relationship, the model should use an explicit association entity
rather than a plain N:M relation in P0.

---

# 22. Aggregation and composition

Editing/import/export may preserve both.

P0 persistence rule:

- aggregation follows association cardinality semantics;
- composition must not automatically introduce destructive cascade behavior unless explicitly
  implemented and tested.

Optional later rule:

```text
composition → cascade/orphanRemoval
```

but only after a clear lifecycle policy.

Never silently add `CascadeType.ALL` to every relationship.

---

# 23. Generalization/inheritance

Apollon/crunch_uml can represent generalization.

JHipster does not solve UML inheritance mapping for us.

Therefore:

### P0 safe behavior

- preserve generalization in the model;
- preserve it in XMI where supported;
- block or warn backend generation if inheritance generation is not implemented.

### Optional P1

Implement exactly one JPA strategy, preferably a single documented strategy such as `JOINED`.

Do not support three inheritance strategies under deadline.

---

# 24. Generated validation annotations

Where represented by the model:

```text
required → @NotNull + nullable=false
unique → @Column(unique=true)
maxLength → @Size(max=...)
```

Do not invent validation rules that do not exist in the conceptual model/project conventions.

---

# 25. JSON serialization recursion

Bidirectional JPA relations can recurse:

```text
Customer.orders
 → Order.customer
 → Customer.orders
 → ...
```

P0 solution:

- controlled Jackson annotations such as `@JsonIgnoreProperties`; or
- DTOs if the generated mapping requires them.

Test REST JSON for every supported relationship family.

---

# 26. Service layer

Generate a stable architecture for every entity:

```text
<Entity>Service
<Entity>ServiceImpl
```

Recommended operations:

```text
create/save
update
findAll
findById
delete
```

Avoid configurable service strategies.

---

# 27. Controller layer

Predictable REST API:

```text
POST   /api/<entities>
GET    /api/<entities>
GET    /api/<entities>/{id}
PUT    /api/<entities>/{id}
DELETE /api/<entities>/{id}
```

Optional:

```text
PATCH
```

only after core endpoints are stable.

Predictability is important because the exam Flutter client must be created quickly.

---

# 28. Generated configuration

`application.yml` should use environment variables.

Conceptual example:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:generated_db}
    username: ${DB_USER:postgres}
    password: ${DB_PASSWORD:postgres}

  jpa:
    hibernate:
      ddl-auto: update
```

Exact production configuration must be validated before freezing templates.

Do not hard-code private credentials.

---

# 29. Generated Maven dependencies

Minimum:

```text
spring-boot-starter-web
spring-boot-starter-data-jpa
spring-boot-starter-validation
postgresql
spring-boot-starter-test
```

Optional:

- OpenAPI/springdoc only if useful;
- no dependency on JHipster runtime.

---

# 30. Generated README and manifest

Generated project should include a short README:

```text
requirements
database configuration
run PostgreSQL
run Maven
API base path
```

Also generate:

```text
generation-report.json
```

Suggested fields:

```json
{
  "sourceModelVersion": 1,
  "entities": 4,
  "relationships": 3,
  "warnings": [],
  "generatedFiles": [],
  "traceability": {}
}
```

---

# 31. Generator success definition

A backend is not considered successfully generated merely because files exist.

Definition of success:

```text
files rendered
AND
expected project structure exists
AND
mvn test/package succeeds in the verification environment
AND
application can start with PostgreSQL configuration
```

Before exam, fixture projects must pass all four.

---

# 32. CASE APIs — conceptual contract

These routes are project contracts, not final URL commitments.

```text
POST /api/projects
GET  /api/projects/{id}
PUT  /api/projects/{id}/model

POST /api/projects/{id}/validate

POST /api/projects/{id}/ai/commands
POST /api/projects/{id}/ai/image

POST /api/projects/{id}/xmi/import
GET  /api/projects/{id}/xmi/export

POST /api/projects/{id}/generate
GET  /api/generations/{generationId}
GET  /api/generations/{generationId}/download
```

Collaboration may use WebSocket/Yjs-specific endpoints separately.

---

# 33. Error contract

All subsystem errors should normalize into:

```ts
interface AppError {
  code: string;
  message: string;
  stage?:
    | "EDITOR"
    | "AI"
    | "IMAGE"
    | "XMI"
    | "VALIDATION"
    | "GENERATION"
    | "COMPILATION";
  elementId?: string;
  details?: unknown;
}
```

This improves debugging and contextual guidance.

---

# 34. Contextual user-learning agent

Minimum capabilities:

```text
inspect current workflow state
inspect validation problems
explain supported UML action
suggest next step
focus affected element
trigger validation with permission
explain why generation is blocked
```

It should not:

- invent unsupported capabilities;
- change model silently;
- dump a giant generic tutorial regardless of context.

---

# 35. Flutter offline client specification

The exact mobile AI technology is `PENDING`.

Required behavior contract:

## Online

```text
voice/user intent
 ↓
local/online assistant logic
 ↓
generated REST API
 ↓
server data
```

## Offline

```text
voice/user intent
 ↓
on-device AI
 ↓
local action
 ↓
local persistence
 ↓
pending synchronization queue
```

## Reconnection

```text
connectivity restored
 ↓
sync queue
 ↓
generated backend
 ↓
success/conflict status
```

Minimum proof:

- required AI behavior works without network;
- at least one locally created change survives offline;
- queued change reaches backend after reconnection.

Do not claim success until tested on the actual target device/emulator configuration.

---

# 36. Quality constraints for fast Flutter-client creation

The generated API must be predictable:

- uniform CRUD paths;
- uniform JSON naming;
- stable ids;
- simple errors;
- no unnecessary auth;
- no complicated pagination in P0;
- no custom endpoint variations per entity.

This directly supports the professor's short exam-time client-development scenario.

---

# 37. Security and safety checklist

Before release:

- model uploads limited;
- XMI parser run in controlled process;
- Python subprocess uses argument arrays, not shell concatenation;
- temporary files are cleaned;
- AI image size limited;
- provider credentials are environment variables;
- generated package/class names validated;
- generated output restricted to a controlled directory;
- no arbitrary template paths;
- no arbitrary shell commands produced by AI;
- compilation has timeout;
- generated artifact failures do not leak partial success state.

---

# 38. Technical Definition of Done

## Modeling

- supported elements editable;
- canonical conversion works;
- stable ids preserved.

## Collaboration

- two clients converge;
- presence visible where implemented;
- reconnect recovers model.

## AI

- strict commands;
- invalid output repaired at most once;
- unrelated elements unchanged.

## Image

- candidate structured model;
- preview;
- ambiguity surfaced.

## XMI

- real EA round-trip for supported subset.

## Generator

- valid model maps to generation IR;
- project renders;
- compiles;
- starts;
- PostgreSQL schema appears;
- REST CRUD works.

## Mobile

- local AI works offline;
- queued operation synchronizes.

Only then should the feature be presented as complete.
