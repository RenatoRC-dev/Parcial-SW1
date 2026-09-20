# UX Stabilization — UML Editor

## 1. Manual acceptance findings

Manual acceptance found that Apollon's generic property popup allowed free-text attribute notation and multiplicities that do not match SW1's bounded canonical/generation profile. Later acceptance also confirmed that its generic Class palette inserted fake attribute/method data and that SW1 needed first-class, bounded UML operation semantics.

## 2. Business/UX problem

CU02 needed preventive, explainable controls: students should choose supported semantics instead of composing Apollon notation manually and discovering errors later. This is UX hardening, not a new use case or a new UML metamodel.

## 3. Attribute UX

The SW1 inspector separates attribute name, type and visibility. Creation is validated with the existing CU08 validator and applied atomically through the existing canonical-to-Apollon conversion. It also provides safe class creation and class renaming. New attributes default to private visibility.

## 4. UML visibility clarification

`+` means public and `-` means private; neither symbol means “attribute”. The UI exposes only the canonical vocabulary already supported by SW1: `publica` and `privada`. New manual attributes default to `privada`, represented in Apollon as `- nombre: Tipo`.

## 5. Supported-type source

The type selector reads `TIPOS_GENERACION_SOPORTADOS` from CU08. No second UI list was introduced. Arbitrary manual values such as `strin` or `varchar` cannot be entered through the normal creation control. Existing imported types outside that profile remain visible, are marked as unsupported for generation and are preserved unless the user explicitly changes them.

## 6. Relationship UX

The inspector exposes canonical relationship type, source, target, endpoint multiplicities and optional roles with Spanish/English labels. Internal values and direction are unchanged. Association, aggregation, composition and generalization are the options because those are the existing canonical relation values.

## 7. Multiplicity source

The selector is generated from the exported canonical `MULTIPLICIDADES_UML` tuple: `1`, `0..1`, `0..*`, `1..*`. Friendly labels are presentation only. New relationships require an explicit value at both ends; no new semantic default was invented.

## Relationship visualization and semantics

Manual acceptance traced the invisible-edge defect to SW1's canonical-to-Apollon adapter: it emitted the nonexistent class-node handles `source` and `target`. The adapter now selects valid public Apollon handles (`left`, `right`, `top`, `bottom`) deterministically from class positions. The result is one real selectable Apollon/React Flow edge, not a CSS/SVG overlay. Apollon's native class-edge types continue to provide association, aggregation, composition and generalization notation, plus endpoint multiplicities and roles.

The inspector distinguishes Class A/Class B during atomic creation and displays both endpoint classes on existing relationships. Clicking the real edge feeds its stable ID through the public `subscribeToSelectionChange()` API and focuses that relationship in the inspector. Multiplicity changes remain controlled canonical values and preserve the relationship ID.

`RelacionUML.nombre` is a backward-compatible optional association name, distinct from endpoint roles. It round-trips through `data.label` in the Apollon model and persists as canonical JSON. The installed Apollon class-diagram renderer does not render its generic middle `data.label`; only other diagram edge renderers enable that label. SW1 therefore exposes and preserves the name in its inspector without abusing roles or patching Apollon internals. The existing crunch_uml profile does not preserve association names, so XMI name round-trip remains deferred; roles and multiplicities remain green.

Many-to-many (`0..*`/`0..*` or `1..*`/`1..*`) is valid canonical modeling. It remains outside the current Spring generation profile and produces controlled “not ready” feedback. It does not imply an association class automatically: the designer must declare that semantic explicitly.

## Associative Class — Patch A

`ClaseUML.tipoClase` distinguishes `normal` from `asociativa`; absence in a legacy model normalizes to `normal`. An associative class remains a real class with stable ID, position, optional methods and normal relationships, and may intentionally have no visible attributes. SW1 never infers it from topology or from a small attribute count, and never invents `id`, PK or FK attributes.

The manual inspector can create an empty associative class or atomically replace a selected direct `0..*`/`0..*` association. For `Usuario 0..* — 0..* Rol`, the result is `Usuario 1 — 0..* UsuarioRol` plus `UsuarioRol 0..* — 1 Rol`, with the original N:M relation removed only after every name, endpoint and ID check passes. CU04 exposes explicit create/convert commands and its frontend executor calls the same deterministic transformation; voice inherits it through the existing transcript pipeline. CU05 deliberately does not infer this ambiguous semantic from an image.

