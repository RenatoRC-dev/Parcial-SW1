# NexoCASE — conector Windows para Enterprise Architect

En el asistente abre **Configurar Enterprise Architect**, descarga el ZIP y extráelo. Ejecuta `Setup.cmd`, selecciona tu repositorio local y los paquetes de origen y destino. Genera un código temporal en NexoCASE, pégalo en el conector y autoriza la conexión. No necesitas copiar la credencial del proyecto.

El ZIP **no está firmado**, no incluye EA ni instala servicios. Revisa los archivos y las advertencias de Windows. El lanzador respeta UAC y la política de ejecución; no la desactiva. Si tu organización bloquea scripts, pide su aprobación. EA debe estar instalado con licencia utilizable; abre y acepta sus términos localmente antes de conectar. El lanzador usa PowerShell Windows de 64 bits y COM, sin administrador.

Mantén la ventana abierta. **Detener** desconecta y revoca la sesión al terminar la operación actual. Para reconectar genera otro código (un uso, tres minutos). La autorización dura ocho horas y puede revocarse desde NexoCASE. La conexión es saliente: HTTPS, excepto localhost HTTP. No abras puertos entrantes. Los códigos/tokens permanecen en memoria; no los compartas ni los pongas en URLs.

**NexoCASE → EA:** solicita exportar el modelo actual a Enterprise Architect. CU07 genera XMI; el conector crea un paquete NUEVO aislado y lee clases, atributos y relaciones mediante COM. El asistente informa éxito solo tras verificar el recibo. No sobrescribe paquetes existentes.

**EA → NexoCASE:** solicita importar el modelo seleccionado de Enterprise Architect. Solo se exporta el paquete aprobado en esta ventana, con XMI EA 2.1; CU06 prepara una vista previa. Confirma expresamente el reemplazo en NexoCASE. Solo el solicitante lo aplica; Yjs sincroniza y Guardar sigue siendo manual.

XMI/XML directo continúa disponible sin EA. Límite de XMI: 5 MB. Perfil soportado: clases, atributos y asociaciones con nombres, roles y multiplicidades. No se garantiza conservar GUID, disposición visual, versión canónica, operaciones, todo UML 2.5 ni el marcador asociativo propio tras pasar por EA. Las pérdidas detectables se muestran como advertencias; revisa la vista previa.

Los recibos y marcas de reconciliación en `%LOCALAPPDATA%\NexoCASE-EA` evitan repetir escrituras tras desconexiones. Contienen datos del modelo, nunca tokens. Usa un perfil Windows privado. Un trabajo interrumpido puede requerir inspección del paquete aislado; no se reimporta a ciegas.

Desarrollo: `node backend/scripts/empaquetarConectorEa.mjs` produce el ZIP reproducible servido por el backend. `Automation.Tests.ps1` usa dobles COM; `Smoke.ps1` crea un repositorio desechable para pruebas reales. `Connect.ps1` conserva el modo previo con credencial segura para automatización local.
