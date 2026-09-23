import 'package:flutter_test/flutter_test.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/validador_comando_local.dart';

void main() {
  group('validarRespuestaLocal', () {
    test('acepta crear_cliente con campos requeridos', () {
      final comando = validarRespuestaLocal(
        '{"accion":"crear_cliente","parametros":{"nombre":"Ana","correo":"ana@correo.com"}}',
      );
      expect(comando.accion, TipoAccionLocal.crearCliente);
      expect(comando.parametros, {'nombre': 'Ana', 'correo': 'ana@correo.com'});
    });

    test('acepta crear_producto con precio numérico', () {
      final comando = validarRespuestaLocal(
        '{"accion":"crear_producto","parametros":{"nombre":"Teclado","precio":150}}',
      );
      expect(comando.accion, TipoAccionLocal.crearProducto);
      expect(comando.parametros['precio'], 150);
    });

    test('acepta consultar_clientes sin parámetros', () {
      final comando = validarRespuestaLocal(
        '{"accion":"consultar_clientes","parametros":{}}',
      );
      expect(comando.accion, TipoAccionLocal.consultarClientes);
      expect(comando.parametros, isEmpty);
    });

    test('rechaza no_soportada como fallo controlado no ejecutable', () {
      expect(
        () =>
            validarRespuestaLocal('{"accion":"no_soportada","parametros":{}}'),
        throwsA(isA<ErrorComandoLocal>()),
      );
    });

    test('rechaza correcto sin inferir una intención inexistente', () {
      expect(
        () => validarRespuestaLocal('{"accion":"correcto","parametros":{}}'),
        throwsA(isA<ErrorComandoLocal>()),
      );
    });

    test('tolera razonamiento previo y valida el JSON final', () {
      final comando = validarRespuestaLocal('''
<think>
razonamiento interno
</think>
{"accion":"crear_cliente","parametros":{"nombre":"Ana","correo":"ana@correo.com"}}
''');

      expect(comando.accion, TipoAccionLocal.crearCliente);
      expect(comando.parametros, {'nombre': 'Ana', 'correo': 'ana@correo.com'});
    });

    test('rechaza una acción fuera de whitelist', () {
      expect(
        () => validarRespuestaLocal('{"accion":"borrar_todo","parametros":{}}'),
        throwsA(isA<ErrorComandoLocal>()),
      );
    });

    test('rechaza JSON mal formado', () {
      expect(
        () => validarRespuestaLocal('{"accion":"crear_cliente"'),
        throwsA(isA<ErrorComandoLocal>()),
      );
    });

    test('rechaza parámetros requeridos ausentes', () {
      expect(
        () => validarRespuestaLocal(
          '{"accion":"crear_cliente","parametros":{"nombre":"Ana"}}',
        ),
        throwsA(
          isA<ErrorParametrosComandoLocal>()
              .having(
                (error) => error.borrador.accion,
                'acción preservada',
                TipoAccionLocal.crearCliente,
              )
              .having(
                (error) => error.borrador.errores,
                'errores',
                contains('correo'),
              ),
        ),
      );
    });

    test('preserva crear_producto cuando el precio es invalido', () {
      expect(
        () => validarRespuestaLocal(
          '{"accion":"crear_producto","parametros":{"nombre":"Laptop","precio":null}}',
        ),
        throwsA(
          isA<ErrorParametrosComandoLocal>()
              .having(
                (error) => error.borrador.accion,
                'acción preservada',
                TipoAccionLocal.crearProducto,
              )
              .having(
                (error) => error.borrador.errores,
                'errores',
                contains('precio'),
              ),
        ),
      );
    });

    test('accion realmente desconocida conserva error no soportado', () {
      expect(
        () =>
            validarRespuestaLocal('{"accion":"poner_musica","parametros":{}}'),
        throwsA(isA<ErrorAccionNoSoportadaLocal>()),
      );
    });

    test('rechaza campos extra potencialmente ejecutables', () {
      expect(
        () => validarRespuestaLocal(
          '{"accion":"consultar_clientes","parametros":{},"tool":"http"}',
        ),
        throwsA(isA<ErrorComandoLocal>()),
      );
    });
  });
}
