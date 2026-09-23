import 'dart:async';

/// Estado observable de un futuro adaptador de reconocimiento de voz local.
enum EstadoEntradaVozLocal {
  inactiva,
  escuchando,
  procesando,
  completada,
  error,
}

/// Puerto de entrada. Produce texto; nunca comandos ni efectos de negocio.
///
/// Una implementacion futura debe ser completamente local. El texto resultante
/// se entrega al mismo InterpretadorComandoLocal utilizado por el teclado.
abstract interface class EntradaVozLocal {
  bool get disponible;
  EstadoEntradaVozLocal get estado;
  Stream<EstadoEntradaVozLocal> get cambiosEstado;
  Stream<String> get transcripcionesAutomaticas;

  Future<void> iniciarEscucha();
  Future<String> detenerEscucha();
  Future<void> cancelar();
  Future<void> dispose();
}

/// Temporizador aislado y comprobable que evita superar el límite del motor STT.
final class LimiteGrabacionVoz {
  Timer? _temporizador;

  void iniciar(Duration duracion, Future<void> Function() alVencer) {
    cancelar();
    _temporizador = Timer(duracion, () => unawaited(alVencer()));
  }

  void cancelar() {
    _temporizador?.cancel();
    _temporizador = null;
  }
}
