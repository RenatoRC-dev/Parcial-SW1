# Render → Qwen3 en Windows mediante Cloudflare Access

Estado: transporte implementado y probado con dobles deterministas. La conexión real requiere configurar el dominio, Cloudflare y Render; no se activan desde el código. Ollama continúa en `127.0.0.1:11434`, modelo `qwen3:8b`, sin puertos entrantes ni binding público.

## Alternativa activa solicitada: ngrok HTTPS con Basic Auth

El mismo modo `hybrid_remote` admite Basic Auth sin Cloudflare. Configura **solo el servicio backend Render**:

```text
AI_ORCHESTRATOR_MODE=hybrid_remote
LOCAL_LLM_BASE_URL=https://deduct-demystify-masses.ngrok-free.dev
LOCAL_LLM_BASIC_AUTH_USER=<usuario configurado en ngrok>
LOCAL_LLM_BASIC_AUTH_PASSWORD=<contraseña configurada en ngrok>
LOCAL_LLM_MODEL=qwen3:8b
LOCAL_LLM_TIMEOUT_MS=120000
```

Usuario/contraseña son secretos privados de Render, nunca variables Vite ni valores en Git. No incluyas barra final, rutas ni credenciales en la URL. El endpoint queda fijado por esa variable backend; ningún mensaje/argumento del usuario puede cambiarlo. El transporte exige HTTPS/TLS, DNS IPv4 público y rechaza redirecciones, IP privadas, puertos alternativos, query/fragmento y credenciales en URL.

La presencia de cualquiera de `LOCAL_LLM_BASIC_AUTH_USER/PASSWORD` selecciona Basic Auth: ambos son obligatorios y se envían como `Authorization: Basic …` a `/api/chat` y `/api/tags`. Una configuración incompleta se rechaza; no se intenta Cloudflare ni otro proveedor. En esta variante no se necesitan `REMOTE_LLM_*` ni `CF_ACCESS_*`. `hybrid_local` conserva Ollama HTTP local y no envía estas credenciales.

Mantén ngrok apuntando al Ollama loopback con Basic Auth obligatorio; verifica que sin credenciales devuelve 401, también para chat. Tras desplegar y configurar Render, consulta el endpoint autenticado `proveedor-local`: debe informar `hybrid_remote/disponible`. Un 401/403, túnel apagado o redirect devuelve indisponibilidad explícita, sin fallback. Credenciales reales y conexión Render→ngrok no verificadas por las pruebas con fakes. CU04/CU05 siguen siendo Groq; no gastes créditos para probar únicamente tags o una recomendación.

## Variables del servicio backend en Render

La siguiente tabla corresponde a la variante **Cloudflare Access**, alternativa a Basic Auth.

Configúralas en **nexocase-backend → Environment**, nunca en frontend/Vite, repositorio, URLs o capturas. No es necesario modificar `render.yaml`.

| Variable | Valor / propósito |
|---|---|
| `AI_ORCHESTRATOR_MODE` | `hybrid_remote` |
| `REMOTE_LLM_BASE_URL` | `https://qwen.tu-dominio.com` — reemplazar por el dominio real; origen exacto, minúsculas, sin barra final, puerto, ruta, query ni credenciales |
| `REMOTE_LLM_ALLOWED_HOST` | `qwen.tu-dominio.com` — coincidencia exacta con el hostname anterior; sin comodines |
| `CF_ACCESS_CLIENT_ID` | Client ID del service token de Cloudflare Access; secreto de backend |
| `CF_ACCESS_CLIENT_SECRET` | Client Secret del mismo token; secreto de backend |
| `REMOTE_LLM_MODEL` | `qwen3:8b` (valor predeterminado y único permitido) |
| `REMOTE_LLM_TIMEOUT_MS` | `120000` (predeterminado; rango permitido 100–120000 ms) |

Mantén las variables existentes de MongoDB Atlas, acceso por proyecto, CORS y Groq CU04/CU05. Las variables `LOCAL_LLM_*` siguen siendo exclusivas de `hybrid_local`; no controlan ni sustituyen la configuración remota. `legacy` sigue desactivando Ollama. No hay fallback automático de Qwen remoto a Groq ni al localhost de Render.

## Preparación Cloudflare/Windows

1. Usa un dominio propio administrado por Cloudflare y un **túnel nombrado con hostname fijo**. No uses Quick Tunnels/`trycloudflare.com`, dominios de IP dinámica ni una URL aportada por el chat. Reutiliza `cloudflared` si está instalado; si falta, obtén la distribución oficial y respeta los avisos/permisos Windows. No cambies el modelo Ollama.
2. Antes de publicar el hostname, crea una aplicación **Access → Self-hosted** que cubra TODO `qwen.tu-dominio.com`. Crea un service token exclusivo de NexoCASE con expiración y una política **Service Auth** que incluya SOLO ese token. Sin reglas Bypass, Everyone ni acceso anónimo. Guarda Client ID/Secret directamente en Render, no en el ZIP del conector EA. Cloudflare documenta ambas cabeceras y la política en [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).
3. Configura el túnel para llevar únicamente `/api/chat` y `/api/tags` a `http://127.0.0.1:11434`, con rechazo para el resto. Activa validación del JWT de Access también en `cloudflared` con el team y AUD de esa aplicación. Ejemplo de túnel gestionado localmente (marcadores, no secretos reales):

