import 'package:flutter/material.dart';
import 'package:sw1_local_ai_spike/aplicacion/resumen_comando_local.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/entrada_voz/entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/presentacion/tema_examen.dart';

enum TipoEstadoUI { neutro, exito, advertencia, error }

final class AppScaffoldExamen extends StatelessWidget {
  const AppScaffoldExamen({
    required this.titulo,
    required this.contenido,
    this.subtitulo,
    super.key,
  });

  final String titulo;
  final String? subtitulo;
  final Widget contenido;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo),
          if (subtitulo != null)
            Text(subtitulo!, style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: EdgeInsets.fromLTRB(
              EspaciadoUI.pantalla,
              EspaciadoUI.normal,
              EspaciadoUI.pantalla,
              MediaQuery.viewInsetsOf(context).bottom + EspaciadoUI.grande,
            ),
            child: contenido,
          ),
        ),
      ),
    ),
  );
}

final class TarjetaSeccion extends StatelessWidget {
  const TarjetaSeccion({
    required this.titulo,
    required this.child,
    this.subtitulo,
    this.accion,
    this.icono,
    super.key,
  });

  final String titulo;
  final String? subtitulo;
  final Widget child;
  final Widget? accion;
  final IconData? icono;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(EspaciadoUI.normal),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (icono != null) ...[
                Icon(icono, size: 22),
                const SizedBox(width: EspaciadoUI.minimo),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      titulo,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (subtitulo != null)
                      Text(
                        subtitulo!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              if (accion != null) accion!,
            ],
          ),
          const SizedBox(height: EspaciadoUI.normal),
          child,
        ],
      ),
    ),
  );
}

final class EstadoChip extends StatelessWidget {
  const EstadoChip({
    required this.etiqueta,
    required this.icono,
    this.tipo = TipoEstadoUI.neutro,
    super.key,
  });

  final String etiqueta;
  final IconData icono;
  final TipoEstadoUI tipo;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final (fondo, frente) = switch (tipo) {
      TipoEstadoUI.exito => (
        esquema.primaryContainer,
        esquema.onPrimaryContainer,
      ),
      TipoEstadoUI.advertencia => (
        esquema.tertiaryContainer,
        esquema.onTertiaryContainer,
      ),
      TipoEstadoUI.error => (esquema.errorContainer, esquema.onErrorContainer),
      TipoEstadoUI.neutro => (
        esquema.surfaceContainerHighest,
        esquema.onSurfaceVariant,
      ),
    };
    return Semantics(
      label: etiqueta,
      child: Chip(
        avatar: Icon(icono, size: 18, color: frente),
        label: Text(etiqueta),
        backgroundColor: fondo,
        labelStyle: TextStyle(color: frente),
        side: BorderSide.none,
        shape: const StadiumBorder(),
      ),
    );
  }
}

final class ResumenEstadosExamen extends StatelessWidget {
  const ResumenEstadosExamen({
    required this.iaLista,
    required this.persistenciaLista,
    required this.pendientes,
    this.redDisponible,
    super.key,
  });

  final bool iaLista;
  final bool persistenciaLista;
  final int pendientes;
  final bool? redDisponible;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: EspaciadoUI.minimo,
    runSpacing: EspaciadoUI.minimo,
    children: [
      EstadoChip(
        etiqueta: iaLista ? 'IA local lista' : 'IA local no cargada',
        icono: iaLista ? Icons.offline_bolt : Icons.memory_outlined,
        tipo: iaLista ? TipoEstadoUI.exito : TipoEstadoUI.neutro,
      ),
      EstadoChip(
        etiqueta: persistenciaLista
            ? 'Datos locales listos'
            : 'Preparando datos',
        icono: Icons.phone_android,
        tipo: persistenciaLista ? TipoEstadoUI.exito : TipoEstadoUI.neutro,
      ),
      EstadoChip(
        etiqueta: '$pendientes pendientes',
        icono: Icons.sync,
        tipo: pendientes > 0 ? TipoEstadoUI.advertencia : TipoEstadoUI.neutro,
      ),
      if (redDisponible case final disponible?)
        EstadoChip(
          etiqueta: disponible ? 'Red disponible' : 'Sin conexión',
          icono: disponible ? Icons.wifi : Icons.wifi_off,
          tipo: disponible ? TipoEstadoUI.exito : TipoEstadoUI.advertencia,
        ),
    ],
  );
}

