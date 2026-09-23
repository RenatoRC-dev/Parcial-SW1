import 'package:flutter_test/flutter_test.dart';
import 'package:sw1_local_ai_spike/entrada_voz/normalizador_entrada_voz.dart';

void main() {
  test('normaliza arroba y dominios dictados en español', () {
    expect(
      normalizarEntradaVoz('carlos arroba correo punto com'),
      'carlos@correo.com',
    );
    expect(
      normalizarEntradaVoz('carlos arrova gmail punto com'),
      'carlos@gmail.com',
    );
    expect(
      normalizarEntradaVoz('ana arroba empresa punto org'),
      'ana@empresa.org',
    );
  });

  test('elimina espacios alrededor de arroba y punto', () {
    expect(normalizarEntradaVoz('carlos @ correo . com'), 'carlos@correo.com');
  });

  test('separa correo fusionado solo ante un valor con forma de email', () {
    expect(
      normalizarEntradaVoz('registra con correocarlos@gmail.com'),
      'registra con correo carlos@gmail.com',
    );
    expect(normalizarEntradaVoz('correocarlos'), 'correocarlos');
  });

  test('no inventa dominios dañados', () {
    expect(
      normalizarEntradaVoz('carlos arroba reo punto com'),
      'carlos@reo.com',
    );
  });
}
