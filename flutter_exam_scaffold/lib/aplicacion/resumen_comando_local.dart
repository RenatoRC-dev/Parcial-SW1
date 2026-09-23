import 'package:sw1_local_ai_spike/configuracion/configuracion_dominio_examen.dart';
import 'package:sw1_local_ai_spike/dominio/comando_local.dart';
import 'package:sw1_local_ai_spike/dominio/validador_comando_local.dart';

final class CampoResumenComando {
  const CampoResumenComando({
    required this.clave,
    required this.etiqueta,
    required this.valor,
    this.error,
    this.numerico = false,
  });

  final String clave;
  final String etiqueta;
  final Object? valor;
  final String? error;
  final bool numerico;
}

final class ResumenComandoLocal {
  const ResumenComandoLocal({
    required this.accion,
    this.comando,
    required this.titulo,
    required this.campos,
    required this.requiereConfirmacion,
  });

  final TipoAccionLocal accion;
  final ComandoLocal? comando;
  final String titulo;
  final List<CampoResumenComando> campos;
  final bool requiereConfirmacion;
  bool get esValido => comando != null;
}

ResumenComandoLocal resumirComandoLocal(ComandoLocal comando) =>
    switch (comando.accion) {
      TipoAccionLocal.crearCliente => ResumenComandoLocal(
        accion: comando.accion,
        comando: comando,
        titulo: 'Registrar cliente',
        campos: [
          CampoResumenComando(
            clave: 'nombre',
            etiqueta: 'Nombre',
            valor: comando.parametros['nombre']!,
          ),
          CampoResumenComando(
            clave: 'correo',
            etiqueta: 'Correo',
            valor: comando.parametros['correo']!,
          ),
        ],
        requiereConfirmacion: true,
      ),
      TipoAccionLocal.crearProducto => ResumenComandoLocal(
        accion: comando.accion,
        comando: comando,
        titulo: 'Agregar producto',
        campos: [
          CampoResumenComando(
            clave: 'nombre',
            etiqueta: 'Nombre',
            valor: comando.parametros['nombre']!,
          ),
          CampoResumenComando(
            clave: 'precio',
            etiqueta: 'Precio',
            valor: comando.parametros['precio']!,
            numerico: true,
          ),
        ],
        requiereConfirmacion: true,
      ),
      TipoAccionLocal.consultarClientes => ResumenComandoLocal(
        accion: comando.accion,
        comando: comando,
        titulo: 'Consultar clientes',
        campos: const [],
        requiereConfirmacion: false,
      ),
    };

ResumenComandoLocal resumirBorradorComandoLocal(
  BorradorComandoLocal borrador,
) => switch (borrador.accion) {
  TipoAccionLocal.crearCliente => ResumenComandoLocal(
    accion: borrador.accion,
    titulo: 'Registrar cliente',
    campos: [
      CampoResumenComando(
        clave: 'nombre',
        etiqueta: 'Nombre',
        valor: borrador.parametros['nombre'] ?? '',
        error: borrador.errores['nombre'],
      ),
      CampoResumenComando(
        clave: 'correo',
        etiqueta: 'Correo',
        valor: borrador.parametros['correo'] ?? '',
        error: borrador.errores['correo'],
      ),
    ],
    requiereConfirmacion: true,
  ),
  TipoAccionLocal.crearProducto => ResumenComandoLocal(
    accion: borrador.accion,
    titulo: 'Agregar producto',
    campos: [
      CampoResumenComando(
        clave: 'nombre',
        etiqueta: 'Nombre',
        valor: borrador.parametros['nombre'] ?? '',
        error: borrador.errores['nombre'],
      ),
      CampoResumenComando(
        clave: 'precio',
        etiqueta: 'Precio',
        valor: borrador.parametros['precio'] ?? '',
        numerico: true,
        error: borrador.errores['precio'],
      ),
    ],
    requiereConfirmacion: true,
  ),
  TipoAccionLocal.consultarClientes => ResumenComandoLocal(
    accion: borrador.accion,
    titulo: 'Consultar clientes',
    campos: const [],
    requiereConfirmacion: false,
  ),
};

ResumenComandoLocal modificarResumenComandoLocal(
  ResumenComandoLocal actual,
  Map<String, String> valores,
) {
  final parametros = <String, dynamic>{};
  for (final campo in actual.campos) {
    final valor = valores[campo.clave]?.trim() ?? '';
    parametros[campo.clave] = campo.numerico ? num.tryParse(valor) : valor;
  }
  final accion = switch (actual.accion) {
    TipoAccionLocal.crearCliente =>
      ConfiguracionDominioExamen.accionCrearCliente,
    TipoAccionLocal.crearProducto =>
      ConfiguracionDominioExamen.accionCrearProducto,
    TipoAccionLocal.consultarClientes =>
      ConfiguracionDominioExamen.accionConsultarClientes,
  };
  try {
    return resumirComandoLocal(validarComandoEstructurado(accion, parametros));
  } on ErrorComandoLocal {
    return resumirBorradorComandoLocal(
      crearBorradorComandoEstructurado(accion, parametros),
    );
  }
}