The metadata round-trips inside the existing public Apollon class `data`, so the established canonical → Apollon → Yjs path propagates it without a new collaboration protocol. CU11 normalizes legacy classes and preserves explicit associative metadata and both relationship ends. The inspected crunch_uml bridge has no reliable formal AssociationClass discriminator in the supported profile, so XMI continues to exchange the structural classes and relationships and does not fabricate `tipoClase`.

CU08 accepts an empty associative class as structurally valid/editable. CU09 rejects it separately with the controlled readiness reason that composite-key generation is not in the current profile. Composite PK, PK/FK metadata, `@EmbeddedId`, `@IdClass`, `@ManyToMany`, join-table and associative-entity generation remain explicitly deferred to Patch B.

## Association-End Multiplicity Semantic Correction

Multiplicity belongs to a UML association end. `multiplicidadOrigen` is the value written beside `claseOrigenId`; `multiplicidadDestino` is the value written beside `claseDestinoId`. The value beside Class B answers “how many B instances may be linked to one A?”, while the value beside Class A answers the inverse question. The fields are not directional counts named after the class from which the question starts.

The golden example is `Persona 1 — 0..* Auto`: one Persona may have zero or many Autos, and each Auto belongs to exactly one Persona. Canonically, source=`Persona`, target=`Auto`, `multiplicidadOrigen="1"`, and `multiplicidadDestino="0..*"`. Apollon receives `sourceMultiplicity="1"` and `targetMultiplicity="*"`; its visual labels were verified near Persona and Auto respectively, and the reverse adapter recovers `1`/`0..*` on the same ends.

The manual creation UI no longer asks users to assign an unexplained “source multiplicity”. It asks “For one Persona, how many Auto instances may there be?” and the inverse question, then performs one deterministic translation to association ends. Existing-relation editing explicitly says “Multiplicity at this end” and explains the opposite-class count represented there. Spanish and English use the same canonical values.

CU04 uses the same separation. Its strict structured command expresses `cantidadDestinoPorOrigen` and `cantidadOrigenPorDestino`; the executor alone converts those business counts to canonical end multiplicities. The Groq prompt includes the Persona/Auto example, while deterministic semantic tests—not prompt wording—verify the translation. Asymmetric matrices cover `1 ↔ 0..*`, `1 ↔ 0..1`, and `0..1 ↔ 1..*`; symmetric relationships are not used as evidence for this defect.

The correction was traced through persistence, collaboration, XMI and generation. Save/Open retains the value associated with each class; a collaborator receives the same asymmetric canonical ends; the internal crunch_uml round-trip preserves source=`1` and target=`0..*`; and the Persona/Auto Spring fixture generates `@OneToMany List<Auto> autos` on Persona plus `@ManyToOne Persona persona` and `persona_id` on Auto. Its HTTP-generated project compiled with Java release 21. No visual-only swap or new relationship model was introduced.

## Explicit ID modeling

CU08 now accepts exactly the conventional explicit attribute `id: Long`; `id` with another type produces a controlled validation error. It remains a normal canonical attribute for the canvas, persistence, collaboration and XMI. Deleting it is allowed. The Spring preparation step excludes a valid explicit ID from ordinary scalar fields, while the unchanged entity template emits the single accepted `@Id`, `@GeneratedValue` and `Long id`. When no canonical ID exists, that same template remains the implicit fallback, preserving older projects.

Generator tests verify one `@Id` and one `private Long id;` with explicit identity, rejection of `id: String`, and unchanged implicit identity. A generated explicit-ID project compiled with Java release 21 using `mvnw.cmd clean test` (`BUILD SUCCESS`). Custom PK names/types, composite IDs and user-assigned identity are outside this correction.

Method bodies, algorithm generation and method-to-endpoint inference remain deferred. UML operation signatures are now canonical design semantics. The public Apollon options expose no host override for its class palette `defaultData`; therefore the unsafe generic palette is omitted using public control composition while zoom and minimap remain. “Nueva clase” is the supported creation path and produces empty attributes and methods without patching dependency internals.

## Compact Property Inspector Correction

The first stabilization correctly constrained unsafe free-text types, visibilities and multiplicities, but subsequent manual acceptance found that one large form per attribute and permanently expanded creation forms made the inspector feel like CRUD administration instead of a CASE property panel.

The corrected design keeps the semantic safeguards while using compact inline rows. Open-domain values (class name, attribute name and relationship roles) remain small text inputs; names commit on blur or Enter. Closed-domain values (attribute type, visibility, relationship type and multiplicity) remain selectors generated directly from the authoritative CU08/canonical vocabularies and apply immediately. Existing attributes and relationships expose direct, accessible delete actions. New attributes and relationships use one temporary compact row/block with explicit confirm/cancel behavior, and canonical IDs are created only on confirmation.

