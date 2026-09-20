# Iteration 16 — Flutter Offline Persistence and Outbox

## 1. Objective

Extend the accepted Flutter local-AI scaffold so a validated `ComandoLocal` can perform a durable offline business operation and enqueue a durable synchronization intent without requiring Internet access.

Iteration 16 implements:

```text
Spanish instruction
  → on-device Qwen3
  → strict ComandoLocal validation
  → EjecutorComandoLocal
  → local repositories
  → SQLite transaction
  → entity + pending outbox operation
```

The accepted Iteration 15 model, prompt, inference isolation, and domain validator remain unchanged.

## 2. Architecture

- Presentation interprets the instruction, passes only a validated command to the executor, and renders the result.
- `EjecutorComandoLocal` owns command dispatch and transaction orchestration.
- Domain entities contain no SQL or Flutter plugin types.
- Repositories map domain entities to local tables.
- `BaseDatosLocal` is the only boundary that imports `sqflite`; it exposes an application-owned data-access and transaction contract.
- UUID creation, SQLite initialization, operation state, and the outbox pattern are reusable foundations. Cliente and Producto remain small demonstration adapters for the eventual exam domain.

The local LLM interprets intent only. It never executes SQL and never writes directly to persistence.

## 3. SQLite Schema

### `clientes_locales`

| Column | Type | Meaning |
|---|---|---|
| `id_local` | TEXT PK | Locally generated UUID |
| `nombre` | TEXT | Client name |
| `correo` | TEXT | Client email |
| `estado_sync` | TEXT | Initially `pendiente` |
| `creado_en` | TEXT | UTC ISO-8601 timestamp |

### `productos_locales`

| Column | Type | Meaning |
|---|---|---|
| `id_local` | TEXT PK | Locally generated UUID |
| `nombre` | TEXT | Product name |
| `precio` | REAL | Product price |
| `estado_sync` | TEXT | Initially `pendiente` |
| `creado_en` | TEXT | UTC ISO-8601 timestamp |

### `operaciones_pendientes`

| Column | Type | Meaning |
|---|---|---|
| `id` | TEXT PK | Operation UUID |
| `tipo` | TEXT | For example `crear_cliente` |
| `entidad` | TEXT | Logical entity name |
| `entidad_id_local` | TEXT | Local entity identity |
| `payload` | TEXT | JSON payload for future synchronization |
| `estado` | TEXT | `pendiente`, `sincronizando`, `sincronizada`, or `error` |
| `intentos` | INTEGER | Starts at zero |
| `ultimo_error` | TEXT nullable | Reserved for future synchronization |
| `creado_en` | TEXT | UTC ISO-8601 timestamp |

## 4. Command Execution

- `crear_cliente`: creates a local UUID, stores the client with `estado_sync=pendiente`, and enqueues exactly one `crear_cliente` operation.
- `crear_producto`: creates a local UUID, stores the product with `estado_sync=pendiente`, and enqueues exactly one `crear_producto` operation.
- `consultar_clientes`: reads durable local clients and creates no outbox operation.
- Invalid and unsupported model output is rejected by the existing validator before the executor is reached.

Each mutation inserts the entity and its outbox operation inside one SQLite transaction. If either insert fails, both are rolled back.

## 5. User Interface

The existing technical-spike screen now shows:

- local persistence readiness;
- `Pendientes de sincronización: N`;
- a local-save confirmation after mutations;
- locally stored client names and emails after `consultar_clientes`.

No new navigation or domain dashboard was introduced.

## 6. Automated Evidence

| Check | Result |
|---|---|
| `flutter pub get` | PASS |
| `flutter analyze` | PASS — no issues |
| Flutter tests | PASS — 20/20 |
| Android debug APK | PASS |

Focused SQLite tests use `sqflite_common_ffi` only as a development dependency. They prove client persistence, exact pending outbox creation, product persistence, read-only queries, unsupported-command safety, transaction rollback, and persistence after closing and reopening the database.

## 7. Dependencies

- Runtime: `sqflite`, `path`, `uuid`.
- Test only: `sqflite_common_ffi`.

No ORM, connectivity monitor, HTTP client, background service, or synchronization framework was introduced.

## 8. Limitations and Deferred Work

Not implemented in Iteration 16:

- Spring REST integration;
- outbox synchronization or delivery;
- connectivity/reconnect handling;
- retry policy and conflict resolution;
- background synchronization;
- local voice;
- final exam domain entities and screens.

Pending operations intentionally remain `pendiente` until a later synchronization iteration consumes them.

## 9. Physical Acceptance Gate

`FLUTTER-OFFLINE-PERSISTENCE-001` is `PASS — PHYSICAL OFFLINE PERSISTENCE ACCEPTED`.

### Physical Android evidence

The acceptance ran on a real Xiaomi ARM64 device with Android 16 / API 36, airplane mode enabled, the Qwen3 GGUF stored locally, and no Internet dependency.

1. SQLite initialized with zero pending operations.
2. `Registra a Ana con correo ana@correo.com` stored Ana locally and changed the pending count from zero to one.
3. `Muéstrame los clientes registrados` returned Ana and `ana@correo.com` from SQLite while the pending count remained one, proving that the query was read-only.
4. `Agrega un producto laptop con precio 3500` stored the product locally and changed the pending count from one to two.
5. After completely closing and reopening the application, persistence initialized successfully and the pending count remained two.
6. After reloading the local model, `Muéstrame los clientes registrados` still returned Ana and `ana@correo.com`; the pending count remained two. The observed inference time was approximately 28.383 seconds.

This physically proves durable SQLite persistence, offline client/product creation, transactional entity-plus-outbox creation, read-only local querying, durable business data and outbox records after application restart, and operation in airplane mode.

## 10. Final Status

PASS — PHYSICAL OFFLINE PERSISTENCE ACCEPTED
