# Modelo local (no versionado)

El spike usa `Qwen3-0.6B-Q4_0.gguf`, publicado en `ggml-org/Qwen3-0.6B-GGUF` y con un tamaño aproximado de 429 MB.

Los archivos `.gguf` y `.bin` de este directorio están ignorados por Git. El modelo no se empaqueta como asset: debe copiarse al almacenamiento externo específico de la aplicación Android, dentro de `files/models/`.

Después de instalar y abrir una vez la aplicación:

```powershell
adb push .\models\Qwen3-0.6B-Q4_0.gguf /sdcard/Android/data/com.sw1.sw1_local_ai_spike/files/models/Qwen3-0.6B-Q4_0.gguf
```

Calcular y registrar el SHA256 del archivo realmente usado:

```powershell
Get-FileHash .\models\Qwen3-0.6B-Q4_0.gguf -Algorithm SHA256
```

La aplicación muestra la ruta exacta esperada en el dispositivo. Ningún peso se descarga durante la ejecución.

## Modelo local de voz (Whisper tiny para sherpa-onnx)

La entrada de voz usa `sherpa_onnx 1.13.8` y el modelo multilingüe
`sherpa-onnx-whisper-tiny`. Solo requiere estos archivos cuantizados (unos
99 MB en total):

- `tiny-encoder.int8.onnx` (aprox. 12 MB)
- `tiny-decoder.int8.onnx` (aprox. 86 MB)
- `tiny-tokens.txt` (aprox. 0,8 MB)

Descargar fuera del examen el artefacto oficial
`https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2`, extraerlo y
copiar esos tres archivos a:

```text
/storage/emulated/0/Android/data/com.sw1.sw1_local_ai_spike/files/models/sherpa-onnx-whisper-tiny/
```

Ejemplo de aprovisionamiento:

```powershell
adb shell mkdir -p /sdcard/Android/data/com.sw1.sw1_local_ai_spike/files/models/sherpa-onnx-whisper-tiny
adb push .\models\sherpa-onnx-whisper-tiny\tiny-encoder.int8.onnx /sdcard/Android/data/com.sw1.sw1_local_ai_spike/files/models/sherpa-onnx-whisper-tiny/
adb push .\models\sherpa-onnx-whisper-tiny\tiny-decoder.int8.onnx /sdcard/Android/data/com.sw1.sw1_local_ai_spike/files/models/sherpa-onnx-whisper-tiny/
adb push .\models\sherpa-onnx-whisper-tiny\tiny-tokens.txt /sdcard/Android/data/com.sw1.sw1_local_ai_spike/files/models/sherpa-onnx-whisper-tiny/
Get-FileHash .\models\sherpa-onnx-whisper-tiny\* -Algorithm SHA256
```

Registrar los tres SHA-256 obtenidos junto con la evidencia física. Los pesos
ONNX, ZIP y directorios Vosk/Whisper locales están ignorados por Git. El
runtime no contiene descarga ni fallback de red: si falta un archivo, la voz
queda marcada como no disponible.
