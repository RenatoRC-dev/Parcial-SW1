# Iteration 17 — Flutter Outbox Sync to Generated Spring Boot and PostgreSQL

## 1. Objective and status

Extend the accepted offline Flutter flow with explicit delivery of durable outbox operations to a backend produced by the existing SW1 Spring generator:

```text
validated ComandoLocal
  → SQLite entity + outbox
  → Sincronizar ahora
  → BackendApi
  → generated Spring Boot REST API
  → PostgreSQL
```

Current status: **COMPLETE / PASS — PHYSICAL END-TO-END SYNC ACCEPTED**.

The Flutter implementation, generated backend, LAN delivery, retry path, and real PostgreSQL persistence were verified. Physical acceptance used a real Xiaomi Android device, the generated SW1 Spring Boot backend, and database `sw1_flutter_sync`.

## 2. Generated backend and actual REST contract

The proof generates its backend through the production `generarProyectoSpring` use case from the focused `fixtureClienteProducto`; it does not maintain a handcrafted Spring application.

- Generated proof path: `backend/generated-test-output/flutter-sync-proof/backend-generado`
- Cliente route: `POST /api/cliente`
- Cliente request: `{"nombre":"Ana","correo":"ana@correo.com"}`
- Producto route: `POST /api/producto`
- Producto request: `{"nombre":"Laptop","precio":3500}`
- Successful status: HTTP `201 Created`
- Response identity: generated entity field `id` of type `Long`
- PostgreSQL tables: `cliente` and `producto`

The runtime proof command is `npm run proof:flutter-sync:postgres`. It generates the project, runs `mvnw.cmd clean test`, starts the generated application, invokes both real routes, and verifies the created rows directly in PostgreSQL when the database credential is present.

## 3. Flutter architecture

- Existing `EjecutorComandoLocal` remains responsible only for offline local execution.
- `RepositorioOutbox` selects eligible `pendiente` and `error` operations in FIFO order by `creado_en`, with ID as a deterministic tie-breaker.
- `ServicioSincronizacion` orchestrates delivery and local result recording.
- `BackendApi` is application-owned and hides HTTP details.
- `HttpBackendApi` maps the two supported outbox operations to the generated REST contract.
- Widgets configure and invoke synchronization but do not contain HTTP, SQL, or retry business logic.
- Synchronization never loads or invokes the local AI model.

## 4. Non-destructive SQLite migration

The database moves from version 1 to version 2 without dropping tables or rows:

- `clientes_locales.id_remoto TEXT NULL`
- `productos_locales.id_remoto TEXT NULL`
- new `configuracion_local(clave TEXT PRIMARY KEY, valor TEXT NOT NULL)` table

Existing Iteration 16 entities and pending operations remain intact. A focused migration test constructs a version-1 database, reopens it with the version-2 implementation, and verifies preservation of the existing client plus the new columns/configuration table.

## 5. Synchronization algorithm

1. Read one FIFO snapshot of eligible pending/retryable-error operations.
2. Map `crear_cliente` or `crear_producto` to the generated route and request body.
3. Require a 2xx response with a numeric remote `id`.
4. In one local SQLite transaction, save `id_remoto`, mark the entity `sincronizada`, mark the outbox row `sincronizada`, and clear `ultimo_error`.
5. Exclude synchronized operations from all later runs.

A read-only `consultar_clientes` command never creates an outbox operation and therefore causes no remote mutation.

## 6. Failure and retry policy

Network errors, timeout, non-2xx responses, or invalid response identities leave local business data untouched. The outbox row changes to `error`, increments `intentos`, and stores a bounded useful error. Error rows are retryable during a later explicit synchronization. One failed operation does not delete or prevent later local data from being processed.

No automatic background/reconnect retry is implemented. A crash after the remote POST succeeds but before the local success transaction commits can cause a repeated POST because the generated API currently has no idempotency-key contract; this remains a documented limitation.

