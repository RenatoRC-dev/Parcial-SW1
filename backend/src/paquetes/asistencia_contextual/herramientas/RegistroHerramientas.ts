import { z } from "zod"
import { randomUUID } from "node:crypto"
import type { ContextoAccesoProyecto } from "../../gestion_proyectos/api/ContextoAccesoProyecto.js"
import type { PreguntaAsistenteColaborativo } from "../compartido/ContratoPreguntaColaborativa.js"
import { validarModelo } from "../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML.js"
import { evaluarAptitudGeneracionSpring } from "../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/PrepararProyectoSpring.js"
import { detectarComandoFlujo, ErrorFlujoAsistente, type EjecutarFlujosAsistente } from "../casos_uso/cu12_asistir_usuario/EjecutarFlujosAsistente.js"

const base = { contextId: z.string().uuid(), expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }
export const herramientas = {
  uml_read_model: { description: "Read the authenticated participant's pinned UML snapshot (not an implicit Save).", schema: z.object(base).strict() },
  uml_validate: { description: "CU08 validation and existing Spring eligibility; no model changes.", schema: z.object(base).strict() },
  uml_request_change: { description: "CU04 interprets the original human instruction; only the requesting editor may apply the validated plan.", schema: z.object(base).strict() },
  xmi_export: { description: "CU07 exports actual XMI as an authenticated conversation artifact.", schema: z.object(base).strict() },
  xmi_import: { description: "CU06 preview only; replacement requires separate requester confirmation in the editor.", schema: z.object({ ...base, xml: z.string().min(1).max(5 * 1024 * 1024) }).strict() },
  spring_generate: { description: "CU08/09 eligibility, existing Spring generator and CU10 ZIP artifact.", schema: z.object(base).strict() },
  ea_import_model: { description: "Export CU07 to the paired Windows connector's locally selected isolated EA destination. Success requires COM readback.", schema: z.object(base).strict() },
} as const
export type NombreHerramienta = keyof typeof herramientas
export interface ContextoHerramienta { acceso: ContextoAccesoProyecto; pregunta: PreguntaAsistenteColaborativo; expires: number }

/** One dispatcher for chat and MCP. All domain work remains in existing use cases. */
export class RegistroHerramientas {
  private readonly contextos = new Map<string, ContextoHerramienta>()
  constructor(private readonly flujos: EjecutarFlujosAsistente,
    private readonly solicitarCambio: (a: ContextoAccesoProyecto, p: PreguntaAsistenteColaborativo) => Promise<unknown>) {}

  crearContexto(acceso: ContextoAccesoProyecto, pregunta: PreguntaAsistenteColaborativo): string {
    if (!pregunta.modeloEjecucion || pregunta.revisionEditor === undefined || JSON.stringify(pregunta).length > 800_000) throw new ErrorFlujoAsistente(400, "Se requiere UML vivo y revisión acotados.")
    for (const [id, c] of this.contextos) {
      if (c.expires < Date.now() || (c.acceso.projectId === acceso.projectId && c.acceso.participantId === acceso.participantId)) this.contextos.delete(id)
    }
    if (this.contextos.size >= 1000) throw new ErrorFlujoAsistente(429, "Demasiados contextos activos.")
    const id = randomUUID()
    this.contextos.set(id, { acceso: { ...acceso }, pregunta: structuredClone(pregunta), expires: Date.now() + 5 * 60_000 })
    return id
  }

  async invocar(acceso: ContextoAccesoProyecto, nombre: string, entrada: unknown) {
    if (!Object.hasOwn(herramientas, nombre)) throw new ErrorFlujoAsistente(400, "Herramienta no permitida.")
    const tool = nombre as NombreHerramienta
    const parsed = herramientas[tool].schema.safeParse(entrada)
    if (!parsed.success) throw new ErrorFlujoAsistente(400, "Argumentos de herramienta inválidos.")
    const contexto = this.contextos.get(parsed.data.contextId)
    if (!contexto || contexto.expires < Date.now() || contexto.acceso.projectId !== acceso.projectId || contexto.acceso.participantId !== acceso.participantId) throw new ErrorFlujoAsistente(403, "Contexto no autorizado o vencido.")
    if (parsed.data.expectedRevision !== contexto.pregunta.revisionEditor) throw new ErrorFlujoAsistente(409, "La revisión no corresponde al contexto actual.")
    return this.ejecutar(tool, contexto, "xml" in parsed.data && typeof parsed.data.xml === "string" ? parsed.data.xml : undefined)
  }

  async ejecutar(nombre: NombreHerramienta, contexto: ContextoHerramienta, xml?: string) {
    const { acceso, pregunta } = contexto
    if (!pregunta.modeloEjecucion || pregunta.revisionEditor === undefined || contexto.expires < Date.now()) throw new ErrorFlujoAsistente(409, "Contexto UML vencido o incompleto.")
    const modelo = pregunta.modeloEjecucion
    let outcome: unknown
    let status: "completed" | "pending" | "review_required" | "failed" | "returned" = "completed"
    let message = "Operación de lectura completada sobre el snapshot autorizado."
    let warnings: string[] = []
    if (nombre === "uml_read_model") outcome = { modelo, revision: pregunta.revisionEditor }
    else if (nombre === "uml_validate") {
      const validacion = validarModelo(modelo), spring = evaluarAptitudGeneracionSpring(modelo, validacion)
      outcome = { validacion, spring, resumen: `Validación completada sobre la revisión local ${pregunta.revisionEditor}. UML ${validacion.valido ? "válido" : "inválido"}. Spring: ${spring.apto ? "apto" : "no apto"}.\n${validacion.diagnosticos.slice(0, 12).map((d) => d.mensaje).join("\n")}\n${spring.motivos.slice(0, 8).join("\n")}` }
    }
    else if (nombre === "uml_request_change") {
      outcome = await this.solicitarCambio(acceso, pregunta)
      status = "returned"; message = "Resultado del orquestador CU04. La aplicación al UML corresponde exclusivamente al editor solicitante y su comprobación de revisión."
    }
    else {
      const operacion = { xmi_export: "exportar_xmi", xmi_import: "importar_xmi", spring_generate: "generar_spring", ea_import_model: "automatizar_ea" } as const
      if (nombre !== "xmi_import" && detectarComandoFlujo(pregunta.contenido) !== operacion[nombre]) throw new ErrorFlujoAsistente(403, "La herramienta no corresponde a la operación autorizada en el turno humano.")
      if (nombre === "xmi_import" && !xml) throw new ErrorFlujoAsistente(400, "Se requiere XMI para la vista previa.")
      const resultado = await this.flujos.ejecutar(acceso, pregunta, operacion[nombre], xml ? { tipo: "xmi", nombre: "modelo.xmi", mime: "application/xml", datos: Buffer.from(xml) } : undefined)
      outcome = resultado; message = resultado.flujo.resumen; warnings = resultado.flujo.advertencias
      status = ["queued", "importing", "processing"].includes(resultado.flujo.estado) ? "pending"
        : ["review", "issued"].includes(resultado.flujo.estado) ? "review_required"
          : ["failed", "cancelled"].includes(resultado.flujo.estado) ? "failed" : "completed"
    }
    return { toolCallId: `${pregunta.requestId}:${nombre}`, requestId: pregunta.requestId, projectId: acceso.projectId,
      participantId: acceso.participantId, revision: pregunta.revisionEditor, kind: nombre, status, message, warnings, outcome }
  }
}
