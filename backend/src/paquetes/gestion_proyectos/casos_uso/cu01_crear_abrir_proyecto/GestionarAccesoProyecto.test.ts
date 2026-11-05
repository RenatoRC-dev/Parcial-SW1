import { describe, expect, it } from "vitest"
import { ProtegerAccesoProyecto } from "../../acceso/ProtegerAccesoProyecto.js"
import { ErrorPersistenciaParticipante, type RepositorioParticipantes } from "../../compartido/RepositorioParticipantes.js"
import type { RepositorioProyectos } from "../../compartido/RepositorioProyectos.js"
import { crearProyectoConAcceso, ErrorNombreParticipanteInvalido, normalizarNombreParticipante } from "./GestionarAccesoProyecto.js"

describe("nombre visible del participante", () => {
  it("recorta, colapsa espacios y normaliza para búsqueda en español", () => {
    expect(normalizarNombreParticipante("  José   Pérez ")).toEqual({ visible: "José Pérez", normalizado: "jose perez" })
  })
  it("rechaza vacío, controles y longitud excesiva", () => {
    expect(() => normalizarNombreParticipante("   ")).toThrow(ErrorNombreParticipanteInvalido)
    expect(() => normalizarNombreParticipante("Carlos\u0000")).toThrow(ErrorNombreParticipanteInvalido)
    expect(() => normalizarNombreParticipante("a".repeat(61))).toThrow(ErrorNombreParticipanteInvalido)
  })

  it("compensa el proyecto si no puede persistir al participante creador", async () => {
    let idEliminado: string | null = null
    const proyectos: RepositorioProyectos = {
      listar: async () => [],
      crear: async (proyecto) => proyecto,
      obtenerPorId: async () => null,
      buscarPorCodigoAccesoDigest: async () => null,
      eliminar: async (id) => { idEliminado = id },
      guardarModeloConRevision: async () => { throw new Error("no usado") },
    }
    const participantes: RepositorioParticipantes = {
      crear: async () => { throw new ErrorPersistenciaParticipante("fallo esperado") },
      obtenerPorCredencialDigest: async () => null,
      obtenerPorId: async () => null,
    }
    await expect(crearProyectoConAcceso(
      proyectos, participantes, new ProtegerAccesoProyecto("pepper-compensacion"), "Ventas", "Renato",
    )).rejects.toBeInstanceOf(ErrorPersistenciaParticipante)
    expect(idEliminado).toMatch(/^[0-9a-f-]{36}$/)
  })
})
