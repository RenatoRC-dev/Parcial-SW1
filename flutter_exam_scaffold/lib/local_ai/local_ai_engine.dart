class LocalAiRequest {
  const LocalAiRequest({
    required this.systemPrompt,
    required this.userPrompt,
    this.contextSize = 2048,
    this.maxOutputTokens = 160,
    this.temperature = 0.1,
  });
  final String systemPrompt;
  final String userPrompt;
  final int contextSize;
  final int maxOutputTokens;
  final double temperature;
}

abstract interface class LocalAiEngine {
  Future<void> loadModel(String path);
  Stream<String> generate(LocalAiRequest request);
  Future<void> dispose();
}
