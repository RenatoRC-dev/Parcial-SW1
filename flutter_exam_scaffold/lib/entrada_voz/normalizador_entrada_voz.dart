/// Normaliza artefactos sintácticos frecuentes del dictado español.
/// No clasifica intenciones ni completa datos ausentes.
String normalizarEntradaVoz(String entrada) {
  var valor = entrada.trim();
  valor = valor.replaceAll(
    RegExp(r'\b(?:arroba|arrova)\b', caseSensitive: false),
    '@',
  );
  valor = valor.replaceAllMapped(
    RegExp(r'\bpunto\s+(com|org|net)\b', caseSensitive: false),
    (coincidencia) => '.${coincidencia.group(1)!.toLowerCase()}',
  );
  valor = valor.replaceAll(
    RegExp(r'\bcorreo(?=[A-Za-z0-9._%+\-]+@)', caseSensitive: false),
    'correo ',
  );
  valor = valor.replaceAll(RegExp(r'\s*@\s*'), '@');
  valor = valor.replaceAll(RegExp(r'\s*\.\s*'), '.');
  return valor.replaceAll(RegExp(r'\s+'), ' ').trim();
}
