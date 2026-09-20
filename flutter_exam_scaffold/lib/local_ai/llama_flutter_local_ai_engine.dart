import 'package:llama_flutter_android/llama_flutter_android.dart';
import 'package:sw1_local_ai_spike/local_ai/local_ai_engine.dart';

const prefijoRespuestaJsonLocal = '{"accion":"';

/// Construye el prompt Qwen3 sin depender de la plantilla ChatML genérica del
/// plugin. El bloque de razonamiento vacío es el interruptor estricto de modo
/// no-thinking de Qwen3; el prefijo solo fija la sintaxis, no la acción.
String construirPromptQwen3Local(LocalAiRequest request) {
  final sistema = _escaparMarcadoresChatMl(request.systemPrompt.trim());
  final usuario = _escaparMarcadoresChatMl(request.userPrompt.trim());
  return '<|im_start|>system\n$sistema<|im_end|>\n'
      '<|im_start|>user\n$usuario<|im_end|>\n'
      '<|im_start|>assistant\n'
      '<think>\n\n</think>\n\n'
      '$prefijoRespuestaJsonLocal';
}

String _escaparMarcadoresChatMl(String texto) => texto.replaceAll('<|', '< |');

/// Ejecuta una inferencia como operación independiente. La limpieza debe
/// terminar antes de emitir el prefijo o comenzar a decodificar el nuevo prompt.
Stream<String> generarConContextoLimpio({
  required Future<void> Function() limpiarContexto,
  required Stream<String> Function() generar,
}) async* {
  await limpiarContexto();
  yield prefijoRespuestaJsonLocal;
  yield* generar();
}

/// Única frontera que conoce el plugin llama.cpp.
final class LlamaFlutterLocalAiEngine implements LocalAiEngine {
  LlamaFlutterLocalAiEngine({LlamaController? controller})
    : _controller = controller ?? LlamaController();
  final LlamaController _controller;

  @override
  Future<void> loadModel(String path) =>
      _controller.loadModel(modelPath: path, threads: 4, contextSize: 2048);

  @override
  Stream<String> generate(LocalAiRequest request) => generarConContextoLimpio(
    limpiarContexto: _controller.clearContext,
    generar: () => _controller.generate(
      prompt: construirPromptQwen3Local(request),
      maxTokens: request.maxOutputTokens,
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
      minP: 0.0,
      repeatPenalty: 1.05,
      seed: 42,
    ),
  );

  @override
  Future<void> dispose() => _controller.dispose();
}