final class BotonMicrofono extends StatelessWidget {
  const BotonMicrofono({
    required this.disponible,
    required this.estado,
    required this.alPresionar,
    super.key,
  });

  final bool disponible;
  final EstadoEntradaVozLocal estado;
  final VoidCallback? alPresionar;

  @override
  Widget build(BuildContext context) {
    final escuchando = estado == EstadoEntradaVozLocal.escuchando;
    final procesando = estado == EstadoEntradaVozLocal.procesando;
    final etiqueta = !disponible
        ? 'Voz local no disponible'
        : switch (estado) {
            EstadoEntradaVozLocal.escuchando => 'Detener escucha',
            EstadoEntradaVozLocal.procesando => 'Procesando voz local',
            EstadoEntradaVozLocal.completada => 'Dictar otra instrucción',
            EstadoEntradaVozLocal.error => 'Reintentar voz local',
            EstadoEntradaVozLocal.inactiva => 'Dictar instrucción',
          };
    return IconButton.filledTonal(
      tooltip: etiqueta,
      onPressed: disponible && !procesando ? alPresionar : null,
      icon: procesando
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(
              escuchando
                  ? Icons.stop_rounded
                  : estado == EstadoEntradaVozLocal.error
                  ? Icons.mic_off_outlined
                  : Icons.mic_none_rounded,
            ),
    );
  }
}

final class EntradaAsistente extends StatelessWidget {
  const EntradaAsistente({
    required this.controller,
    required this.habilitada,
    required this.procesando,
    required this.alInterpretar,
    required this.vozDisponible,
    required this.estadoVoz,
    required this.alUsarVoz,
    this.vozProminente = false,
    this.segundosEscucha = 0,
    super.key,
  });

  final TextEditingController controller;
  final bool habilitada;
  final bool procesando;
  final VoidCallback alInterpretar;
  final bool vozDisponible;
  final EstadoEntradaVozLocal estadoVoz;
  final VoidCallback? alUsarVoz;
  final bool vozProminente;
  final int segundosEscucha;

