import 'package:flutter/material.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/local_ai/llama_flutter_local_ai_engine.dart';
import 'package:sw1_local_ai_spike/presentacion/local_ai_spike_page.dart';

void main() => runApp(const LocalAiSpikeApp());

class LocalAiSpikeApp extends StatelessWidget {
  const LocalAiSpikeApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: ConfiguracionDominioExamen.nombreAplicacion,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff315da8)),
      useMaterial3: true,
    ),
    home: LocalAiSpikePage(engine: LlamaFlutterLocalAiEngine()),
  );
}