Unsupported imported attribute types remain visible as a special current select option and are preserved until the user deliberately chooses a supported replacement. The correction introduced no second editor or UML state model: every committed operation still builds a new `ModeloUMLCanonico` and follows the existing canonical-to-Apollon-to-Yjs path.

Manual acceptance also traced `+ attribute: Type` and `+ method()` to Apollon's internal `dropElementConfigs` palette/drop template. They are real seeded data. Because `@tumaet/apollon@5.3.0` exposes placement for the palette but neither `defaultData` replacement nor per-element filtering, SW1 omits the generic palette through the public compound-control API and retains public Zoom/MiniMap controls. The SW1 class command creates `atributos: []` and `metodos: []`; no heuristic removes legitimate imported content.

## Generic Apollon Class Placeholder Closure

The generic Class palette was the sole remaining supported path that seeded `attribute: Type` and `method()`. It is now unavailable through documented Apollon control composition. Unit and browser evidence verifies the palette control is absent and the guided SW1 creation path produces one real Apollon class with zero attributes and zero methods.

## UML Operations / Methods

`ClaseUML.metodos` contains stable `MetodoUML` elements with ID, name, `publica`/`privada` visibility, controlled return type and parameters. The field is optional only at the TypeScript boundary for backward compatibility; Apollon-to-canonical conversion normalizes it to an array. Exact duplicate name-plus-parameter-type signatures are rejected, while distinct signatures remain representable.

The compact inspector supports one temporary creation row, blur/Enter renaming, immediate controlled return/visibility changes and direct deletion. New methods default to public and `void`. Return options derive from `TIPOS_GENERACION_SOPORTADOS` plus `void`; no second scalar-type vocabulary exists.

## Parameters

`ParametroUML` stores stable ID, name and controlled type. Parameters expand only for the chosen method and support compact add, blur/Enter name editing, controlled type changes and delete. Blank or duplicate names are rejected without committing the edit; types use the authoritative CU08 list. Apollon stores only the full operation text, so parameter IDs are deterministically reconstructed from the stable method ID and parameter order during an Apollon round-trip.

## UML vs Relational Mapping

An operation such as `+ cambiarNombre(nombre: String): void` belongs to the object-oriented class model. The relational table contains persistent state such as `id` and `nombre`, not executable methods. This is an explicit OO-to-relational transformation rule rather than semantic loss: operation signatures remain in the design model while no column is invented for them.

## Method Persistence

CU11 persists the canonical methods and parameters in the same project JSON. A legacy class without `metodos` is accepted and normalized on its next Apollon conversion. Browser evidence verified add method/parameter, explicit Save, leave, reopen and exact canonical/canvas recovery.

## Method Collaboration

No method-specific transport was added. The canonical-to-Apollon operation notation enters the existing Apollon/Yjs document. Browser evidence verified Ana creating `calcularTotal(): Double`, Bruno receiving it without reload, Bruno changing its return type to Boolean, and Bruno deleting it with the deletion propagating back to Ana.

## Method XMI Status

The inspected crunch_uml class/XMI model does not expose UML operations through the current bridge. SW1 does not encode methods as attributes, comments or private XML. Existing XMI proof remains green for its supported classes, attributes, association, multiplicities and roles, while operation round-trip is explicitly added to the pending real EA acceptance scope under `EA-XMI-001`.

## Spring Generation Boundary

Generation accepts a structurally valid canonical model containing methods but intentionally does not emit them. A signature contains no algorithm/body and is not equivalent to a CRUD service method or REST endpoint. No throwing stubs, fake return values or inferred business logic are generated. A model with explicit `id: Long`, scalar state and `cambiarNombre(nombre: String): void` produced exactly one ID, omitted the UML operation from Java, and compiled successfully with Java release 21.

## Manual Acceptance Result

PASS. A clean Persona class can model explicit identity, scalar state and real UML operations; relationships continue to render as real selectable edges. Save/Open, live collaboration and Spring generation boundaries were verified without private Apollon APIs, overlays or a second model.

## Assisted Modeling Synchronization

Manual acceptance exposed three inconsistencies between the current canonical/manual profile and CU04: lowercase or separator-based natural-language class names could be rejected, the obsolete AI rule rejected the now-valid `id: Long`, and structured commands did not cover the canonical method/parameter model. It also exposed that the method delete action could be squeezed out of the narrow property inspector.

