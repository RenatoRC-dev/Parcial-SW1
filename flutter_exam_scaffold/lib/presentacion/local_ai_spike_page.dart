import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sw1_local_ai_spike/aplicacion/ejecutor_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/coordinador_entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/control_flujo_comando_local.dart';
import 'package:sw1_local_ai_spike/aplicacion/interpretador_comando_local.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/operacion_pendiente.dart';
import 'package:sw1_local_ai_spike/entrada_voz/entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/entrada_voz/normalizador_entrada_voz.dart';
import 'package:sw1_local_ai_spike/entrada_voz/sherpa_onnx_entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/local_ai/local_ai_engine.dart';
import 'package:sw1_local_ai_spike/persistencia/base_datos_local.dart';
import 'package:sw1_local_ai_spike/persistencia/cliente_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/configuracion_local_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/outbox_repository.dart';
import 'package:sw1_local_ai_spike/persistencia/producto_local_repository.dart';
import 'package:sw1_local_ai_spike/presentacion/componentes_examen.dart';
import 'package:sw1_local_ai_spike/presentacion/tema_examen.dart';
import 'package:sw1_local_ai_spike/sincronizacion/http_backend_api.dart';
import 'package:sw1_local_ai_spike/sincronizacion/monitor_conectividad.dart';
import 'package:sw1_local_ai_spike/sincronizacion/servicio_sincronizacion.dart';

const nombreModelo = 'Qwen3-0.6B-Q4_0.gguf';

class LocalAiSpikePage extends StatefulWidget {
  const LocalAiSpikePage({
    required this.engine,
    this.baseDatos,
    this.entradaVoz,
    this.monitorConectividad,
    this.modo = ConfiguracionDominioExamen.modoInterfaz,
    this.mostrarDiagnostico =
        ConfiguracionDominioExamen.mostrarDiagnosticoTecnico,
    this.vozHabilitada = ConfiguracionDominioExamen.entradaVozLocalHabilitada,
    super.key,
  });

  final LocalAiEngine engine;
  final BaseDatosLocal? baseDatos;
  final EntradaVozLocal? entradaVoz;
  final MonitorConectividad? monitorConectividad;
  final ModoInterfazExamen modo;
  final bool mostrarDiagnostico;
  final bool vozHabilitada;

  @override
  State<LocalAiSpikePage> createState() => _LocalAiSpikePageState();
}

