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
