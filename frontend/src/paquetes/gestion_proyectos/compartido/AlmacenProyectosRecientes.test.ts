import { beforeEach, describe, expect, it } from "vitest"
import {
  CLAVE_PROYECTOS_RECIENTES,
  guardarProyectoReciente,
  listarProyectosRecientes,
  quitarProyectoReciente,
  type ProyectoReciente,
} from "./AlmacenProyectosRecientes"

const entrada = (projectId: string, credential = `credencial-${projectId}`): ProyectoReciente => ({
  projectId,
  projectName: `Proyecto ${projectId}`,
  participantId: `participante-${projectId}`,
  displayName: "Renato",
  credential,
  lastOpenedAt: `2026-11-05T00:00:0${projectId}.000Z`,
})

describe("almacén local de proyectos recientes", () => {
  beforeEach(() => localStorage.clear())

  it("parte vacío y tolera JSON corrupto o versión desconocida", () => {
    expect(listarProyectosRecientes()).toEqual([])
    localStorage.setItem(CLAVE_PROYECTOS_RECIENTES, "{invalido")
    expect(listarProyectosRecientes()).toEqual([])
    localStorage.setItem(CLAVE_PROYECTOS_RECIENTES, JSON.stringify({ version: 2, proyectos: [entrada("1")] }))
    expect(listarProyectosRecientes()).toEqual([])
  })

  it("guarda una credencial sin almacenar código de acceso ni digest", () => {
    guardarProyectoReciente(entrada("1", "credencial-opaca"))
    expect(listarProyectosRecientes()[0]?.credential).toBe("credencial-opaca")
    const crudo = localStorage.getItem(CLAVE_PROYECTOS_RECIENTES) ?? ""
    expect(crudo).not.toContain("codigoAcceso")
    expect(crudo).not.toContain("credencialDigest")
  })

  it("reemplaza el acceso del mismo proyecto y conserva proyectos diferentes", () => {
    guardarProyectoReciente(entrada("1", "anterior"))
    guardarProyectoReciente(entrada("2"))
    guardarProyectoReciente({ ...entrada("1", "nueva"), displayName: "Carlos", lastOpenedAt: "2026-11-05T01:00:00.000Z" })
    const proyectos = listarProyectosRecientes()
    expect(proyectos).toHaveLength(2)
    expect(proyectos.find((proyecto) => proyecto.projectId === "1")).toMatchObject({ credential: "nueva", displayName: "Carlos" })
  })

  it("descarta entradas inválidas y permite quitar acceso local", () => {
    localStorage.setItem(CLAVE_PROYECTOS_RECIENTES, JSON.stringify({ version: 1, proyectos: [entrada("1"), { projectId: "roto" }] }))
    expect(listarProyectosRecientes()).toHaveLength(1)
    expect(quitarProyectoReciente("1")).toEqual([])
    expect(listarProyectosRecientes()).toEqual([])
  })
})
