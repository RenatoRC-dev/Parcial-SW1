import { useEffect, useState } from "react"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"
import { consultarEstadoConectorEA, crearCodigoConectorEA, descargarConectorEA, revocarConectorEA, type EstadoConectorEA } from "./consultarAsistenteContextual"

export function ConfiguracionConectorEA({ projectId, credential, solicitar = false, estado = consultarEstadoConectorEA, crear = crearCodigoConectorEA, descargar = descargarConectorEA, revocar = revocarConectorEA }: {
  projectId: string; credential: string; solicitar?: boolean
  estado?: typeof consultarEstadoConectorEA; crear?: typeof crearCodigoConectorEA; descargar?: typeof descargarConectorEA; revocar?: typeof revocarConectorEA
}) {
  const { idioma } = usarPreferenciasUI(); const es = idioma === "es"
  const [abierto, abrir] = useState(false), [status, setStatus] = useState<EstadoConectorEA | null>(null)
  const [codigo, setCodigo] = useState<{ codigo: string; expires: number } | null>(null)
  const [error, setError] = useState<string | null>(null), [ocupado, setOcupado] = useState(false)
  useEffect(() => { if (solicitar) abrir(true) }, [solicitar])
  useEffect(() => {
    setStatus(null); setCodigo(null); setError(null)
    if (!abierto) return
    let cancelado = false, pendiente = false
    const actualizar = async () => {
      if (pendiente) return; pendiente = true
      try { const actual = await estado(projectId, credential); if (!cancelado) { setStatus(actual); setError(null) } }
      catch { if (!cancelado) { setStatus(null); setError(es ? "No se pudo consultar el conector. Reintenta al abrir esta sección." : "Connector status unavailable. Reopen this section to retry.") } }
      finally { pendiente = false }
    }
    void actualizar(); const timer = setInterval(() => void actualizar(), 3000)
    return () => { cancelado = true; clearInterval(timer) }
  }, [abierto, projectId, credential, estado, es])
  useEffect(() => {
    if (!codigo) return
    const timer = setTimeout(() => setCodigo(null), Math.max(0, codigo.expires - Date.now()))
    return () => clearTimeout(timer)
  }, [codigo])
  const ejecutar = async (accion: () => Promise<unknown>) => {
    if (ocupado) return; setOcupado(true); setError(null)
    try { await accion() } catch { setError(es ? "No se completó la acción. Comprueba conexión y permisos del proyecto." : "Action failed. Check connection and project access.") }
    finally { setOcupado(false) }
  }
  const etiquetas = {
    not_configured: es ? "Sin configurar" : "Not configured", disconnected: es ? "Desconectado" : "Disconnected", connected: es ? "Conectado" : "Connected",
    expired: es ? "Autorización vencida" : "Authorization expired", in_progress: es ? "Operación en curso" : "Operation in progress", verified: es ? "Verificado" : "Verified", failed: es ? "Operación fallida" : "Operation failed",
  }
  return <details className="assistant-ea-setup" open={abierto} onToggle={(e) => abrir(e.currentTarget.open)}>
    <summary>{es ? "Configurar Enterprise Architect" : "Configure Enterprise Architect"}</summary>
    <p role="status">{status ? etiquetas[status.estado] : es ? "Consultando estado…" : "Checking status…"}</p>
    {status?.expires ? <small>{es ? "Autorización hasta " : "Authorized until "}{new Date(status.expires).toLocaleTimeString(idioma)}</small> : null}
    <ol>
      <li><button type="button" disabled={ocupado} onClick={() => void ejecutar(() => descargar(projectId, credential))}>{es ? "Descargar conector Windows (ZIP)" : "Download Windows connector (ZIP)"}</button></li>
      <li>{es ? "Extrae el ZIP y ejecuta Setup.cmd. Selecciona tu repositorio EA y los paquetes de origen/destino." : "Extract the ZIP and run Setup.cmd. Choose your EA repository and source/destination packages."}</li>
      <li><button type="button" disabled={ocupado} onClick={() => void ejecutar(async () => setCodigo(await crear(projectId, credential)))}>{es ? "Generar código temporal" : "Generate temporary pairing code"}</button></li>
    </ol>
    {codigo ? <div className="candidate-actions"><label>{es ? "Código de un solo uso (3 minutos)" : "Single-use code (3 minutes)"}<input type="password" readOnly value={codigo.codigo} autoComplete="off" /></label><button type="button" onClick={() => void ejecutar(() => navigator.clipboard.writeText(codigo.codigo))}>{es ? "Copiar código para el conector" : "Copy code for connector"}</button></div> : null}
    <p className="ai-note">{es ? "ZIP sin firma digital; revisa los archivos y avisos de Windows. No requiere administrador ni incluye EA. El código autoriza solo tu proyecto/participante durante 8 horas. No compartas el código. Mantén el conector abierto; usa Detener/Conectar para reconectar." : "Unsigned ZIP: review its files and Windows warnings. No administrator required; EA is not included. The code authorizes only your project/participant for 8 hours. Do not share it. Keep the connector open; use Stop/Connect to reconnect."}</p>
    {status && status.estado !== "not_configured" ? <button type="button" disabled={ocupado} onClick={() => void ejecutar(async () => { await revocar(projectId, credential); setCodigo(null); setStatus({ estado: "disconnected" }) })}>{es ? "Revocar mi conector" : "Revoke my connector"}</button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </details>
}
