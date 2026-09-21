# Checklist del día del examen

## Antes de salir de casa

- [ ] Laptop y cargador
- [ ] Teléfono Android cargado
- [ ] Cable USB de datos probado
- [ ] Repositorio clonado y actualizado
- [ ] GGUF disponible localmente; no depender de descargarlo
- [ ] Flutter/Android SDK, Pub, Gradle y Maven disponibles offline
- [ ] PostgreSQL instalado y credenciales conocidas sin guardarlas en Git

## Antes de comenzar

- [ ] `flutter doctor`
- [ ] `adb devices` muestra el teléfono autorizado
- [ ] PostgreSQL responde a `pg_isready`
- [ ] SW1, frontend y backend disponibles
- [ ] Scaffold compila antes de adaptar el dominio

## Al recibir el dominio

- [ ] Modelar clases, atributos, IDs y relaciones en SW1
- [ ] Validar UML y perfil Spring
- [ ] Generar el backend
- [ ] Anotar rutas, cuerpos e IDs desde controladores reales
- [ ] Elegir comandos mínimos de creación y consulta
- [ ] Seguir la guía de adaptación en orden

## Backend listo

- [ ] Base PostgreSQL creada
- [ ] `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` configurados localmente
- [ ] `.\mvnw.cmd clean test` pasa
- [ ] Spring inicia en puerto esperado
- [ ] API responde desde la laptop

## Flutter listo

- [ ] Configuración, comandos, validador, entidades, esquema, executor y HTTP adaptados
- [ ] Migración SQLite no destructiva
- [ ] `flutter analyze` pasa
- [ ] `flutter test` pasa
- [ ] APK debug construido e instalado con `adb install -r`
- [ ] URL usa IPv4 LAN, no `localhost`
- [ ] GGUF está en `files/models/`

## Prueba offline

- [ ] Modo avión, Wi-Fi y datos desactivados
- [ ] IA local interpreta acción válida
- [ ] Acción inválida se rechaza
- [ ] Datos se guardan en SQLite
- [ ] Outbox queda pendiente
- [ ] Datos sobreviven reinicio

## Prueba de sincronización

- [ ] Teléfono y laptop en la misma LAN
- [ ] Spring y PostgreSQL activos
- [ ] Sincronización deja pendientes en cero
- [ ] Filas verificadas en PostgreSQL
- [ ] Segundo intento envía cero operaciones
- [ ] Tras reinicio continúa sin reenvío

## Evidencia para defensa

- [ ] UML válido y aptitud de generación
- [ ] Tests Maven y Flutter verdes
- [ ] Aplicación funcionando sin Internet
- [ ] SQLite/outbox visibles
- [ ] REST generado y filas PostgreSQL demostrables
- [ ] Explicar: IA interpreta, validador autoriza, executor persiste, outbox sincroniza