  @override
  Widget build(BuildContext context) => TarjetaSeccion(
    key: const Key('seccion-asistente'),
    titulo: 'Asistente local',
    subtitulo:
        'Describe la operación en lenguaje natural. Funciona sin Internet.',
    icono: Icons.auto_awesome_outlined,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (vozProminente) ...[
          Center(
            child: Column(
              children: [
                SizedBox.square(
                  dimension: 72,
                  child: BotonMicrofono(
                    disponible: vozDisponible,
                    estado: estadoVoz,
                    alPresionar: alUsarVoz,
                  ),
                ),
                const SizedBox(height: EspaciadoUI.minimo),
                Text(
                  estadoVoz == EstadoEntradaVozLocal.escuchando
                      ? 'Escuchando…  00:${segundosEscucha.toString().padLeft(2, '0')}'
                      : estadoVoz == EstadoEntradaVozLocal.procesando ||
                            procesando
                      ? 'Entendiendo tu solicitud…'
                      : 'Habla para realizar una acción',
                  textAlign: TextAlign.center,
                ),
                if (estadoVoz == EstadoEntradaVozLocal.escuchando)
                  Text(
                    'Pulsa para terminar',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          const SizedBox(height: EspaciadoUI.normal),
        ],
        TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          textInputAction: TextInputAction.newline,
          decoration: InputDecoration(
            labelText: 'Instrucción',
            hintText: 'Ej.: Registra a Ana con correo ana@correo.com',
            suffixIcon: vozProminente
                ? null
                : BotonMicrofono(
                    disponible: vozDisponible,
                    estado: estadoVoz,
                    alPresionar: alUsarVoz,
                  ),
          ),
        ),
        const SizedBox(height: EspaciadoUI.pequeno),
        FilledButton.icon(
          onPressed: habilitada && !procesando ? alInterpretar : null,
          icon: procesando
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.arrow_forward_rounded),
          label: Text(procesando ? 'Interpretando...' : 'Interpretar'),
        ),
        if (!vozDisponible) ...[
          const SizedBox(height: EspaciadoUI.minimo),
          Text(
            'La entrada por voz no está disponible en este dispositivo.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ],
    ),
  );
}

final class TarjetaConfirmacionComando extends StatefulWidget {
  const TarjetaConfirmacionComando({
    required this.resumen,
    required this.alConfirmar,
    required this.alCancelar,
    required this.alModificar,
    this.error,
    super.key,
  });

  final ResumenComandoLocal resumen;
  final VoidCallback alConfirmar;
  final VoidCallback alCancelar;
  final bool Function(Map<String, String>) alModificar;
  final String? error;

  @override
  State<TarjetaConfirmacionComando> createState() =>
      _TarjetaConfirmacionComandoState();
}

class _TarjetaConfirmacionComandoState
    extends State<TarjetaConfirmacionComando> {
  bool _editando = false;
  late Map<String, TextEditingController> _controles;

  @override
  void initState() {
    super.initState();
    _crearControles();
  }

  @override
  void didUpdateWidget(TarjetaConfirmacionComando oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.resumen != widget.resumen) {
      for (final control in _controles.values) {
        control.dispose();
      }
      _crearControles();
      _editando = false;
    }
  }

  void _crearControles() {
    _controles = {
      for (final campo in widget.resumen.campos)
        campo.clave: TextEditingController(text: campo.valor.toString()),
    };
  }

  @override
  void dispose() {
    for (final control in _controles.values) {
      control.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TarjetaSeccion(
    key: const Key('confirmacion-comando'),
    titulo: '¿Realizar esta acción?',
    icono: Icons.fact_check_outlined,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.resumen.titulo,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: EspaciadoUI.pequeno),
        for (final campo in widget.resumen.campos)
          Padding(
            padding: const EdgeInsets.only(bottom: EspaciadoUI.minimo),
            child: _editando
                ? TextField(
                    key: Key('editar-${campo.clave}'),
                    controller: _controles[campo.clave],
                    keyboardType: campo.numerico
                        ? const TextInputType.numberWithOptions(decimal: true)
                        : TextInputType.text,
                    decoration: InputDecoration(
                      labelText: campo.etiqueta,
                      errorText: campo.error,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        campo.etiqueta,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      Text(campo.valor.toString()),
                      if (campo.error != null)
                        Text(
                          campo.error!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                    ],
                  ),
          ),
        if (widget.error != null)
          Text(
            widget.error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        Wrap(
          alignment: WrapAlignment.end,
          spacing: EspaciadoUI.minimo,
          children: [
            TextButton(
              key: const Key('cancelar-comando'),
              onPressed: widget.alCancelar,
              child: const Text('Cancelar'),
            ),
            OutlinedButton(
              key: const Key('modificar-comando'),
              onPressed: () {
                if (!_editando) {
                  setState(() => _editando = true);
                  return;
                }
                final valido = widget.alModificar({
                  for (final item in _controles.entries)
                    item.key: item.value.text,
                });
                if (valido) setState(() => _editando = false);
              },
              child: Text(_editando ? 'Aplicar cambios' : 'Modificar'),
            ),
            FilledButton(
              key: const Key('confirmar-comando'),
              onPressed: _editando || !widget.resumen.esValido
                  ? null
                  : widget.alConfirmar,
              child: const Text('Confirmar'),
            ),
          ],
        ),
      ],
    ),
  );
}

final class PanelComandoNoIdentificado extends StatelessWidget {
  const PanelComandoNoIdentificado({
    required this.alReintentar,
    required this.alEscribir,
    super.key,
  });

  final VoidCallback alReintentar;
  final VoidCallback alEscribir;

  @override
  Widget build(BuildContext context) => TarjetaSeccion(
    key: const Key('comando-no-identificado'),
    titulo: 'No pude identificar una acción válida.',
    icono: Icons.help_outline,
    child: Wrap(
      spacing: EspaciadoUI.minimo,
      children: [
        FilledButton.tonal(
          onPressed: alReintentar,
          child: const Text('Intentar nuevamente'),
        ),
        TextButton(
          onPressed: alEscribir,
          child: const Text('Escribir instrucción'),
        ),
      ],
    ),
  );
}

final class PanelResultadoComando extends StatelessWidget {
  const PanelResultadoComando({
    this.accion,
    this.parametros = const {},
    this.mensaje,
    this.error,
    super.key,
  });

  final String? accion;
  final Map<String, Object> parametros;
  final String? mensaje;
  final String? error;

  @override
  Widget build(BuildContext context) {
    if (accion == null && mensaje == null && error == null) {
      return const EstadoVacio(
        icono: Icons.task_alt,
        titulo: 'Sin resultados todavía',
        descripcion: 'La operación interpretada aparecerá aquí.',
      );
    }
    return TarjetaSeccion(
      key: const Key('panel-resultado'),
      titulo: error == null ? 'Resultado' : 'No se completó la operación',
      icono: error == null ? Icons.check_circle_outline : Icons.error_outline,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (accion != null) Text('Acción: $accion'),
          ...parametros.entries.map(
            (item) => Text('${item.key}: ${item.value}'),
          ),
          if (mensaje != null) ...[
            const SizedBox(height: EspaciadoUI.minimo),
            Text(mensaje!),
          ],
          if (error != null)
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
    );
  }
}

final class EstadoVacio extends StatelessWidget {
  const EstadoVacio({
    required this.icono,
    required this.titulo,
    required this.descripcion,
    super.key,
  });
  final IconData icono;
  final String titulo;
  final String descripcion;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: EspaciadoUI.normal),
    child: Column(
      children: [
        Icon(icono, size: 36, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: EspaciadoUI.minimo),
        Text(titulo, style: Theme.of(context).textTheme.titleSmall),
        Text(
          descripcion,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}

final class IndicadorCarga extends StatelessWidget {
  const IndicadorCarga({required this.mensaje, super.key});

  final String mensaje;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.all(EspaciadoUI.grande),
      child: Column(
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: EspaciadoUI.pequeno),
          Text(mensaje),
        ],
      ),
    ),
  );
}

final class TarjetaEntidad extends StatelessWidget {
  const TarjetaEntidad({
    required this.titulo,
    required this.detalle,
    this.icono = Icons.description_outlined,
    super.key,
  });
  final String titulo;
  final String detalle;
  final IconData icono;

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: CircleAvatar(child: Icon(icono)),
    title: Text(titulo),
    subtitle: Text(detalle),
  );
}

