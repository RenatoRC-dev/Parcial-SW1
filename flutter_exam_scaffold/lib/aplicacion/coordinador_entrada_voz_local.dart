import 'package:sw1_local_ai_spike/entrada_voz/entrada_voz_local.dart';

/// Une el canal de voz con el flujo de texto sin conocer SQLite, HTTP ni el
/// dominio. La política decide si el texto queda para revisión o se ejecuta.
final class CoordinadorEntradaVozLocal {
  const CoordinadorEntradaVozLocal(this._entrada);

  final EntradaVozLocal _entrada;

  Future<void> iniciar() => _entrada.iniciarEscucha();

  Future<String> finalizar({
    required Future<void> Function(String texto) alTranscribir,
  }) async {
    final texto = (await _entrada.detenerEscucha()).trim();
    if (texto.isEmpty) return '';
    await alTranscribir(texto);
    return texto;
  }
}