## 7. User interface

The existing technical screen adds only:

- a persisted, validated backend base URL;
- `Guardar URL`;
- `Sincronizar ahora`;
- counts for pending, synchronized, and error operations;
- the last synchronization result.

The URL is not hardcoded, so a physical device can use the laptop's LAN address. Android declares Internet access and permits cleartext HTTP for the local academic LAN acceptance environment.

## 8. Automated evidence

| Check | Result |
|---|---|
| `flutter pub get` | PASS |
| `flutter analyze` | PASS — no issues |
| `flutter test` | PASS — 29/29 |
| `flutter build apk --debug` | PASS |
| Backend `npm run typecheck` | PASS |
| Generated `mvnw.cmd clean test` | PASS |
| PostgreSQL reachability | PASS — server responded on `127.0.0.1:5432` |
| Generated Spring start and REST inserts | PASS — confirmed during physical acceptance |
| Direct PostgreSQL row verification | PASS — `cliente` and `producto` rows confirmed |

The automated proof initially recorded a credential-blocked execution because `SW1_PG_PASSWORD` was unavailable to that Codex session. The subsequent physical acceptance supplied the real runtime evidence: the generated backend ran against PostgreSQL and both generated REST routes persisted rows. The historical blocked JSON must not be confused with the later successful physical acceptance.

Focused Flutter coverage proves Cliente and Producto success, persisted remote IDs, synchronized-state transitions, no resend, failure preservation, attempt/error recording, later retry success, continuation after one failure, URL persistence, real HTTP route/body mapping, controlled HTTP errors, and non-destructive migration.

## 9. Physical acceptance evidence

Gate `FLUTTER-SPRING-SYNC-001` is **PASS — PHYSICAL END-TO-END SYNC ACCEPTED**.

Environment:

- real Xiaomi Android device running the Flutter application;
- local SQLite database and durable outbox;
- generated SW1 Spring Boot backend available over LAN at `http://192.168.0.8:8080`;
- PostgreSQL database `sw1_flutter_sync`;
- generated routes `POST /api/cliente` and `POST /api/producto`.

The phone contained the two offline Iteration 16 operations for Ana and Laptop. Initial synchronization attempts used an incorrect backend URL and moved both operations to `error`: pending zero, synchronized zero, errors two. Local entities and outbox records remained intact.

After correcting the URL, an explicit retry completed both operations: pending zero, synchronized two, errors zero. This proves retry after network/configuration failure, remote-ID handling, local synchronized-state recording, and delivery without loading the local AI model.

Direct PostgreSQL inspection showed:

- `cliente`: IDs 1 and 2, both Ana / `ana@correo.com`;
- `producto`: IDs 1 and 2, both Laptop / 3500.

One dataset came from the backend PostgreSQL proof and the other from physical Flutter synchronization. These rows are independent acceptance datasets, not evidence of a mobile resend defect.

After successful synchronization, another manual sync returned `0 operaciones sincronizadas correctamente`; PostgreSQL counts remained two clients and two products. After completely closing and reopening Flutter, the state remained pending zero, synchronized two, errors zero. A further sync again returned zero synchronized operations with unchanged database counts. Synchronized outbox operations therefore survive restart and are not resent.

## 10. Limitations

Not implemented in this iteration:

- automatic background or reconnect synchronization;
- update/delete synchronization;
- bidirectional server-to-mobile synchronization;
- conflict resolution;
- authentication redesign;
- delivery idempotency keys;
- local voice;
- public cloud deployment.

Same-LAN operation is the intended acceptance environment.

The crash-window/idempotency risk remains non-blocking: if the server commits a POST and Flutter terminates before its local success transaction commits, a later retry can duplicate the remote creation because the generated API has no idempotency-key contract.

## 11. Final status

**COMPLETE / PASS — PHYSICAL END-TO-END SYNC ACCEPTED**