final class MensajeSincronizacion extends StatelessWidget {
  const MensajeSincronizacion({
    required this.mensaje,
    this.esError = false,
    super.key,
  });
  final String mensaje;
  final bool esError;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          esError ? Icons.cloud_off_outlined : Icons.cloud_done_outlined,
          color: esError
              ? Theme.of(context).colorScheme.error
              : Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(width: EspaciadoUI.minimo),
        Expanded(child: Text(mensaje)),
      ],
    ),
  );
}

final class VistaModoInterfazExamen extends StatelessWidget {
  const VistaModoInterfazExamen({
    required this.modo,
    required this.estado,
    required this.asistente,
    required this.gestion,
    required this.resultado,
    required this.sincronizacion,
    this.diagnostico,
    super.key,
  });

  final ModoInterfazExamen modo;
  final Widget estado;
  final Widget asistente;
  final Widget gestion;
  final Widget resultado;
  final Widget sincronizacion;
  final Widget? diagnostico;

  List<Widget> get _secciones => switch (modo) {
    ModoInterfazExamen.asistente => [
      estado,
      asistente,
      resultado,
      gestion,
      sincronizacion,
    ],
    ModoInterfazExamen.gestion => [
      estado,
      gestion,
      resultado,
      TarjetaSeccion(
        key: const Key('asistente-secundario'),
        titulo: 'Acción asistida',
        subtitulo:
            'Canal opcional para registrar o consultar mediante IA local.',
        child: asistente,
      ),
      sincronizacion,
    ],
    ModoInterfazExamen.hibrido => [
      estado,
      gestion,
      asistente,
      resultado,
      sincronizacion,
    ],
  };

  @override
  Widget build(BuildContext context) => Column(
    key: Key('modo-${modo.name}'),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final (indice, seccion) in _secciones.indexed) ...[
        if (indice > 0) const SizedBox(height: EspaciadoUI.normal),
        seccion,
      ],
      if (diagnostico != null) ...[
        const SizedBox(height: EspaciadoUI.normal),
        diagnostico!,
      ],
    ],
  );
}
