# Iteration 15 — Flutter On-Device AI Technical Spike

## 1. Objective

Prove the technical foundation for a future exam application:

Flutter → local GGUF model → on-device inference → bounded JSON → deterministic validation.

This iteration does not implement the final exam domain, synchronization, SQLite, voice, cloud AI, or a backend connection.

## 2. Chosen Runtime

The spike pins `llama_flutter_android` `0.2.6`, a Flutter binding over llama.cpp with token streaming. Its published requirements are Flutter 3.24+, Dart 3.3+, Android API 26+, NDK r27+, and ARM64. The local environment uses Flutter 3.35.4, Dart 3.9.2, and Android SDK 36.1.

Plugin types are isolated in `LlamaFlutterLocalAiEngine`. Application and domain code depend only on the application-owned `LocalAiEngine` interface.

Android is intentionally restricted to `arm64-v8a`. Kotlin incremental compilation is disabled in this scaffold because the Windows build has the Pub cache on `C:` and the repository on `D:`, which otherwise causes a cross-root incremental-cache warning and fallback.

## 3. Chosen Model

- Repository: `ggml-org/Qwen3-0.6B-GGUF`
- Filename: `Qwen3-0.6B-Q4_0.gguf`
- Quantization: Q4_0
- Published approximate size: 429 MB
- Expected device location: application-specific external storage under `files/models/Qwen3-0.6B-Q4_0.gguf`
- SHA256: pending; it must be calculated from the exact file provisioned for physical acceptance.

GGUF and binary weights are ignored by Git and are not bundled in the APK. The application performs no model download.

## 4. Architecture

```text
Flutter technical-spike screen
        ↓
InterpretadorComandoLocal
        ↓
LocalAiEngine
        ↓
LlamaFlutterLocalAiEngine
        ↓
llama_flutter_android / llama.cpp
        ↓
raw streamed text
        ↓
JSON extraction and deterministic validation
        ↓
ComandoLocal or controlled failure
```

Inference uses a 2048-token context, maximum 160 output tokens and deterministic greedy sampling. The adapter now builds the Qwen3 ChatML prompt itself and places `<think>\n\n</think>\n\n` at the start of the assistant turn. This is Qwen3's hard non-thinking switch; it replaces the ineffective duplicated `/no_think` soft instructions used in the first physical attempt.

The prompt ends with the neutral response prefill `{"accion":"`. The adapter restores that same prefix in the streamed response, while Qwen must still choose the action and extract every parameter. The prefill cannot turn an invented value such as `correcto` into a valid command: the strict domain whitelist still rejects it.

The public custom-template mechanism in `llama_flutter_android` was inspected but not used. In version `0.2.6`, its raw template formatter applies the whole template independently to each message and replaces only the placeholder matching that message's role. It is therefore not a reliable way to compose the required Qwen3 system/user/generation prompt. No Pub cache or plugin native source was modified.

## 5. Command Contract

Allowed actions are:

- `crear_cliente(nombre, correo)`
- `crear_producto(nombre, precio)`
- `consultar_clientes()`

The Dart domain represents them with `TipoAccionLocal` and `ComandoLocal`. The LLM never executes the command.

## 6. Deterministic Output Validation

After inference, the application extracts one JSON object, parses it, validates the action whitelist, requires exact top-level and parameter keys, validates field types and required values, and rejects malformed JSON, unsupported actions, missing parameters, wrong types, or extra tool/executable fields.

These rules are tested without loading the GGUF model.

## 7. Minimal UX

The single screen shows model status, explicit lack of Internet dependency, expected local model path, instruction input, local interpretation action, validated action/parameters, model-load time, and inference time.

## 8. Model Provisioning

1. Obtain `Qwen3-0.6B-Q4_0.gguf` manually from the documented model repository.
2. Place it in `flutter_exam_scaffold/models/` locally; Git ignores it.
3. Install and open the application once so Android creates its external files directory.
4. Use the ADB command documented in `flutter_exam_scaffold/models/README.md` to copy the model to `files/models/`.
5. Calculate the real file SHA256 and record it with the physical evidence.

Runtime Internet access is not needed after provisioning.

## 9. Automated Evidence

| Check | Result |
|---|---|
| `flutter analyze` | PASS — no issues |
| Focused deterministic tests | PASS — 14/14 |
| Android ARM64 debug APK build | PASS |
| APK | `build/app/outputs/flutter-apk/app-debug.apk` |
| GGUF included in Git/APK | NO |

The initial native build took approximately 656 seconds and included Android Platform 35 installation plus first-time llama.cpp compilation. This is build time, not model-load or inference performance.

## 10. Physical Offline Acceptance Procedure

1. Use a real ARM64 Android device and record its model, Android version, and ABI.
2. Install the debug APK.
3. Provision the GGUF file locally and record its byte size and SHA256.
4. Open the app and load the model; record load time.
5. Enable airplane mode and explicitly disable Wi-Fi and mobile data.
6. Enter `Registra a Ana con correo ana@correo.com` and require a valid `crear_cliente` command.
7. Enter `Agrega un producto Teclado que cuesta 150` and require a valid `crear_producto` command.
8. Record inference elapsed time for both commands, success/failure, and generated token count/tokens per second only if exposed by the runtime.
9. Confirm zero HTTP/API calls.