CU04 now performs deterministic assisted-boundary normalization before semantic dry-run. Natural-language class creations and references use PascalCase (`factura`/`FACTURA` -> `Factura`; `factura producto`, `FACTURA_PRODUCTO` and `factura-producto` -> `FacturaProducto`). References are resolved to the existing canonical class ID, and normalized duplicate creations produce one controlled conflict. This helper is not part of the manual editor or the global canonical setter, so manually entered names retain their existing behavior.

Type casing is normalized only against the authoritative supported vocabulary; unsupported semantic types such as `varchar` are not guessed into another type. Assisted attributes default to `privada` when visibility is omitted. The obsolete reservation of the attribute name `id` was removed: `id: Long` is valid, while another explicit ID type is rejected deterministically and atomically.

The strict CU04 command union and Groq JSON schema now include create/modify/delete method plus add/modify/delete parameter operations. Methods are signatures only, default to `publica` and `void`, and may carry structured parameters in the same creation command. All variants pass structural validation and a dry-run against the latest canonical model before application; ambiguity or invalid types result in zero mutation. Voice adds no parallel rules: transcription continues through this exact CU04 text pipeline.

CU05 keeps its detected candidate honest. A visible `id: Long` imports successfully; `id: String` is not repaired and fails existing CU08 validation atomically. Image class names are not passed through the aggressive natural-language normalizer. CU05 operation extraction remains deferred because its accepted visual candidate contract currently covers classes, attributes and supported relationships, not methods.

The compact method row now uses a responsive two-row grid when needed. Its translated, accessible delete button remains visible at normal inspector width and applies one canonical update through the existing canonical-to-Apollon-to-Yjs path. Parameter deletion remains directly available in its expanded editor.

## 8. Language preference

A lightweight typed context and one centralized dictionary support `es` and `en`. Spanish is the safe default. `sw1.idioma` stores only the local browser preference; corrupt values fall back to Spanish. All SW1-owned static UI in project, modeling, collaboration, AI, voice, image, XMI, generation and development-inspector surfaces uses that dictionary.

## 9. Appearance preference

The compact global control supports System, Light and Dark. `sw1.tema` stores the local preference. System follows `prefers-color-scheme` and reacts to changes. CSS variables style the SW1 shell; language/theme never enter project JSON, the canonical model, the backend or Yjs.

## 10. Apollon public API findings

Verified in installed `@tumaet/apollon@5.3.0` public declarations and implementation:

- `labels` and `ApollonEditor.setLabels()` provide reactive public label overrides.
- `dataTheme` accepts `light` or `dark`.
- `subscribeToSelectionChange()` exposes selected element IDs.
- the public `model` getter/setter supports host-driven model replacement.
- `enablePopups` can disable the generic built-in property popup.
- public control composition exists, but no public field-editor/property-panel extension point was found.

The implementation uses only those public surfaces and the existing SW1 adapters. No dependency source or bundle was changed.

## 11. Localization limitations

Apollon has a public partial label dictionary, not a complete product translation framework. SW1 supplies verified Spanish labels for relevant editor chrome and uses Apollon's English defaults in English mode. The generic built-in popup is disabled; no DOM text replacement, MutationObserver, bundle patch or `node_modules` edit is used.

The language preference translates only static interface text owned by SW1. Project names, UML class/attribute/role data and other user content are never translated. Dynamic semantic, backend and provider messages remain exactly in the language returned by their source; SW1 does not attempt to infer or machine-translate them.

## 12. Theme limitations

Apollon accepts only the resolved `light`/`dark` value. SW1 resolves System mode and passes the result through `dataTheme`. The surrounding application uses its own CSS variables. No internal Apollon selectors are overridden for theming.

## 13. Canonical-model invariants

The only additive semantic field is the optional association name `RelacionUML.nombre`; older saved models remain valid. The canonical model exports readonly runtime tuples for visibility, relationship and multiplicity unions so UI options cannot drift. Translated labels never enter canonical values.

## 14. XMI compatibility

Imported unsupported attribute types remain visible and preserved. Manual restrictions do not rewrite or delete imported semantics. The shared XMI-facing TypeScript contract tolerates the canonical method field, but the bridge mapping and endpoints remain unchanged and do not claim operation round-trip support.

### Conceptual-model import stabilization

