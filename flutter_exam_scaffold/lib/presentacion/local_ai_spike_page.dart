import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sw1_local_ai_spike/aplicacion/interpretador_comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/local_ai/local_ai_engine.dart';

const nombreModelo = 'Qwen3-0.6B-Q4_0.gguf';

class LocalAiSpikePage extends StatefulWidget {
  const LocalAiSpikePage({required this.engine, super.key});
  final LocalAiEngine engine;
  @override
  State<LocalAiSpikePage> createState() => _LocalAiSpikePageState();
}

class _LocalAiSpikePageState extends State<LocalAiSpikePage> {
  final _instruccion = TextEditingController(
    text: 'Registra a Ana con correo ana@correo.com',
  );
  String? _rutaModelo;
  bool _cargando = false, _cargado = false, _generando = false;
  Duration? _tiempoCarga;
  ResultadoInterpretacionLocal? _resultado;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prepararRuta();
  }

  Future<void> _prepararRuta() async {
    final base = await getExternalStorageDirectory();
    if (base == null) {
      if (mounted) {
        setState(
          () => _error =
              'Android no proporcionó almacenamiento local para la aplicación.',
        );
      }
      return;
    }
    final modelos = Directory('${base.path}/models');
    await modelos.create(recursive: true);
    if (mounted) setState(() => _rutaModelo = '${modelos.path}/$nombreModelo');
  }

  Future<void> _cargarModelo() async {
    final ruta = _rutaModelo;
    if (ruta == null || _cargando) return;
    setState(() {
      _cargando = true;
      _error = null;
    });
    final reloj = Stopwatch()..start();
    try {
      if (!await File(ruta).exists()) {
        throw ErrorComandoLocal('No se encontró el modelo local en $ruta');
      }
      await widget.engine.loadModel(ruta);
      reloj.stop();
      if (mounted) {
        setState(() {
          _cargado = true;
          _tiempoCarga = reloj.elapsed;
        });
      }
    } catch (error) {
      reloj.stop();
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _interpretar() async {
    if (!_cargado || _generando) return;
    setState(() {
      _generando = true;
      _resultado = null;
      _error = null;
    });
    try {
      final resultado = await InterpretadorComandoLocal(
        widget.engine,
      ).interpretar(_instruccion.text);
      if (mounted) setState(() => _resultado = resultado);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _generando = false);
    }
  }

  @override
  void dispose() {
    _instruccion.dispose();
    widget.engine.dispose();
    super.dispose();
  }

  String _accion(TipoAccionLocal accion) => switch (accion) {
    TipoAccionLocal.crearCliente => 'crear_cliente',
    TipoAccionLocal.crearProducto => 'crear_producto',
    TipoAccionLocal.consultarClientes => 'consultar_clientes',
  };

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('IA LOCAL — PRUEBA TÉCNICA')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Modelo: ${_cargado ? 'Cargado' : 'No cargado'}'),
        const Text('Dependencia de Internet: Ninguna — Local'),
        const SizedBox(height: 8),
        SelectableText(
          _rutaModelo ?? 'Preparando ubicación local…',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        FilledButton(
          onPressed: _cargando || _cargado ? null : _cargarModelo,
          child: Text(_cargando ? 'Cargando…' : 'Cargar modelo local'),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _instruccion,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Instrucción',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: !_cargado || _generando ? null : _interpretar,
          child: Text(_generando ? 'Interpretando…' : 'Interpretar localmente'),
        ),
        const SizedBox(height: 20),
        Text('Resultado', style: Theme.of(context).textTheme.titleLarge),
        if (_resultado case final resultado?) ...[
          Text('Acción: ${_accion(resultado.comando.accion)}'),
          const Text('Parámetros:'),
          ...resultado.comando.parametros.entries.map(
            (entrada) => Text('${entrada.key} = ${entrada.value}'),
          ),
        ],
        if (_error case final error?)
          Text(
            error,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        const SizedBox(height: 20),
        Text('Carga del modelo: ${_tiempoCarga?.inMilliseconds ?? '—'} ms'),
        Text('Inferencia: ${_resultado?.duracion.inMilliseconds ?? '—'} ms'),
      ],
    ),
  );
}