Target latency is preferably under about five seconds, but measurements must be reported honestly and are not fabricated as a PASS condition.

## 11. Measured Physical Evidence

### Physical attempt 1 — partial technical success, semantic failure

- Device: Xiaomi, Android 16 / API 36, ARM64.
- Model: `Qwen3-0.6B-Q4_0.gguf`, 428,970,080 bytes.
- Device path: `/storage/emulated/0/Android/data/com.sw1.sw1_local_ai_spike/files/models/Qwen3-0.6B-Q4_0.gguf`.
- Model load: successful, observed around 2–3 seconds.
- Airplane-mode inference: successful; local execution without Internet was demonstrated.
- Input: `Registra a Ana con correo ana@correo.com`.
- Semantic result: FAIL. The reasoning identified `crear_cliente`, but the final object emitted `{"accion":"correcto","parametros":{}}` and the strict validator correctly rejected it.

Longer prompt instructions and deterministic sampling did not correct that emission. `llama_flutter_android` `0.2.6` exposes neither grammar nor JSON-schema constrained decoding through `generateChat`. Its built-in Qwen selection uses generic ChatML and has no dedicated Qwen3 hard non-thinking template. These facts motivated the application-owned Qwen3 prompt construction described above.

The Xiaomi may suspend or terminate the development connection when the application is backgrounded; previous `Lost connection to device` events are not treated as inference crashes.

Generated-token count and tokens/second remain unavailable through the abstraction currently used. SHA256 remains to be recorded from the exact provisioned model file.

### Physical Test 2.0 — command emission passed; session isolation failed

The corrected prompt produced the first three commands successfully and offline, in sequence:

1. `Registra a Ana con correo ana@correo.com` → `crear_cliente`, starting around `g_n_past=202`.
2. `Agrega un producto laptop con precio 3500` → `crear_producto`, starting around `g_n_past=424`.
3. `Muéstrame los clientes registrados` → `consultar_clientes`, starting around `g_n_past=642`.

The fourth input, `Envíame un correo a Carlos mañana`, should have been unsupported. With the accumulated context around `g_n_past=852`, Qwen instead hallucinated `crear_cliente` with invented data for Carlos. After completely closing and reopening the application, the same unsupported input was the first inference, started around `g_n_past=200`, and was correctly rejected as unsupported.

Source inspection confirmed that `llama_flutter_android` retains generated prompts and responses in a global native KV cache for chat use. The public `clearContext()` operation removes sequence 0 and resets `g_n_past` to zero without unloading the GGUF model. The SW1 adapter now calls it before every generation because each business command is an independent interpretation, not a chat turn.

### Physical Test 2.1 — PASS

Physical Test 2.1 ran on the real Xiaomi ARM64 device with Android 16 / API 36, the GGUF stored locally, airplane mode enabled, and no Groq, remote API, or PC-hosted inference. The same loaded model remained resident throughout the sequence; before every independent request the logs confirmed `Context cleared, g_n_past reset to 0`, so prompt decoding no longer inherited previous commands.

| Instruction | Validated result | Observed time | Result |
|---|---|---:|---|
| `Registra a Ana con correo ana@correo.com` | `crear_cliente`, `nombre=Ana`, `correo=ana@correo.com` | approximately 30.899 s in the previous physical run | PASS |
| `Agrega un producto laptop con precio 3500` | `crear_producto`, `nombre=Laptop`, `precio=3500` | 26.136 s | PASS |
| `Muéstrame los clientes registrados` | `consultar_clientes`, empty parameters | 21.987 s | PASS |
| `Envíame un correo a Carlos mañana` | controlled `no_soportada`; no invented client or email | UI displays `- ms` | PASS |

The unsupported request passed after the other three commands without restarting the application. This directly closes the regression seen before `clearContext()`, when `g_n_past` accumulated approximately 202 → 424 → 642 → 852 and the same request hallucinated `crear_cliente`, Carlos, and `carlos@correo.com`.

The `- ms` value is a minor observability/UI limitation: an unsupported result exits through the validator/error path rather than producing a normal `ResultadoInterpretacionLocal`. It does not invalidate the completed local inference or its safe rejection.

The accepted Iteration 15 scope is now proven: the local GGUF loads on physical Android, inference works in airplane mode, Spanish business commands produce strictly validated structured actions, unsupported commands are rejected, and the KV/context is isolated between requests while the model remains loaded.

## 12. Limitations

- Unsupported-result duration is displayed as `- ms`; exposing elapsed inference time on the validator/error path is a minor non-blocking follow-up.
- The package is Android/ARM64-specific and pre-1.0.
- The spike does not execute validated commands or persist domain data.
- SQLite, REST synchronization, offline queueing, and local voice remain outside this spike and belong to later iterations.
- Observed inference latency is well above the aspirational five-second target, but it does not block the technical offline-inference acceptance.

## 13. Final Status

PASS — PHYSICAL OFFLINE AI ACCEPTED