Real Enterprise Architect import evidence led to a focused usability correction. Structurally valid/editable UML is now distinct from completeness and Spring readiness: attributes without a visible EA type keep `tipo = null`, CU08 emits one summarized warning using references such as `Clase.atributo`, and CU09 reports missing or unsupported generation types separately. Representable associations, aggregation, composition and generalization remain in the canonical editable model even when the current generator says **No apto**. Relationship properties use a bounded summary list and expand only the selected relationship. Existing EA diagram coordinates continue to come from `DiagramClass`; deterministic fallback positions are used only when the XMI has no usable geometry.

### Relationship direction semantic stabilization

SW1 now has one explicit convention for every input channel. A canonical association is non-navigable; `claseOrigenId` and `claseDestinoId` identify its two ends without inventing an arrow. For aggregation and composition, origin is the **Part** and destination is the **Whole**. For generalization, origin is the **Subclass** and destination is the **Superclass**. This matches the verified Apollon 5.3.0 renderer, which places the hollow/filled diamond and hollow triangle at `markerEnd` (the target end). `ClassUnidirectional`, Apollon's default new class edge, is normalized through the public model to `ClassBidirectional`, because the canonical model has no navigability semantics.

The guided editor asks for Whole/Part or Subclass/Superclass instead of exposing source/target as the business decision. Generalization has no multiplicity controls. Multiplicity meanings remain association-end meanings and were not inverted by this correction. Focused fixtures verify: `Persona — Auto` as a plain association; `Jugador → Equipo` with the aggregation diamond beside Equipo; `DetallePedido → Pedido` with the composition diamond beside Pedido; and `Cliente → Persona` with the generalization triangle pointing to Persona.

XMI import normalizes an aggregation/composition end marked `shared`/`composite` so the discovered Whole becomes the canonical destination, swapping its paired role and multiplicity only when the source XML uses the opposite orientation. Generalization already enters as subclass to superclass. Plain association export does not invent `isNavigable=true`. This internal bridge evidence does not close the real Enterprise Architect gate `EA-XMI-001`.

## 15. Persistence compatibility

Project schema and explicit-save behavior are unchanged. Saved canonical name/type/visibility and multiplicities were verified after reopening. UI preferences remain in local storage only and require no project migration.

## 16. AI compatibility

Text and voice now share the expanded strict CU04 command vocabulary and assisted semantic normalizer. Deterministic tests and browser scenarios verify PascalCase class resolution, supported type casing, explicit `id: Long`, and method/parameter operations through the existing application path. The historical real-provider gate remains closed based on its prior connectivity/structured-output evidence; this stabilization does not claim that the newly added method commands were separately exercised against real Groq.

CU04 relationship commands now have parity with the canonical/manual relationship vocabulary. Association uses two non-navigable ends and permits unknown multiplicities as `null`; aggregation/composition use explicit `parteRef` and `todoRef`; generalization uses explicit `subclaseRef` and `superclaseRef` and cannot carry multiplicities. Ambiguous Whole/Part or Subclass/Superclass instructions must return `aclarar` with zero commands, so the existing atomic plan validation produces no mutation. Voice inherits these rules through the existing transcript-to-CU04 pipeline, without voice-specific relationship logic. These new relationship variants are verified deterministically and are not claimed as a new real-Groq acceptance execution.

CU05 provider behavior remains unchanged. Its visual-input profile deliberately remains limited to classes, attributes and associations; it does not infer aggregation, composition or generalization from images in this correction. Candidate/confirmation tests verify explicit-ID compatibility without inventing or repairing visual semantics.

## 17. Collaboration compatibility

The inspector applies through canonical-to-Apollon conversion, so existing Apollon/Yjs propagation remains the single live collaboration path. The collaboration scenario passed, including convergence and room isolation. No second document or synchronization mechanism was introduced.

## 18. Tests

- Focused property-inspector tests: PASS — 17/17; focused inspector/adapter set: PASS — 32/32.
- Complete frontend unit suite: PASS — 146/146 across 17 files.
- Complete backend unit suite: PASS — 156/156 across 17 files.
- Typecheck: PASS.
- Production build: PASS; the pre-existing Vite large-chunk warning remains non-blocking.
- Coverage includes compact attribute rows, temporary confirm/cancel creation, immediate deletion, blur/Enter name validation, authoritative type/visibility options, typo prevention, unsupported imported type preservation and intentional replacement, atomic relationship creation/deletion, exact canonical multiplicities/roles, English AI/voice/image presentation, Spanish restoration, preference persistence, corrupt-value fallbacks and canonical-model immutability under language changes.

## 19. E2E