class _LocalAiSpikePageState extends State<LocalAiSpikePage>
    with WidgetsBindingObserver {
  final _instruccion = TextEditingController(
    text: 'Registra a Ana con correo ana@correo.com',
  );
  final _backendUrl = TextEditingController();
  String? _rutaModelo;
  bool _cargando = false, _cargado = false, _generando = false;
  Duration? _tiempoCarga;
  Duration? _tiempoStt;
  ResultadoInterpretacionLocal? _resultado;
  ResultadoEjecucionLocal? _ejecucion;
  String? _error;
  late final BaseDatosLocal _baseDatos;
  late final ClienteLocalRepository _clientes;
  late final ProductoLocalRepository _productos;
  late final OutboxRepository _outbox;
  late final ConfiguracionLocalRepository _configuracion;
  late final EjecutorComandoLocal _ejecutor;
  late final ControlFlujoComandoLocal _flujoComando;
  StreamSubscription<FaseFlujoComandoLocal>? _suscripcionFlujo;
  bool _persistenciaLista = false, _sincronizando = false;
  int _pendientes = 0, _sincronizadas = 0, _erroresSync = 0;
  String? _ultimoSync, _detalleSync;
  bool _ultimoSyncFueError = false;
  EstadoEntradaVozLocal _estadoVoz = EstadoEntradaVozLocal.inactiva;
  StreamSubscription<EstadoEntradaVozLocal>? _suscripcionVoz;
  StreamSubscription<String>? _suscripcionVozAutomatica;
  EntradaVozLocal? _entradaVoz;
  bool _entradaVozPropia = false;
  CoordinadorSincronizacionReconectada? _coordinadorSync;
  bool _syncReconectadaLista = false;
  bool? _redDisponible;
  String? _transcripcionInterna;
  Timer? _relojEscucha;
  int _segundosEscucha = 0;

  bool get _vozDisponible =>
      widget.vozHabilitada && (_entradaVoz?.disponible ?? false);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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
    _flujoComando = ControlFlujoComandoLocal(
      interpretar: InterpretadorComandoLocal(widget.engine).interpretar,
      ejecutar: _ejecutor.ejecutar,
    );
    _suscripcionFlujo = _flujoComando.cambios.listen((_) {
      if (!mounted) return;
      setState(() {
        _generando =
            _flujoComando.fase == FaseFlujoComandoLocal.interpretando ||
            _flujoComando.fase == FaseFlujoComandoLocal.ejecutando;
        _resultado = _flujoComando.interpretacion;
        _ejecucion = _flujoComando.resultado;
        _error = _flujoComando.error;
        if (_ejecucion != null) _pendientes = _ejecucion!.pendientes;
      });
      final ejecucion = _flujoComando.resultado;
      if (_flujoComando.fase == FaseFlujoComandoLocal.completado &&
          ejecucion != null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(ejecucion.mensaje)));
      }
    });
    _configurarVoz(widget.entradaVoz, propia: false);
    _prepararRuta();
    _prepararPersistencia();
  }

  void _configurarVoz(EntradaVozLocal? voz, {required bool propia}) {
    if (voz == null) return;
    _entradaVoz = voz;
    _entradaVozPropia = propia;
    _estadoVoz = voz.estado;
    unawaited(_suscripcionVoz?.cancel());
    unawaited(_suscripcionVozAutomatica?.cancel());
    _suscripcionVoz = voz.cambiosEstado.listen((estado) {
      if (!mounted) return;
      setState(() => _estadoVoz = estado);
      if (estado != EstadoEntradaVozLocal.escuchando) {
        _relojEscucha?.cancel();
      }
    });
    _suscripcionVozAutomatica = voz.transcripcionesAutomaticas.listen(
      _procesarTranscripcionVoz,
      onError: (_) {
        if (mounted) {
          setState(() => _error = 'No pude escuchar correctamente.');
        }
      },
    );
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
        await _prepararSincronizacionReconectada();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No se pudo abrir el almacenamiento local.');
      }
    }
  }

  Future<void> _prepararSincronizacionReconectada() async {
    if (_syncReconectadaLista ||
        !ConfiguracionDominioExamen.sincronizacionAlReconectarHabilitada) {
      return;
    }
    final monitor = widget.monitorConectividad ?? MonitorConectividadPlus();
    final coordinador = CoordinadorSincronizacionReconectada(
      monitor: monitor,
      sincronizar: _sincronizarInterno,
      alCambiarDisponibilidad: (disponible) {
        if (mounted) setState(() => _redDisponible = disponible);
      },
    );
    _coordinadorSync = coordinador;
    await coordinador.iniciar();
    _syncReconectadaLista = true;
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
      if (mounted) {
        setState(() {
          _ultimoSync = 'Dirección del backend guardada.';
          _ultimoSyncFueError = false;
          _detalleSync = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _ultimoSync = 'Revisa la dirección del backend.';
          _ultimoSyncFueError = true;
          _detalleSync = error.toString();
        });
      }
    }
  }

  Future<void> _sincronizarAhora() async {
    final coordinador = _coordinadorSync;
    if (coordinador != null) {
      await coordinador.ejecutarManual();
      return;
    }
    await _sincronizarInterno(false);
  }

  Future<void> _sincronizarInterno(bool automatica) async {
    if (_sincronizando || !_persistenciaLista) return;
    if (automatica &&
        (_pendientes + _erroresSync == 0 || _backendUrl.text.trim().isEmpty)) {
      return;
    }
    setState(() {
      _sincronizando = true;
      _ultimoSync = automatica ? 'Conexión recuperada. Sincronizando…' : null;
      _detalleSync = null;
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
          _ultimoSyncFueError = resultado.errores > 0;
          _ultimoSync = resultado.errores == 0
              ? '${resultado.sincronizadas} operaciones sincronizadas correctamente.'
              : 'No se pudieron sincronizar todas las operaciones. Tus datos siguen guardados en el dispositivo.';
          _detalleSync = resultado.errores > 0
              ? '${resultado.sincronizadas} sincronizadas; ${resultado.errores} con error.'
              : null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _ultimoSyncFueError = true;
          _ultimoSync =
              'No se pudo sincronizar. Tus datos siguen guardados en el dispositivo.';
          _detalleSync = error.toString();
        });
      }
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
          () =>
              _error = 'No hay almacenamiento local disponible para el modelo.',
        );
      }
      return;
    }
    final modelos = Directory('${base.path}/models');
    await modelos.create(recursive: true);
    if (widget.entradaVoz == null && widget.vozHabilitada) {
      final temporal = await getTemporaryDirectory();
      final voz = SherpaOnnxEntradaVozLocal(
        directorioModelo:
            '${modelos.path}/${SherpaOnnxEntradaVozLocal.nombreDirectorioModelo}',
        rutaAudioTemporal: '${temporal.path}/instruccion-voz.wav',
      );
      _configurarVoz(voz, propia: true);
    }
    if (mounted) {
      setState(() => _rutaModelo = '${modelos.path}/$nombreModelo');
    }
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

  Future<void> _usarVoz() async {
    final voz = _entradaVoz;
    if (!_vozDisponible ||
        voz == null ||
        _generando ||
        _flujoComando.fase == FaseFlujoComandoLocal.confirmando ||
        _flujoComando.fase == FaseFlujoComandoLocal.requiereCorreccion) {
      return;
    }
    try {
      if (_estadoVoz == EstadoEntradaVozLocal.escuchando) {
        final reloj = Stopwatch()..start();
        await CoordinadorEntradaVozLocal(
          voz,
        ).finalizar(alTranscribir: _procesarTranscripcionVoz);
        reloj.stop();
        if (mounted) setState(() => _tiempoStt = reloj.elapsed);
      } else {
        _flujoComando.reiniciar();
        await CoordinadorEntradaVozLocal(voz).iniciar();
        _segundosEscucha = 0;
        _relojEscucha?.cancel();
        _relojEscucha = Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted && _estadoVoz == EstadoEntradaVozLocal.escuchando) {
            setState(() => _segundosEscucha++);
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No pude escuchar correctamente.');
      }
    }
  }

  Future<void> _procesarTranscripcionVoz(String texto) async {
    if (!mounted || texto.trim().isEmpty) return;
    final reloj = Stopwatch()..start();
    final normalizado = normalizarEntradaVoz(texto);
    assert(() {
      debugPrint('[STT] raw="$texto"');
      debugPrint('[NORMALIZE] value="$normalizado"');
      return true;
    }());
    setState(() {
      _transcripcionInterna = texto.trim();
      _error = null;
    });
    await _flujoComando.interpretar(normalizado);
    reloj.stop();
    if (mounted && _tiempoStt == null) {
      setState(() => _tiempoStt = reloj.elapsed);
    }
  }

  Future<void> _interpretar() async {
    if (!_cargado || _generando) return;
    _transcripcionInterna = null;
    await _flujoComando.interpretar(_instruccion.text);
  }

  Future<void> _confirmarComando() async {
    await _flujoComando.confirmar();
  }

  void _cancelarComando() => _flujoComando.cancelar();

  bool _modificarComando(Map<String, String> valores) =>
      _flujoComando.modificar(valores);

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _instruccion.dispose();
    _backendUrl.dispose();
    unawaited(_suscripcionVoz?.cancel());
    unawaited(_suscripcionVozAutomatica?.cancel());
    unawaited(_suscripcionFlujo?.cancel());
    _relojEscucha?.cancel();
    unawaited(_flujoComando.dispose());
    if (_entradaVozPropia || widget.entradaVoz != null) {
      unawaited(_entradaVoz?.dispose());
    }
    unawaited(_coordinadorSync?.dispose());
    unawaited(widget.engine.dispose());
    unawaited(_baseDatos.cerrar());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_coordinadorSync?.alReanudar());
    }
  }

  Widget _gestion() => TarjetaSeccion(
    key: const Key('seccion-gestion'),
    titulo: 'Datos locales',
    subtitulo: 'Disponibles incluso sin conexión.',
    icono: Icons.people_outline,
    child: _ejecucion?.clientes.isNotEmpty ?? false
        ? Column(
            children: _ejecucion!.clientes
                .map(
                  (cliente) => TarjetaEntidad(
                    titulo: cliente.nombre,
                    detalle: cliente.correo,
                    icono: Icons.person_outline,
                  ),
                )
                .toList(growable: false),
          )
        : const EstadoVacio(
            icono: Icons.folder_open_outlined,
            titulo: 'Sin datos para mostrar',
            descripcion:
                'Consulta clientes o registra una nueva operación local.',
          ),
  );

  Widget _sincronizacion() => TarjetaSeccion(
    key: const Key('seccion-sincronizacion'),
    titulo: 'Sincronización',
    subtitulo:
        'Se reintenta al recuperar conexión; también puedes iniciarlo manualmente.',
    icono: Icons.cloud_sync_outlined,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: EspaciadoUI.minimo,
          children: [
            EstadoChip(
              etiqueta: '$_sincronizadas sincronizadas',
              icono: Icons.cloud_done_outlined,
              tipo: TipoEstadoUI.exito,
            ),
            if (_erroresSync > 0)
              EstadoChip(
                etiqueta: '$_erroresSync con error',
                icono: Icons.error_outline,
                tipo: TipoEstadoUI.error,
              ),
          ],
        ),
        const SizedBox(height: EspaciadoUI.pequeno),
        TextField(
          controller: _backendUrl,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            labelText: 'Dirección del backend',
            hintText: 'http://192.168.x.x:8080',
            prefixIcon: Icon(Icons.lan_outlined),
          ),
        ),
        const SizedBox(height: EspaciadoUI.pequeno),
        Wrap(
          spacing: EspaciadoUI.minimo,
          runSpacing: EspaciadoUI.minimo,
          children: [
            OutlinedButton.icon(
              onPressed: _persistenciaLista ? _guardarBackendUrl : null,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Guardar dirección'),
            ),
            FilledButton.tonalIcon(
              onPressed: _persistenciaLista && !_sincronizando
                  ? _sincronizarAhora
                  : null,
              icon: _sincronizando
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.sync),
              label: Text(
                _sincronizando ? 'Sincronizando...' : 'Sincronizar ahora',
              ),
            ),
          ],
        ),
        if (_ultimoSync case final mensaje?) ...[
          const SizedBox(height: EspaciadoUI.pequeno),
          MensajeSincronizacion(mensaje: mensaje, esError: _ultimoSyncFueError),
        ],
      ],
    ),
  );

  Widget? _diagnostico() {
    if (!widget.mostrarDiagnostico) return null;
    return ExpansionTile(
      key: const Key('diagnostico-tecnico'),
      title: const Text('Diagnóstico técnico'),
      childrenPadding: const EdgeInsets.all(EspaciadoUI.normal),
      children: [
        SelectableText('Modelo: ${_rutaModelo ?? "preparando ruta"}'),
        Text('Carga: ${_tiempoCarga?.inMilliseconds ?? "-"} ms'),
        Text('STT local: ${_tiempoStt?.inMilliseconds ?? "-"} ms'),
        if (_transcripcionInterna != null)
          SelectableText('Transcripción interna: $_transcripcionInterna'),
        Text('Inferencia: ${_resultado?.duracion.inMilliseconds ?? "-"} ms'),
        Text(
          'Backend: ${_backendUrl.text.isEmpty ? "sin configurar" : _backendUrl.text}',
        ),
        Text(
          'Outbox: $_pendientes pendientes / $_sincronizadas sincronizadas / $_erroresSync errores',
        ),
        if (_detalleSync != null) SelectableText('Detalle sync: $_detalleSync'),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final confirmacion = _flujoComando.pendiente;
    final resultado = switch (_flujoComando.fase) {
      FaseFlujoComandoLocal.confirmando ||
      FaseFlujoComandoLocal.requiereCorreccion when confirmacion != null =>
        TarjetaConfirmacionComando(
          resumen: confirmacion,
          error: _flujoComando.error,
          alConfirmar: _confirmarComando,
          alCancelar: _cancelarComando,
          alModificar: _modificarComando,
        ),
      FaseFlujoComandoLocal.noIdentificado => PanelComandoNoIdentificado(
        alReintentar: _usarVoz,
        alEscribir: _flujoComando.reiniciar,
      ),
      FaseFlujoComandoLocal.interpretando => const IndicadorCarga(
        mensaje: 'Entendiendo tu solicitud…',
      ),
      FaseFlujoComandoLocal.ejecutando => const IndicadorCarga(
        mensaje: 'Realizando acción…',
      ),
      _ => PanelResultadoComando(mensaje: _ejecucion?.mensaje, error: _error),
    };
    return AppScaffoldExamen(
      titulo: ConfiguracionDominioExamen.nombreAplicacion,
      subtitulo: switch (widget.modo) {
        ModoInterfazExamen.asistente => 'Asistente offline',
        ModoInterfazExamen.gestion => 'Gestión local',
        ModoInterfazExamen.hibrido => 'Gestión y asistente',
      },
      contenido: VistaModoInterfazExamen(
        modo: widget.modo,
        estado: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ResumenEstadosExamen(
              iaLista: _cargado,
              persistenciaLista: _persistenciaLista,
              pendientes: _pendientes,
              redDisponible: _redDisponible,
            ),
            if (widget.vozHabilitada && !_vozDisponible) ...[
              const SizedBox(height: EspaciadoUI.minimo),
              const EstadoChip(
                etiqueta: 'Entrada por voz no disponible',
                icono: Icons.mic_off_outlined,
                tipo: TipoEstadoUI.advertencia,
              ),
            ],
            if (!_cargado) ...[
              const SizedBox(height: EspaciadoUI.minimo),
              FilledButton.tonalIcon(
                onPressed: _cargando ? null : _cargarModelo,
                icon: _cargando
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download_for_offline_outlined),
                label: Text(
                  _cargando ? 'Cargando IA local...' : 'Cargar IA local',
                ),
              ),
            ],
          ],
        ),
        asistente: EntradaAsistente(
          controller: _instruccion,
          habilitada:
              _cargado &&
              _persistenciaLista &&
              _flujoComando.fase != FaseFlujoComandoLocal.confirmando &&
              _flujoComando.fase != FaseFlujoComandoLocal.requiereCorreccion,
          procesando: _generando,
          alInterpretar: _interpretar,
          vozDisponible: _vozDisponible,
          estadoVoz: _estadoVoz,
          alUsarVoz:
              _generando ||
                  _flujoComando.fase == FaseFlujoComandoLocal.confirmando ||
                  _flujoComando.fase == FaseFlujoComandoLocal.requiereCorreccion
              ? null
              : _usarVoz,
          vozProminente: widget.modo == ModoInterfazExamen.asistente,
          segundosEscucha: _segundosEscucha,
        ),
        gestion: _gestion(),
        resultado: resultado,
        sincronizacion: _sincronizacion(),
        diagnostico: _diagnostico(),
      ),
    );
  }
}
