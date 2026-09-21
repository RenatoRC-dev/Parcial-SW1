# Runbook operativo del examen SW1

## A. Preparar la laptop

```powershell
git pull --ff-only
flutter doctor
cd flutter_exam_scaffold
flutter pub get
flutter analyze
flutter test
java -version
pg_isready -h 127.0.0.1 -p 5432
adb devices
```

Mantener previamente descargados Flutter, Android SDK, dependencias Pub/Gradle/Maven y el GGUF. Confirmar cargador, teléfono y cable USB de datos.

## B. Modelar en SW1

1. Crear las clases, atributos `id: Long` y relaciones requeridas.
2. Revisar por separado validez UML y aptitud CU09.
3. Corregir bloqueos de generación; no confundir warnings con errores.
4. Generar y descargar el backend Spring Boot.
5. Abrir los controladores generados y registrar rutas, cuerpos e IDs exactos.

## C. PostgreSQL

Crear una base con un nombre del dominio:

```powershell
psql -U postgres -d postgres -c "CREATE DATABASE examen_sw1;"
$env:DB_URL="jdbc:postgresql://localhost:5432/examen_sw1"
$env:DB_USERNAME="postgres"
$env:DB_PASSWORD="<completar-localmente>"
```

No escribir credenciales en Git, capturas, código Dart ni documentación entregable.

## D. Construir e iniciar Spring Boot

Desde el backend generado:

```powershell
.\mvnw.cmd clean test
$env:SERVER_PORT="8080"
.\mvnw.cmd spring-boot:run
```

Esperar el mensaje de aplicación iniciada. Verificar una ruta generada real, por ejemplo:

```powershell
Invoke-RestMethod http://localhost:8080/api/<entidad>
```

El backend debe escuchar en una interfaz accesible desde la LAN; el firewall de Windows debe permitir Java en la red privada.

## E. Obtener la IP LAN de Windows

```powershell
ipconfig
```

Buscar la dirección **IPv4** del adaptador Wi-Fi conectado, por ejemplo `192.168.0.8`. El teléfono no puede usar `localhost`, porque en Android apunta al propio teléfono.

## F. Configurar Flutter

1. Adaptar el dominio siguiendo `FLUTTER_DOMAIN_ADAPTATION_GUIDE.md`.
2. Ejecutar:

```powershell
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

3. Configurar en la aplicación `http://<IPv4-laptop>:8080` usando dos puntos antes del puerto.
4. Para la LAN académica HTTP, conservar permiso `INTERNET` y cleartext habilitado en el manifest actual.
5. Colocar `Qwen3-0.6B-Q4_0.gguf` en `files/models/` de la aplicación, según `flutter_exam_scaffold/models/README.md`.

## G. Dispositivo Android

1. Activar opciones de desarrollador y depuración USB.
2. En Xiaomi, habilitar instalación por USB/depuración de seguridad y aceptar el diálogo del dispositivo; `INSTALL_FAILED_USER_RESTRICTED` indica una restricción del teléfono.
3. Comprobar autorización:

```powershell
adb devices
adb install -r .\build\app\outputs\flutter-apk\app-debug.apk
```

`-r` conserva los datos de la aplicación cuando la firma/package siguen siendo compatibles. Xiaomi puede suspender la app al dejarla en segundo plano; mantenerla visible durante una inferencia.

## H. Aceptación offline

1. Activar modo avión y mantener Wi-Fi/datos desactivados.
2. Cargar el GGUF local.
3. Ejecutar una creación mediante lenguaje natural.
4. Consultar los datos locales.
5. Confirmar que aumentó el contador pendiente.
6. Cerrar y reabrir; confirmar datos y outbox durables.

## I. Aceptación de reconexión

1. Desactivar modo avión y conectar teléfono/laptop a la misma LAN.
2. Confirmar URL LAN y backend Spring activo.
3. Pulsar `Sincronizar ahora`.
4. Confirmar pendientes cero, sincronizadas correctas y errores cero.
5. Consultar PostgreSQL directamente.
6. Sincronizar otra vez, antes y después de reiniciar Flutter; debe enviar cero operaciones.

## J. Fallos comunes

| Síntoma | Revisión rápida |
|---|---|
| `adb offline` | Desconectar/reconectar, reiniciar ADB y aceptar RSA |
| `unauthorized` | Desbloquear teléfono y aceptar autorización USB |
| `INSTALL_FAILED_USER_RESTRICTED` | Permitir instalación USB y depuración de seguridad en Xiaomi |
| HTTP/HTTPS incorrecto | Usar el esquema real; en LAN actual es `http://` |
| URL `192.168.0.8.8080` | Cambiar el punto por `:`: `192.168.0.8:8080` |
| `localhost` desde teléfono | Usar IPv4 LAN de la laptop |
| No conecta a Spring | Revisar proceso, puerto 8080, binding y firewall privado |
| Error PostgreSQL | Revisar servicio, DB, `DB_URL`, usuario y contraseña |
| Modelo no encontrado | Revisar nombre/ruta exactos y volver a hacer `adb push` |

