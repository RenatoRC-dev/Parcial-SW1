import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sw1_local_ai_spike/sincronizacion/backend_api.dart';
import 'package:sw1_local_ai_spike/sincronizacion/http_backend_api.dart';

void main() {
  test('mapea cliente al contrato REST generado y recupera id', () async {
    final cliente = MockClient((request) async {
      expect(request.method, 'POST');
      expect(request.url.toString(), 'http://192.168.1.50:8080/api/cliente');
      expect(jsonDecode(request.body), {
        'nombre': 'Ana',
        'correo': 'ana@correo.com',
      });
      return http.Response(
        '{"id":11,"nombre":"Ana","correo":"ana@correo.com"}',
        201,
      );
    });
    final api = HttpBackendApi(
      baseUrl: 'http://192.168.1.50:8080/',
      cliente: cliente,
    );

    final resultado = await api.crearCliente(
      nombre: 'Ana',
      correo: 'ana@correo.com',
    );

    expect(resultado.idRemoto, '11');
    api.cerrar();
  });

  test('mapea producto al contrato REST generado', () async {
    final cliente = MockClient((request) async {
      expect(request.url.path, '/api/producto');
      expect(jsonDecode(request.body), {'nombre': 'Laptop', 'precio': 3500});
      return http.Response('{"id":22,"nombre":"Laptop","precio":3500.0}', 201);
    });
    final api = HttpBackendApi(baseUrl: 'http://equipo:8080', cliente: cliente);

    final resultado = await api.crearProducto(nombre: 'Laptop', precio: 3500);

    expect(resultado.idRemoto, '22');
    api.cerrar();
  });

  test('rechaza HTTP no exitoso sin inventar identidad', () async {
    final api = HttpBackendApi(
      baseUrl: 'http://equipo:8080',
      cliente: MockClient((request) async => http.Response('error', 503)),
    );

    await expectLater(
      api.crearCliente(nombre: 'Ana', correo: 'ana@correo.com'),
      throwsA(isA<ErrorBackendApi>()),
    );
    api.cerrar();
  });
}
