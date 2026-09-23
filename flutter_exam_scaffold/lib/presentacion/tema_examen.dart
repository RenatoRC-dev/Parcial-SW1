import 'package:flutter/material.dart';

abstract final class EspaciadoUI {
  static const minimo = 8.0;
  static const pequeno = 12.0;
  static const normal = 16.0;
  static const grande = 24.0;
  static const pantalla = 20.0;
}

abstract final class RadiosUI {
  static const control = 14.0;
  static const tarjeta = 20.0;
}

abstract final class TemaExamen {
  static ThemeData claro() {
    final colores = ColorScheme.fromSeed(
      seedColor: const Color(0xff315da8),
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colores,
      scaffoldBackgroundColor: colores.surface,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: colores.surface,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colores.surfaceContainerLow,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiosUI.tarjeta),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colores.surfaceContainerLowest,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(RadiosUI.control),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(RadiosUI.control),
          borderSide: BorderSide(color: colores.outlineVariant),
        ),
        contentPadding: const EdgeInsets.all(EspaciadoUI.normal),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(RadiosUI.control),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(RadiosUI.control),
          ),
        ),
      ),
    );
  }
}