Complete Playwright suite: PASS — 20/20. Evidence covers a real visible/selectable Apollon edge, the Persona/Auto asymmetric end semantics in both manual and CU04 flows, persistence without end swapping, collaboration of the same values, optional association name, controlled multiplicities, M:N canonical modeling with controlled non-generation feedback, and explicit `id: Long` generation with exactly one identity field. The CU04 scenarios also verify natural-language class/type normalization plus method/parameter creation and method deletion. Existing project lifecycle, voice, image, XMI and Spring-generation scenarios passed.

The E2E server command was made deterministic by running the backend `tsx` executable without watch mode; application runtime behavior is unchanged.

## 20. Files modified

- `README.md` — concise manual-modeling UX profile.
- `frontend/playwright.config.ts` — deterministic non-watch E2E backend process.
- `frontend/src/configuracion/PreferenciasUI.tsx` and test — typed language/theme preferences and Apollon labels.
- `frontend/src/nucleo/modelo_uml/ModeloUMLCanonico.ts` — exported readonly canonical vocabularies plus first-class method and parameter contracts.
- `frontend/src/App.tsx` and `frontend/src/styles.css` — global controls, theme variables and layout.
- `frontend/src/paquetes/modelado_uml/.../PaginaModeladoClases.tsx` — inspector composition and immediate host state update.
- `frontend/src/paquetes/modelado_uml/.../componentes/AnfitrionEditorApollon.tsx` and test — public labels/theme, disabled generic popup and safe public control composition without the placeholder-seeding palette.
- `frontend/src/paquetes/modelado_uml/.../componentes/InspectorPropiedadesUML.tsx` and test — guided class, attribute, method, parameter and relationship editing.
- `frontend/src/paquetes/modelado_uml/compartido/integracion_apollon/AdaptadorApollon.ts` and test — bidirectional operation-notation mapping through public Apollon model fields.
- `frontend/src/paquetes/validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.ts` and test — bounded method/parameter structural semantics without turning methods into a generation blocker.
- Backend canonical/persistence contracts, guards and tests — legacy-compatible storage and HTTP structural validation of methods and parameters; generation remains design-operation agnostic.
- CU04 backend/frontend contracts, executors, validation, prompt/schema and tests — assisted name/type normalization plus strict method/parameter commands.
- CU05 candidate confirmation and tests — explicit `id: Long` compatibility and atomic rejection of a wrong explicit-ID type.
- SW1-owned project, collaboration, AI, voice, image, XMI and generation panels — centralized user-facing labels.
- Playwright helpers/specifications — public guided UI interactions and new stabilization evidence.

## 21. Risks / limitations

- UML operation signatures and structured assisted commands are modeled, but method bodies, constructors, exceptions, generics and generated algorithms remain outside this bounded capability.
- Existing unsupported imported attribute types can be preserved or explicitly changed to a supported type, but cannot be newly created through the controlled selector.
- The generic Apollon palette is intentionally omitted because version 5.3.0 offers no public per-element filtering or default-data override. Public Zoom/MiniMap controls remain, and SW1's “Nueva clase” command is the single supported clean class-creation path.
- Full typography/localization inside every third-party-rendered diagram element is bounded by Apollon's public label surface.
- Apollon's class-diagram edge renderer does not visually render the generic middle association `data.label`; SW1 preserves and edits the association name in the canonical inspector instead of introducing a fake overlay.
- crunch_uml currently preserves supported endpoints, multiplicities and roles, but not the new optional association name.
- Composite-key, PK/FK and M:N Spring/JPA generation for the now-modeled associative class remain a future Patch B capability.
- The crunch_uml bridge does not currently preserve UML operations, and Apollon exposes no stable parameter IDs separate from operation notation.
- CU05 does not extract method signatures from images; its accepted visual profile remains classes, attributes and supported relationships.
- The new method-command vocabulary is verified deterministically but has not been separately exercised against the real Groq provider; the historical Groq acceptance evidence is not overstated.

## 22. Final stabilization status

PASS

The safe subset is implemented through public APIs and existing semantic boundaries. Clean manual class creation, explicit associative-class semantics, deterministic assisted class/type normalization, unambiguous UML association-end multiplicities, real UML operations/parameters, relationship edges, canonical M:N modeling and conventional explicit `id: Long` are verified. The historical full-regression evidence remains recorded above; Patch A additionally passed its focused canonical, inspector, CU04, CU08, persistence and CU09 checks plus both affected typechecks. No composite-key/M:N generation, inferred image association class, method bodies or private Apollon customization was introduced.
