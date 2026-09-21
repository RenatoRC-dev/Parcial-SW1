import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/validador_comando_local.dart';
import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/local_ai/local_ai_engine.dart';

const promptSistemaLocal =
    '''
Clasifica una solicitud de negocio en español y extrae sus datos.
La respuesta JSON ya empieza con {"accion":". Completa solamente lo que falta.

Completaciones válidas:
${ConfiguracionDominioExamen.accionCrearCliente}","parametros":{"nombre":"Ana","correo":"ana@correo.com"}}
${ConfiguracionDominioExamen.accionCrearProducto}","parametros":{"nombre":"Laptop","precio":3500}}
${ConfiguracionDominioExamen.accionConsultarClientes}","parametros":{}}
${ConfiguracionDominioExamen.accionNoSoportada}","parametros":{}}

Usa ${ConfiguracionDominioExamen.accionCrearCliente} para registrar una persona con nombre y correo.
Usa ${ConfiguracionDominioExamen.accionCrearProducto} para agregar un producto con nombre y precio numérico.
Usa ${ConfiguracionDominioExamen.accionConsultarClientes} para listar o consultar clientes.
Si la intención no coincide claramente, usa ${ConfiguracionDominioExamen.accionNoSoportada}.
No repitas el prefijo. No expliques. No uses Markdown. No inventes acciones.
''';

final class ResultadoInterpretacionLocal {
  const ResultadoInterpretacionLocal({
    required this.comando,
    required this.duracion,
  });
  final ComandoLocal comando;
  final Duration duracion;
}

final class InterpretadorComandoLocal {
  const InterpretadorComandoLocal(this._engine);
  final LocalAiEngine _engine;

  Future<ResultadoInterpretacionLocal> interpretar(String instruccion) async {
    if (instruccion.trim().isEmpty) {
      throw const ErrorComandoLocal('Escribe una instrucción.');
    }
    final reloj = Stopwatch()..start();
    final respuesta = StringBuffer();
    await for (final fragmento in _engine.generate(
      LocalAiRequest(
        systemPrompt: promptSistemaLocal,
        userPrompt: instruccion.trim(),
      ),
    )) {
      respuesta.write(fragmento);
    }
    reloj.stop();
    return ResultadoInterpretacionLocal(
      comando: validarRespuestaLocal(respuesta.toString()),
      duracion: reloj.elapsed,
    );
  }
}
