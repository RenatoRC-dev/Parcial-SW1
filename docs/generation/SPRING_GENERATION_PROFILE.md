# Spring Generation Profile

This document is the explicit capability contract shared by review of the frontend readiness evaluator and the authoritative backend generator boundary. It does not create a shared runtime package: frontend rules provide immediate UX, while backend rules remain the safety authority.

## Supported

- Concrete classes with non-empty, category-unique canonical IDs.
- Independent entities.
- Scalar attributes from the documented type mapping.
- Association with multiplicities exactly `1 ↔ 0..*`.
- Either source/target orientation of that association.
- Optional valid endpoint roles using the opposite-end property convention.
- Deterministic role defaults when roles are absent.

## Not supported

- Abstract classes.
- Self-relations.
- `1 ↔ 1`, `0..1`, `1..*`, or many-to-many semantics.
- Aggregation, composition, or generalization generation.
- Relation fields colliding with `id`, scalar fields, or other relation fields.
- Entity names conflicting with supported Java type names.
- Blank or duplicate model-element IDs within their semantic namespace.

## Conformance matrix

| Scenario | Expected frontend readiness | Expected backend preparation |
|---|---|---|
| Independent concrete class | Supported | Supported |
| Association `1 → 0..*` | Supported | Supported |
| Reversed association `0..* → 1` | Supported | Supported |
| Association `1 → 1` | Rejected | Rejected |
| Association `0..* → 0..*` | Rejected | Rejected |
| Aggregation | Rejected | Rejected |
| Composition | Rejected | Rejected |
| Generalization | Rejected | Rejected |
| Self-relation | Rejected | Rejected |
| Scalar/relation field collision | Rejected | Rejected |
| Duplicate canonical IDs | Rejected through CU08 | Rejected through CU09 |

Tests on both sides use this matrix as their review checklist. The backend remains authoritative for every HTTP request.
