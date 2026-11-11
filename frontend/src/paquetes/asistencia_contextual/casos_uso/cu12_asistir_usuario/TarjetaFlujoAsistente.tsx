import type { VistaFlujoAsistente } from "./consultarAsistenteContextual"
import { usarPreferenciasUI } from "../../../../configuracion/PreferenciasUI"

export function TarjetaFlujoAsistente({ flujo, ocupado, alDecidir, alDescargar }: { flujo: VistaFlujoAsistente; ocupado: boolean; alDecidir: (decision: "confirmar" | "rechazar") => void; alDescargar: () => void }) {
  const { idioma, t } = usarPreferenciasUI()
  const es = idioma === "es"
  const nombres = new Map(flujo.candidato?.clases.map((c) => [c.refTemporal, c.nombre]) ?? [])
  return <section className="assistant-workflow-card" aria-label={es ? "Resultado del turno" : "Turn result"}>
    <p role="status">{flujo.resumen}</p>
    {flujo.candidato ? <div className="candidate-preview">
      {flujo.candidato.clases.map((c) => <div key={c.refTemporal}><strong>{c.nombre}</strong><ul>{c.atributos.map((a) => <li key={a.refTemporal}>{a.nombre}: {a.tipoDato ?? (es ? "tipo no visible" : "type not visible")}</li>)}</ul></div>)}
      {flujo.candidato.relaciones.map((r) => <p key={r.refTemporal}>{nombres.get(r.origenRef) ?? r.origenRef} [{r.multiplicidadOrigen}] — [{r.multiplicidadDestino}] {nombres.get(r.destinoRef) ?? r.destinoRef}</p>)}
    </div> : flujo.clases?.length ? <p>{flujo.clases.join(", ")}</p> : null}
    {flujo.advertencias.length ? <ul className="mapping-warnings">{flujo.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul> : null}
    {flujo.estado === "review" || flujo.estado === "issued" ? <div className="candidate-actions">
      <button type="button" disabled={ocupado} onClick={() => alDecidir("confirmar")}>{flujo.operacion === "importar_xmi" ? (es ? "Confirmar reemplazo del modelo" : "Confirm model replacement") : t("imagen.agregar")}</button>
      {flujo.estado === "review" ? <button type="button" disabled={ocupado} onClick={() => alDecidir("rechazar")}>{t("imagen.cancelar")}</button> : null}
    </div> : null}
    {flujo.archivo && flujo.estado === "ready" ? <button type="button" disabled={ocupado} onClick={alDescargar}>↓ {flujo.archivo.nombre}</button> : null}
  </section>
}
