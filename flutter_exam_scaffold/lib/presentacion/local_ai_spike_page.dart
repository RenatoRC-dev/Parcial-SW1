import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sw1_local_ai_spike/aplicacion/ejecutor_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/interpretador_comando_local.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/local_ai/local_ai_engine.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';
import 'package:sw1_local_ai_spike/persistencia/cliente_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/configuracion_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/outbox_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/producto_local_repository.dart';
import 'package:sw1_local_ai_spike/sincronizacion/http_backend_api.dart';
import 'package:sw1_local_ai_spike/sincronizacion/servicio_sincronizacion.dart';

const nombreModelo = 'Qwen3-0.6B-Q4_0.gguf';

class LocalAiSpikePage extends StatefulWidget {
  const LocalAiSpikePage({required this.engine, this.baseDatos, super.key});
  final LocalAiEngine engine;
  final BaseDatosLocal? baseDatos;
  @override
  State<LocalAiSpikePage> createState() => _LocalAiSpikePageState();
}

class _LocalAiSpikePageState extends State<LocalAiSpikePage> {
  final _instruccion = TextEditingController(
    text: 'Registra a Ana con correo ana@correo.com',
  );
  final _backendUrl = TextEditingController();
  String? _rutaModelo;
  bool _cargando = false, _cargado = false, _generando = false;
  Duration? _tiempoCarga;
  ResultadoInterpretacionLocal? _resultado;
  ResultadoEjecucionLocal? _ejecucion;
  String? _error;
  late final BaseDatosLocal _baseDatos;
  late final ClienteLocalRepository _clientes;
  late final ProductoLocalRepository _productos;
  late final OutboxRepository _outbox;
  late final ConfiguracionLocalRepository _configuracion;
  late final EjecutorComandoLocal _ejecutor;
  bool _persistenciaLista = false, _sincronizando = false;
  int _pendientes = 0, _sincronizadas = 0, _erroresSync = 0;
  String? _ultimoSync;

  @override
  void initState() {
    super.initState();
    _baseDatos = widget.baseDatos ?? BaseDatosLocal();
    _clientes = ClienteLocalRepository(_baseDatos);
    _productos = ProductoLocalRepository(_baseDatos);
    _outbox = OutboxRepository(_baseDatos);
    _configuracion = ConfiguracionLocalRepository(_baseDatos);
    _ejecutor = EjecutorComandoLocal(
      baseDatos: _baseDatos,
      clientes: _clientes,
      productos: _productos,
      outbox: _outbox,
    );
    _prepararRuta();
    _prepararPersistencia();
  }

  Future<void> _prepararPersistencia() async {
    try {
      await _baseDatos.abrir();
      final url = await _configuracion.obtenerBackendUrl();
      final conteos = await _obtenerConteos();
      if (mounted) {
        setState(() {
          _persistenciaLista = true;
          _backendUrl.text = url ?? '';
          _aplicarConteos(conteos);
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = 'No se pudo abrir SQLite: $error');
    }
  }

  Future<List<int>> _obtenerConteos() async => [
    await _outbox.contarPendientes(),
    await _outbox.contarPorEstado(EstadoOperacionOutbox.sincronizada),
    await _outbox.contarPorEstado(EstadoOperacionOutbox.error),
  ];

  void _aplicarConteos(List<int> conteos) {
    _pendientes = conteos[0];
    _sincronizadas = conteos[1];
    _erroresSync = conteos[2];
  }

  Future<void> _guardarBackendUrl() async {
    try {
      await _configuracion.guardarBackendUrl(_backendUrl.text);
      if (mounted) setState(() => _ultimoSync = 'URL del backend guardada.');
    } catch (error) {
      if (mounted) setState(() => _ultimoSync = error.toString());
    }
  }

  Future<void> _sincronizarAhora() async {
    if (_sincronizando || !_persistenciaLista) return;
    setState(() {
      _sincronizando = true;
      _ultimoSync = null;
    });
    HttpBackendApi? backend;
    try {
      await _configuracion.guardarBackendUrl(_backendUrl.text);
      backend = HttpBackendApi(baseUrl: _backendUrl.text.trim());
      final resultado = await ServicioSincronizacion(
        baseDatos: _baseDatos,
        clientes: _clientes,
        productos: _productos,
        outbox: _outbox,
        backend: backend,
      ).sincronizar();
      final conteos = await _obtenerConteos();
      if (mounted) {
        setState(() {
          _aplicarConteos(conteos);
          _ultimoSync = resultado.errores == 0
              ? '${resultado.sincronizadas} operaciones sincronizadas correctamente.'
              : '${resultado.sincronizadas} sincronizadas; ${resultado.errores} con error.';
        });
      }
    } catch (error) {
      if (mounted) setState(() => _ultimoSync = error.toString());
    } finally {
      backend?.cerrar();
      if (mounted) setState(() => _sincronizando = false);
    }
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
      _ejecucion = null;
      _error = null;
    });
    try {
      final resultado = await InterpretadorComandoLocal(
        widget.engine,
      ).interpretar(_instruccion.text);
      final ejecucion = await _ejecutor.ejecutar(resultado.comando);
      if (mounted) {
        setState(() {
          _resultado = resultado;
          _ejecucion = ejecucion;
          _pendientes = ejecucion.pendientes;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _generando = false);
    }
  }

  @override
  void dispose() {
    _instruccion.dispose();
    _backendUrl.dispose();
    unawaited(widget.engine.dispose());
    unawaited(_baseDatos.cerrar());
    super.dispose();
  }

  String _accion(TipoAccionLocal accion) => switch (accion) {
    TipoAccionLocal.crearCliente =>
      ConfiguracionDominioExamen.accionCrearCliente,
    TipoAccionLocal.crearProducto =>
      ConfiguracionDominioExamen.accionCrearProducto,
    TipoAccionLocal.consultarClientes =>
      ConfiguracionDominioExamen.accionConsultarClientes,
  };

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('IA LOCAL — PRUEBA TÉCNICA')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Modelo: ${_cargado ? 'Cargado' : 'No cargado'}'),
        const Text('Dependencia de Internet: Ninguna — Local'),
        Text(
          'Persistencia offline: ${_persistenciaLista ? 'Lista' : 'Preparando…'}',
        ),
        Text('Pendientes de sincronización: $_pendientes'),
        Text('Sincronizadas: $_sincronizadas'),
        Text('Errores de sincronización: $_erroresSync'),
        const SizedBox(height: 8),
        TextField(
          controller: _backendUrl,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            labelText: 'Backend URL',
            hintText: 'http://192.168.x.x:8080',
            border: OutlineInputBorder(),
          ),
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton(
              onPressed: _persistenciaLista ? _guardarBackendUrl : null,
              child: const Text('Guardar URL'),
            ),
            FilledButton.tonal(
              onPressed: _persistenciaLista && !_sincronizando
                  ? _sincronizarAhora
                  : null,
              child: Text(
                _sincronizando ? 'Sincronizando…' : 'Sincronizar ahora',
              ),
            ),
          ],
        ),
        if (_ultimoSync case final mensaje?) Text(mensaje),
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
          onPressed: !_cargado || !_persistenciaLista || _generando
              ? null
              : _interpretar,
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
        if (_ejecucion case final ejecucion?) ...[
          const SizedBox(height: 12),
          Text(ejecucion.mensaje),
          ...ejecucion.clientes.map(
            (cliente) => ListTile(
              dense: true,
              leading: const Icon(Icons.person_outline),
              title: Text(cliente.nombre),
              subtitle: Text(cliente.correo),
            ),
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