```yaml
tunnel: <UUID_DEL_TUNEL>
credentials-file: C:\Users\<USUARIO>\.cloudflared\<UUID_DEL_TUNEL>.json
ingress:
  - hostname: qwen.tu-dominio.com
    path: ^/api/(chat|tags)$
    service: http://127.0.0.1:11434
    originRequest:
      access:
        required: true
        teamName: <NOMBRE_DEL_TEAM>
        audTag:
          - <AUD_DE_LA_APLICACION_ACCESS>
  - service: http_status:404
```

El archivo de credenciales del túnel queda bajo el perfil privado de Windows y fuera del repositorio; es distinto del service token usado por Render. La validación Access se configura **en esa regla ingress**, no solo globalmente. Consulta [configuración ingress](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/) y [parámetros Access del origen](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/).

4. Valida la configuración con `cloudflared tunnel ingress validate`, vincula el hostname al túnel nombrado y ejecútalo con `cloudflared tunnel run <NOMBRE_DEL_TUNEL>`. Mantén el PC, Ollama y el túnel encendidos. No es necesario abrir firewall/NAT ni ejecutar Ollama en `0.0.0.0`; no se instala un servicio Windows ni se elude UAC automáticamente.
5. Antes de activar Render, verifica desde otra red que el hostname SIN token o con token inválido NO devuelve modelos ni acepta chat. Verifica que con el token correcto `/api/tags` devuelve `qwen3:8b`, que otros paths (por ejemplo `/api/pull`) no llegan a Ollama y que no hay redirección al login. Una redirección indica una política de acceso incorrecta para machine-to-machine, no se sigue desde NexoCASE. Haz estas comprobaciones con un cliente que lea las credenciales de un almacén seguro; nunca las pegues en URLs, comandos compartidos o evidencias.
6. Configura las variables anteriores en Render y despliega el cambio. No añadas `VITE_CF_*` ni `VITE_REMOTE_*`. La comunicación es backend→Cloudflare→túnel→Ollama; el usuario sigue autenticándose por proyecto/participante en NexoCASE.

## Controles y aceptación real pendiente

- HTTPS con TLS/certificado/hostname verificados; IP literal, puertos alternativos, rutas, credenciales URL, hostname distinto, loopback, nombres locales y túneles efímeros rechazados. En el lookup de la conexión se exige IPv4 pública; direcciones privadas, link-local/metadata y reservadas rechazadas. Sin IPv6 ni proxies de entorno para este transporte.
- Solo `/api/chat` y `/api/tags`; sin redirects, retries, descargas de modelos ni fallback. El chat conserva esquema cerrado, modelo exacto, respuesta completa, límite 32 KiB y timeout total. Tags usa las mismas credenciales, timeout ≤5 s y límite 32 KiB.
- Error de Access/túnel devuelve proveedor no disponible; JSON/salida inválida se rechaza; timeout se informa como tal. Diagnósticos correlacionados por requestId y transporte, sin URL, credenciales, cuerpos, prompts ni UML. Procedencia sigue siendo **Ollama**, nunca determinista por usar túnel.
- Desde una sesión de proyecto válida, `GET /api/proyectos/:id/asistente-colaborativo/proveedor-local` debe devolver `modo: hybrid_remote` y `estado: disponible`. Sin autenticación debe rechazar. Esta comprobación usa tags y no consume Groq.
- En proyecto aislado, pedir una recomendación sin autorizar cambios: comprobar respuesta Qwen, referencia durable y UML intacto. Con el túnel apagado o token revocado, una nueva consulta no determinista debe fallar explícitamente sin mensajes de éxito/fallback. Restaurar token/túnel debe permitir el reintento manual idempotente.
- La creación contextual posterior sigue siendo **Groq CU04** y requiere aprobación para consumir créditos en una prueba real; el túnel no autoriza ni ejecuta UML. CU05 sigue siendo Groq. Yjs, confirmaciones XMI/EA y Guardar explícito no cambian.
- Si falla, revisar primero PC/Ollama/túnel activo, DNS público IPv4, política Service Auth, token vigente, AUD/team correctos y límites del servicio intermediario. La duración de 120 s es un máximo de NexoCASE, no una garantía de Render/Cloudflare. Rotar/revocar token en Cloudflare y actualizarlo en backend; no registrarlo en logs. Para volver al comportamiento previo, configurar `legacy` o `hybrid_local` con sus variables existentes.

No se afirma aceptación Render→Qwen hasta completar estos controles con el dominio real. Las pruebas de código usan credenciales falsas y no verifican la configuración de tu cuenta Cloudflare.
