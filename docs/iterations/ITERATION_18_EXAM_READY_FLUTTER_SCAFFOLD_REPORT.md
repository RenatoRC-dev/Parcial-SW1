# Iteration 18 — Exam-Ready Flutter Scaffold and Rapid Domain Adaptation

## 1. Objective

Reduce exam-day adaptation risk without turning the Flutter scaffold into a dynamic CRUD framework. The accepted Cliente/Producto behavior remains the executable regression baseline.

## 2. Coupling audit

The audit found domain assumptions in the expected boundaries:

- local-AI action names, prompt examples and intent descriptions;
- command enum and strict parameter validation;
- Cliente/Producto domain models;
- SQLite tables, columns and repositories;
- command dispatch, result messages and outbox payloads;
- generated Spring API methods, routes and request bodies;
- synchronization dispatch/entity marking;
- domain result rendering and focused tests.

Local model execution, JSON extraction, SQLite bootstrap/transaction pattern, durable outbox mechanics, URL persistence, FIFO synchronization, retry/error policy, and synchronization counters are reusable infrastructure.

## 3. Focused refactor

`ConfiguracionDominioExamen` centralizes only identifiers duplicated across boundaries:

- application display name;
- command wire names;
- outbox entity names;
- generated backend routes.

The prompt, validator, executor, synchronization service, HTTP adapter, and visible command label reuse those constants. SQL schema and business rules remain explicit Dart/SQL code. No reflection, schema JSON, dynamic CRUD engine, state framework, or runtime metamodel was introduced.

## 4. Adaptation boundary

On exam day, infrastructure should remain stable while these explicit areas change:

1. configuration constants;
2. action enum, prompt and validator;
3. domain entities;
4. SQLite schema/migration and repositories;
5. command executor/outbox payloads;
6. `BackendApi` and actual generated endpoint mapping;
7. synchronization dispatch;
8. domain result rendering;
9. focused tests.

The detailed Cliente/Producto → Paciente/Consulta example is recorded in `docs/exam/FLUTTER_DOMAIN_ADAPTATION_GUIDE.md`.

## 5. Exam documentation

- `FLUTTER_DOMAIN_ADAPTATION_GUIDE.md`: coupling map, safe change points, example transformation and fastest validation order.
- `EXAM_RUNBOOK.md`: laptop, SW1, generated Spring, PostgreSQL, LAN, Android, offline/reconnect acceptance and troubleshooting commands.
- `EXAM_DAY_CHECKLIST.md`: short printable checklist for equipment, build, offline evidence, sync and defense.

## 6. Reproducibility

Versioned project inputs include Dart/Flutter source, `pubspec.yaml`, dependency lock, Android Gradle configuration/wrapper, manifests, tests, model-provisioning instructions and iteration documentation.

Intentionally not versioned and requiring local provisioning:

- `Qwen3-0.6B-Q4_0.gguf` or other GGUF weights;
- PostgreSQL passwords and other secrets/environment values;
- Android `local.properties` with machine SDK paths;
- APKs, Gradle/Flutter build outputs and caches;
- backend `.env` and machine-specific acceptance settings.

The root and Flutter/Android ignore rules were checked: GGUF, build output, `local.properties`, and backend `.env` are excluded. Generated APKs and model weights remain outside Git.

## 7. Verification

| Check | Result |
|---|---|
| `flutter analyze` | PASS — no issues |
| `flutter test` | PASS — 29/29 |
| `flutter build apk --debug` | PASS |
| APK | `flutter_exam_scaffold/build/app/outputs/flutter-apk/app-debug.apk` |

No backend source changed, so backend tests/typecheck were not rerun. The generated Cliente/Producto REST contract remains unchanged.

## 8. Scope and remaining risks

Iteration 18 adds no runtime capability and requires no new physical gate. Iterations 15–17 remain accepted.

Remaining exam risks are operational: time needed to adapt an unknown domain, complexity beyond the small supported command set, device/USB restrictions, LAN/firewall configuration, local secrets, and the existing non-idempotent remote POST crash window. Automatic reconnect, background sync, conflict resolution, bidirectional sync, local voice and generic schema-driven Flutter generation remain out of scope.

## 9. Final status

**PASS — EXAM-READY SCAFFOLD AND ADAPTATION MATERIAL VERIFIED**
