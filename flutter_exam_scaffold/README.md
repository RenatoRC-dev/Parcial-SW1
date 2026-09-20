# SW1 Flutter local-AI spike

Foundation isolated from the CASE web application to prove real Android on-device GGUF inference.

## Runtime

- Flutter/Dart code depends on the application-owned `LocalAiEngine` abstraction.
- `LlamaFlutterLocalAiEngine` is the only class coupled to `llama_flutter_android` `0.2.6`.
- Android API 26+, ARM64, llama.cpp through the plugin.
- Context: 2048 tokens; maximum output: 160 tokens; temperature: 0.1; ChatML and `/no_think`.

## Model

Provision `Qwen3-0.6B-Q4_0.gguf` as described in [models/README.md](models/README.md). Model weights are not committed or bundled.

## Verification

```powershell
flutter analyze
flutter test test/validador_comando_local_test.dart
flutter build apk --debug --target-platform android-arm64
```

The deterministic tests validate model output without loading GGUF weights. Physical offline acceptance still requires an ARM64 Android device and airplane mode.
