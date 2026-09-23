import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sw1_local_ai_spike/aplicacion/resumen_comando_local.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/entrada_voz/entrada_voz_local.dart';
import 'package:sw1_local_ai_spike/presentacion/componentes_examen.dart';
import 'package:sw1_local_ai_spike/presentacion/tema_examen.dart';

void main() {
  Widget app(Widget child) => MaterialApp(
    theme: TemaExamen.claro(),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );

  VistaModoInterfazExamen vista(
    ModoInterfazExamen modo, {
    Widget? diagnostico,
  }) => VistaModoInterfazExamen(
    modo: modo,
    estado: const Text('ESTADO'),
    asistente: const Text('ASISTENTE'),
    gestion: const Text('GESTION'),
    resultado: const Text('RESULTADO'),
    sincronizacion: const Text('SYNC'),
    diagnostico: diagnostico,
  );

  test(
    'la configuracion selecciona un modo explicito y diagnostico oculto',
    () {
      expect(
        ConfiguracionDominioExamen.modoInterfaz,
        ModoInterfazExamen.asistente,
      );
      expect(ConfiguracionDominioExamen.mostrarDiagnosticoTecnico, isFalse);
      expect(ConfiguracionDominioExamen.entradaVozLocalHabilitada, isTrue);
    },
  );

  testWidgets('modo asistente renderiza la composicion command-first', (
    tester,
  ) async {
    await tester.pumpWidget(app(vista(ModoInterfazExamen.asistente)));
    expect(find.byKey(const Key('modo-asistente')), findsOneWidget);
    expect(find.text('ASISTENTE'), findsOneWidget);
    expect(find.text('GESTION'), findsOneWidget);
  });

  testWidgets('modo gestion prioriza entidades y conserva accion asistida', (
    tester,
  ) async {
    await tester.pumpWidget(app(vista(ModoInterfazExamen.gestion)));
    expect(find.byKey(const Key('modo-gestion')), findsOneWidget);
    expect(find.text('GESTION'), findsOneWidget);
    expect(find.byKey(const Key('asistente-secundario')), findsOneWidget);
  });

  testWidgets('modo hibrido comparte gestion y asistente', (tester) async {
    await tester.pumpWidget(app(vista(ModoInterfazExamen.hibrido)));
    expect(find.byKey(const Key('modo-hibrido')), findsOneWidget);
    expect(find.text('GESTION'), findsOneWidget);
    expect(find.text('ASISTENTE'), findsOneWidget);
  });

  testWidgets('estados offline y pendientes son legibles', (tester) async {
    await tester.pumpWidget(
      app(
        const ResumenEstadosExamen(
          iaLista: true,
          persistenciaLista: true,
          pendientes: 2,
          redDisponible: false,
        ),
      ),
    );
    expect(find.text('IA local lista'), findsOneWidget);
    expect(find.text('Datos locales listos'), findsOneWidget);
    expect(find.text('2 pendientes'), findsOneWidget);
    expect(find.text('Sin conexión'), findsOneWidget);
  });

  testWidgets('fallo de sync usa mensaje seguro y no jerga de outbox', (
    tester,
  ) async {
    const mensaje =
        'No se pudo sincronizar. Tus datos siguen guardados en el dispositivo.';
    await tester.pumpWidget(
      app(const MensajeSincronizacion(mensaje: mensaje, esError: true)),
    );
    expect(find.text(mensaje), findsOneWidget);
    expect(find.textContaining('INSERT'), findsNothing);
    expect(find.byIcon(Icons.cloud_off_outlined), findsOneWidget);
  });

  testWidgets('diagnostico se omite y aparece solo al configurarlo', (
    tester,
  ) async {
    await tester.pumpWidget(app(vista(ModoInterfazExamen.asistente)));
    expect(find.text('DIAGNOSTICO'), findsNothing);

    await tester.pumpWidget(
      app(
        vista(
          ModoInterfazExamen.asistente,
          diagnostico: const Text('DIAGNOSTICO'),
        ),
      ),
    );
    expect(find.text('DIAGNOSTICO'), findsOneWidget);
  });

  testWidgets('microfono queda deshabilitado sin adaptador local', (
    tester,
  ) async {
    await tester.pumpWidget(
      app(
        BotonMicrofono(
          disponible: false,
          estado: EstadoEntradaVozLocal.inactiva,
          alPresionar: () {},
        ),
      ),
    );
    final boton = tester.widget<IconButton>(find.byType(IconButton));
    expect(boton.onPressed, isNull);
    expect(find.byTooltip('Voz local no disponible'), findsOneWidget);
  });

  testWidgets('componentes comunes muestran vacio y entidad', (tester) async {
    await tester.pumpWidget(
      app(
        const Column(
          children: [
            EstadoVacio(
              icono: Icons.inbox_outlined,
              titulo: 'Sin registros',
              descripcion: 'Crea el primero.',
            ),
            TarjetaEntidad(titulo: 'Ana', detalle: 'ana@correo.com'),
          ],
        ),
      ),
    );
    expect(find.text('Sin registros'), findsOneWidget);
    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('ana@correo.com'), findsOneWidget);
  });

  testWidgets('confirmacion muestra negocio y no transcripcion cruda', (
    tester,
  ) async {
    const comando = ComandoLocal(
      accion: TipoAccionLocal.crearCliente,
      parametros: {'nombre': 'Carlos', 'correo': 'carlos@correo.com'},
    );
    await tester.pumpWidget(
      app(
        TarjetaConfirmacionComando(
          resumen: resumirComandoLocal(comando),
          alConfirmar: () {},
          alCancelar: () {},
          alModificar: (_) => true,
        ),
      ),
    );
    expect(find.text('¿Realizar esta acción?'), findsOneWidget);
    expect(find.text('Registrar cliente'), findsOneWidget);
    expect(find.text('Carlos'), findsOneWidget);
    expect(find.text('carlos@correo.com'), findsOneWidget);
    expect(find.textContaining('Registra a Carlos'), findsNothing);
  });

  testWidgets('borrador invalido permite modificar pero no confirmar', (
    tester,
  ) async {
    const borrador = BorradorComandoLocal(
      accion: TipoAccionLocal.crearCliente,
      parametros: {'nombre': 'Carlos', 'correo': 'correo-invalido'},
      errores: {'correo': 'Revisa el correo antes de continuar.'},
    );
    await tester.pumpWidget(
      app(
        TarjetaConfirmacionComando(
          resumen: resumirBorradorComandoLocal(borrador),
          alConfirmar: () {},
          alCancelar: () {},
          alModificar: (_) => false,
        ),
      ),
    );
    expect(find.text('Registrar cliente'), findsOneWidget);
    expect(find.text('Revisa el correo antes de continuar.'), findsOneWidget);
    final confirmar = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Confirmar'),
    );
    expect(confirmar.onPressed, isNull);
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Modificar'),
          )
          .onPressed,
      isNotNull,
    );
  });
}
