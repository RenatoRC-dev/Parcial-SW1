import { createHash, randomBytes } from "node:crypto"
import { z } from "zod"
import type { ContextoAccesoProyecto } from "../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import type { RepositorioMensajes } from "../../mensajeria_colaborativa/compartido/RepositorioMensajes.js"
import type { EstadoConectorEA, FlujoAsistentePersistido } from "../compartido/FlujoAsistente.js"
import { ErrorFlujoAsistente } from "../casos_uso/cu12_asistir_usuario/EjecutarFlujosAsistente.js"
import { conProcedencia, procedenciaActual } from "../../mensajeria_colaborativa/compartido/ProcedenciaIA.js"

const text = z.string().max(200)
const guid = z.string().regex(/^\{[a-fA-F0-9-]{36}\}$/)
export const esquemaPareadoEA = z.object({ deviceId: z.string().uuid(), targetId: z.string().regex(/^[a-f0-9]{64}$/), consent: z.literal(true) }).strict()
export const esquemaInspeccionEA = z.object({
  packageGuid: guid,
  classes: z.array(z.object({ id: text, name: text, abstract: z.enum(["0", "1"]), stereotype: text, methods: z.number().int().min(0).max(1000),
    attributes: z.array(z.object({ name: text, type: text, visibility: text }).strict()).max(200) }).strict()).max(200),
  relationships: z.array(z.object({ name: text, source: text, target: text, type: text, sourceMultiplicity: text, targetMultiplicity: text, sourceRole: text, targetRole: text,
    sourceAggregation: z.number().int().min(0).max(2), targetAggregation: z.number().int().min(0).max(2) }).strict()).max(400),
  unsupported: z.object({ elements: z.number().int().nonnegative().max(10000), diagrams: z.number().int().nonnegative().max(10000) }).strict().optional(),
}).strict()
export const esquemaReciboEA = z.object({ requestId: z.string().uuid(), status: z.enum(["verified", "exported", "failed"]), inspection: esquemaInspeccionEA.optional(), code: z.enum(["EA_UNAVAILABLE", "IMPORT_FAILED", "EXPORT_FAILED", "RECONCILIATION_REQUIRED", "INCOMPATIBLE_XMI"]).optional(), xmi: z.string().max(6990510).optional(), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()
type Sesion = { acceso: ContextoAccesoProyecto; deviceId: string; targetId: string; expires: number; seen: number; revoked?: boolean }
export const AYUDA_CONECTOR_EA = "Conector Windows no conectado. Abre Configurar Enterprise Architect en este asistente, descarga el ZIP y ejecuta Setup.cmd (guía: desktop/ea/CONNECTOR.md). Selecciona el repositorio y los paquetes localmente y usa el código temporal. No se ejecutó ninguna operación EA."

/** Sessions are expiring/revocable; jobs + claim state are durable private message workflows. */
export class ConectorEA {
  private readonly sesiones = new Map<string, Sesion>()
  private readonly codigos = new Map<string, { acceso: ContextoAccesoProyecto; expires: number }>()
  constructor(private readonly repo: RepositorioMensajes, private readonly cerrar: (a: ContextoAccesoProyecto, f: FlujoAsistentePersistido) => Promise<void>,
    private readonly importar?: (f: FlujoAsistentePersistido, datos: Buffer) => Promise<void>) {}

  crearCodigo(acceso: ContextoAccesoProyecto) {
    for (const [codigo, c] of this.codigos) if (c.expires < Date.now() || (c.acceso.projectId === acceso.projectId && c.acceso.participantId === acceso.participantId)) this.codigos.delete(codigo)
    if (this.codigos.size >= 1000) throw new ErrorFlujoAsistente(429, "Demasiados códigos temporales.")
    const codigo = randomBytes(18).toString("base64url"), expires = Date.now() + 3 * 60_000
    this.codigos.set(codigo, { acceso: { ...acceso }, expires })
    return { codigo, expires }
  }
  canjear(entrada: unknown) {
    const parsed = esquemaPareadoEA.extend({ codigo: z.string().regex(/^[A-Za-z0-9_-]{24}$/) }).safeParse(entrada)
    if (!parsed.success) throw new ErrorFlujoAsistente(400, "Código o selección local inválidos.")
    const c = this.codigos.get(parsed.data.codigo)
    if (!c || c.expires < Date.now()) throw new ErrorFlujoAsistente(403, "Código vencido o ya utilizado. Genera otro en el asistente.")
    this.codigos.delete(parsed.data.codigo)
    const { codigo: _codigo, ...seleccion } = parsed.data
    return { ...this.parear(c.acceso, seleccion), projectId: c.acceso.projectId }
  }
  accesoToken(token: string) {
    const s = this.sesiones.get(token)
    if (!s) throw new ErrorFlujoAsistente(403, "Conector no autorizado.")
    return { ...this.sesion(s.acceso, token).acceso }
  }

  parear(acceso: ContextoAccesoProyecto, entrada: unknown) {
    const parsed = esquemaPareadoEA.safeParse(entrada)
    if (!parsed.success) throw new ErrorFlujoAsistente(400, "Autorización de conector inválida.")
    for (const [token, s] of this.sesiones) if (s.expires + 24 * 60 * 60_000 < Date.now() || (s.acceso.projectId === acceso.projectId && s.acceso.participantId === acceso.participantId)) this.sesiones.delete(token)
    if (this.sesiones.size >= 1000) throw new ErrorFlujoAsistente(429, "Demasiados conectores activos.")
    const token = randomBytes(32).toString("base64url"), expires = Date.now() + 8 * 60 * 60_000
    this.sesiones.set(token, { acceso: { ...acceso }, deviceId: parsed.data.deviceId, targetId: parsed.data.targetId, expires, seen: 0 })
    return { token, expires }
  }
  sesion(acceso: ContextoAccesoProyecto, token: string) {
    const s = this.sesiones.get(token)
    if (!s || s.revoked || s.expires < Date.now() || s.acceso.projectId !== acceso.projectId || s.acceso.participantId !== acceso.participantId) throw new ErrorFlujoAsistente(403, "Autorización de conector vencida o inválida.")
    return s
  }
  revocar(acceso: ContextoAccesoProyecto, token: string) { this.sesion(acceso, token).revoked = true }
  revocarParticipante(acceso: ContextoAccesoProyecto) {
    for (const s of this.sesiones.values()) if (s.acceso.projectId === acceso.projectId && s.acceso.participantId === acceso.participantId) s.revoked = true
    for (const [codigo, c] of this.codigos) if (c.acceso.projectId === acceso.projectId && c.acceso.participantId === acceso.participantId) this.codigos.delete(codigo)
  }
  async estado(acceso: ContextoAccesoProyecto): Promise<EstadoConectorEA> {
    const s = [...this.sesiones.values()].find((s) => s.acceso.projectId === acceso.projectId && s.acceso.participantId === acceso.participantId)
    if (!s) return { estado: "not_configured" }
    const estado = s.revoked ? "disconnected" : s.expires < Date.now() ? "expired" : !s.seen || Date.now() - s.seen >= 30_000 ? "disconnected" : "connected"
    const base = { estado, expires: s.expires, lastSeen: s.seen } as EstadoConectorEA
    if (estado !== "connected") return base
    const pagina = await this.repo.listarPorProyecto({ projectId: acceso.projectId, limite: 100 })
    for (const m of pagina.items) {
      if (m.participantId !== acceso.participantId || !m.requestId) continue
      const f = await this.repo.obtenerFlujo(acceso.projectId, m.requestId)
      if (!f?.ea || f.ea.targetId !== s.targetId || f.ea.deviceId !== s.deviceId) continue
      await this.expirar(acceso, f)
      return { ...base, estado: ["queued", "importing"].includes(f.estado) ? "in_progress" : f.estado === "failed" ? "failed" : ["ready", "review", "applied"].includes(f.estado) ? "verified" : "connected", trabajo: { requestId: f.requestId, estado: f.estado } }
    }
    return base
  }
  preparar(acceso: ContextoAccesoProyecto, datos: Buffer) {
    const s = [...this.sesiones.values()].find((s) => !s.revoked && s.expires > Date.now() && s.seen > 0 && Date.now() - s.seen < 30_000 && s.acceso.projectId === acceso.projectId && s.acceso.participantId === acceso.participantId)
    if (!s) throw new ErrorFlujoAsistente(503, AYUDA_CONECTOR_EA)
    return { deviceId: s.deviceId, targetId: s.targetId, expires: Date.now() + 5 * 60_000, sha256: createHash("sha256").update(datos).digest("hex") }
  }
  disponible(acceso: ContextoAccesoProyecto) { this.preparar(acceso, Buffer.alloc(0)) }

  async siguiente(acceso: ContextoAccesoProyecto, token: string) {
    const s = this.sesion(acceso, token); s.seen = Date.now()
    const pagina = await this.repo.listarPorProyecto({ projectId: acceso.projectId, limite: 100 })
    for (const m of pagina.items) {
      if (m.participantId !== acceso.participantId || !m.requestId) continue
      const f = await this.repo.obtenerFlujo(acceso.projectId, m.requestId)
      if (!f?.ea || f.ea.deviceId !== s.deviceId || f.ea.targetId !== s.targetId) continue
      await this.expirar(acceso, f)
      if (f.estado !== "queued" || (!f.archivo && f.operacion !== "importar_desde_ea")) continue
      f.estado = "importing"; f.resumen = f.operacion === "importar_desde_ea"
        ? "Conector Windows exportando el paquete EA aprobado localmente. Pendiente de lectura COM y vista previa CU06; el UML no se ha reemplazado."
        : "Conector Windows recibió el XMI. Importando y verificando el paquete EA aislado; éxito todavía no confirmado."
      if (!await this.repo.actualizarFlujo(f, "queued")) continue
      return { requestId: f.requestId, projectId: f.projectId, participantId: f.participantId, targetId: f.ea.targetId, expires: f.ea.expires, direction: f.operacion === "importar_desde_ea" ? "ea_to_nexo" : "nexo_to_ea", sha256: f.ea.sha256, ...(f.archivo ? { xmi: f.archivo.base64 } : {}) }
    }
    return null
  }
  async expirar(acceso: ContextoAccesoProyecto, f: FlujoAsistentePersistido) {
    if (f.ea && f.ea.expires < Date.now() && ["queued", "importing"].includes(f.estado)) {
      const esperado = f.estado
      f.estado = "failed"; f.resumen = "El conector EA no confirmó el trabajo antes de su vencimiento. Resultado desconocido; inspecciona el paquete por requestId antes de repetir."
      if (await this.repo.actualizarFlujo(f, esperado)) await this.cerrar(acceso, f)
    }
  }
  async recibir(acceso: ContextoAccesoProyecto, token: string, entrada: unknown) {
    const s = this.sesion(acceso, token)
    const parsed = esquemaReciboEA.safeParse(entrada)
    if (!parsed.success) throw new ErrorFlujoAsistente(400, "Recibo EA inválido.")
    const r = parsed.data, f = await this.repo.obtenerFlujo(acceso.projectId, r.requestId)
    if (!f?.ea || f.participantId !== acceso.participantId || f.ea.deviceId !== s.deviceId || f.ea.targetId !== s.targetId) throw new ErrorFlujoAsistente(403, "Trabajo EA no autorizado.")
    if (["ready", "failed", "review", "issued", "applied", "cancelled"].includes(f.estado)) return { status: f.estado }
    if (f.estado !== "importing") throw new ErrorFlujoAsistente(409, "El trabajo no fue entregado al conector.")
    await this.expirar(acceso, f)
    if (f.ea.expires < Date.now()) return { status: "failed" }
    if (f.operacion === "importar_desde_ea" && r.status === "exported") {
      if (!r.xmi || !r.sha256 || !r.inspection || !this.importar || !/^[A-Za-z0-9+/]+={0,2}$/.test(r.xmi)) throw new ErrorFlujoAsistente(400, "Exportación EA incompleta; se requieren XMI e inspección COM.")
      const datos = Buffer.from(r.xmi, "base64")
      if (!datos.length || datos.length > 5 * 1024 * 1024 || datos.toString("base64") !== r.xmi || createHash("sha256").update(datos).digest("hex") !== r.sha256) throw new ErrorFlujoAsistente(400, "Integridad o tamaño de XMI inválidos.")
      try { new TextDecoder("utf-8", { fatal: true }).decode(datos) } catch { throw new ErrorFlujoAsistente(400, "XMI debe usar UTF-8.") }
      if (/<!DOCTYPE|<!ENTITY/i.test(datos.toString("utf8"))) throw new ErrorFlujoAsistente(400, "DTD y entidades externas no permitidas.")
      try {
        await conProcedencia(f.requestId, async () => { await this.importar!(f, datos); f.procedencia = procedenciaActual() })
        const diferencias = verificarInspeccion({ modeloBase: f.modeloResultado! }, r.inspection)
        f.ea.packageGuid = r.inspection.packageGuid
        const metodos = r.inspection.classes.reduce((n, c) => n + c.methods, 0)
        f.advertencias.push(...diferencias.map((p) => `Diferencia EA/CU06: ${p}`),
          ...(metodos ? [`EA contiene ${metodos} operaciones; el perfil CU06 no conserva métodos/parámetros.`] : []),
          ...(r.inspection.unsupported?.elements ? [`EA contiene ${r.inspection.unsupported.elements} elementos fuera de Class; su conservación no está garantizada.`] : []),
          "No se garantiza disposición de diagramas, GUIDs, versión canónica ni el marcador asociativo propio de NexoCASE en XMI exportado por EA.")
        f.advertencias = [...new Set(f.advertencias)].slice(0, 100)
        f.resumen = `Exportación del paquete EA leída por COM y analizada por CU06. ${f.resumen}`
      } catch (error) {
        f.estado = "failed"; f.resumen = "CU06 rechazó el XMI del paquete EA o no está disponible. No se modificó el UML; revisa el perfil compatible y vuelve a solicitar la importación."
        if (await this.repo.actualizarFlujo(f, "importing")) await this.cerrar(acceso, f)
        throw error
      }
      if (!await this.repo.actualizarFlujo(f, "importing")) throw new ErrorFlujoAsistente(409, "El recibo ya fue procesado.")
      // No consumir completionRequestId antes de la decisión/aplicación del editor.
      return { status: f.estado }
    }
    if (r.status === "exported" || (f.operacion === "importar_desde_ea" && r.status !== "failed")) throw new ErrorFlujoAsistente(400, "El recibo no corresponde a la dirección del trabajo.")
    const inspection = r.inspection
    const problemas = inspection ? verificarInspeccion(f, inspection) : ["No se recibió inspección COM del repositorio."]
    const valido = r.status === "verified" && inspection && problemas.length === 0
    f.estado = valido ? "ready" : "failed"
    f.resumen = valido ? `Importación confirmada por lectura COM de Enterprise Architect: ${inspection.classes.length} clases, ${inspection.classes.reduce((n, c) => n + c.attributes.length, 0)} atributos y ${inspection.relationships.length} relaciones en paquete aislado ${inspection.packageGuid}.` : `No se confirmó una operación fiel en Enterprise Architect. ${r.code ?? "Diferencias en lectura COM"}.`
    if (valido) f.resumenModelo = { clases: inspection.classes.length, atributos: inspection.classes.reduce((n, c) => n + c.attributes.length, 0), relaciones: inspection.relationships.length }
    f.advertencias = [...f.advertencias, ...problemas]
    if (inspection) f.ea.packageGuid = inspection.packageGuid
    // Imported XMI is private and no longer downloadable after the job closes.
    delete f.archivo
    if (!await this.repo.actualizarFlujo(f, "importing")) throw new ErrorFlujoAsistente(409, "El recibo ya cambió.")
    await this.cerrar(acceso, f)
    return { status: f.estado }
  }
}

export function verificarInspeccion(f: Pick<FlujoAsistentePersistido, "modeloBase">, actual: z.infer<typeof esquemaInspeccionEA>): string[] {
  const problemas: string[] = [], modelo = f.modeloBase
  if (actual.classes.length !== modelo.clases.length) problemas.push("El número de clases difiere del UML exportado.")
  const visibility = { publica: "Public", privada: "Private", protegida: "Protected", paquete: "Package" }
  for (const c of modelo.clases) {
    const matches = actual.classes.filter((a) => a.name === c.nombre)
    const a = matches[0]
    if (!a || matches.length !== 1) { problemas.push(`Clase ausente o ambigua: ${c.nombre}.`); continue }
    if (a.abstract !== (c.abstracta ? "1" : "0")) problemas.push(`Abstracción diferente: ${c.nombre}.`)
    if (a.attributes.length !== c.atributos.length) problemas.push(`Cantidad de atributos diferente: ${c.nombre}.`)
    for (const at of c.atributos) if (!a.attributes.some((v) => v.name === at.nombre && v.type === (at.tipo ?? "") && (!at.visibilidad || v.visibility === visibility[at.visibilidad]))) problemas.push(`Atributo/tipo/visibilidad diferente: ${c.nombre}.${at.nombre}.`)
  }
  if (actual.relationships.length !== modelo.relaciones.length) problemas.push("El número de relaciones difiere del UML exportado.")
  const multiplicidad = (v: string | null) => v === "1" ? "1..1" : v ?? ""
  for (const r of modelo.relaciones) {
    const source = modelo.clases.find((c) => c.id === r.claseOrigenId)?.nombre, target = modelo.clases.find((c) => c.id === r.claseDestinoId)?.nombre
    if (!actual.relationships.some((a) => a.name === (r.nombre ?? "") && a.source === source && a.target === target && a.type === (r.tipo === "generalizacion" ? "Generalization" : "Association")
      && (r.tipo === "generalizacion" || (multiplicidad(a.sourceMultiplicity) === multiplicidad(r.multiplicidadOrigen) && multiplicidad(a.targetMultiplicity) === multiplicidad(r.multiplicidadDestino) && a.sourceRole === (r.rolOrigen ?? "") && a.targetRole === (r.rolDestino ?? "") && a.targetAggregation === (r.tipo === "composicion" ? 2 : r.tipo === "agregacion" ? 1 : 0))))) problemas.push(`Relación/extremos/multiplicidad diferentes: ${r.id}.`)
  }
  return problemas.slice(0, 100)
}
