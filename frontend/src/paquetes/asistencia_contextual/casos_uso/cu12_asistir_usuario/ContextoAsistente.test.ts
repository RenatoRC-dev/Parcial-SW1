import { describe, expect, it } from "vitest"
import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { evaluarAptitudGeneracionSpring } from "../../../generacion_backend/casos_uso/cu09_generar_backend_spring_boot/EvaluadorAptitudGeneracionSpring"
import { validarModelo } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { construirContextoAsistente, obtenerGrupoPreguntasRapidas, obtenerOrientacionDeterminista } from "./ContextoAsistente"

const clases = [
  { id: "usuario", nombre: "Usuario", abstracta: false, posicion: { x: 0, y: 0 }, atributos: [{ id: "usuario-id", nombre: "id", tipo: "Long" as const, visibilidad: "privada" as const }], metodos: [] },
  { id: "rol", nombre: "Rol", abstracta: false, posicion: { x: 300, y: 0 }, atributos: [{ id: "rol-id", nombre: "id", tipo: "Long" as const, visibilidad: "privada" as const }], metodos: [] },
]

function contexto(modelo: ModeloUMLCanonico, candidatoImagenPendiente = false, seleccionIds: string[] = []) {
  const validacion = validarModelo(modelo)
  return construirContextoAsistente({ proyectoId: "p", modelo, validacion, aptitud: evaluarAptitudGeneracionSpring(modelo, validacion), cambiosSinGuardar: true, candidatoImagenPendiente, seleccionIds, revisionModelo: 4, idioma: "es" })
}

describe("contexto determinista de CU12", () => {
  it("distingue UML válido de un N:M que bloquea generación", () => {
    const modelo: ModeloUMLCanonico = { id: "m", nombre: "Accesos", version: "1", clases, relaciones: [{ id: "rel-nm", tipo: "asociacion", claseOrigenId: "usuario", claseDestinoId: "rol", multiplicidadOrigen: "0..*", multiplicidadDestino: "0..*" }] }
    const actual = contexto(modelo)
    expect(actual.estadoUml.estado).toBe("valido")
    expect(actual.generacion.estado).toBe("no_apto")
    expect(actual.generacion.bloqueos.join(" ")).toContain("N:M directo")
    expect(obtenerOrientacionDeterminista(actual)).toBe("NM_DIRECTO")
    expect(actual.modeloActual.clases[0].atributos).toEqual([expect.objectContaining({ nombre: "id", tipo: "Long" })])
    expect(actual.modeloActual.relaciones[0]).toEqual(expect.objectContaining({ origen: expect.objectContaining({ nombre: "Usuario", multiplicidad: "0..*" }), destino: expect.objectContaining({ nombre: "Rol", multiplicidad: "0..*" }) }))
    expect(JSON.stringify(actual.modeloActual)).not.toContain("posicion")
    expect(actual.revisionModelo).toBe(4)
  })

  it("indica que un modelo válido y apto puede generarse", () => {
    const factura = { ...clases[0], id: "factura", nombre: "Factura", atributos: [{ id: "factura-id", nombre: "id", tipo: "Long" as const, visibilidad: "privada" as const }] }
    const detalle = { ...clases[1], id: "detalle", nombre: "DetalleFactura", atributos: [{ id: "detalle-id", nombre: "id", tipo: "Long" as const, visibilidad: "privada" as const }] }
    const modelo: ModeloUMLCanonico = { id: "m", nombre: "Listo", version: "1", clases: [factura, detalle], relaciones: [{ id: "r", tipo: "asociacion", claseOrigenId: "factura", claseDestinoId: "detalle", multiplicidadOrigen: "1", multiplicidadDestino: "1..*" }] }
    const actual = contexto(modelo)
    expect(actual.generacion.estado).toBe("apto")
    expect(actual.generacion.advertencias).toEqual([expect.stringContaining("Factura (1)")])
    expect(obtenerOrientacionDeterminista(actual)).toBe("LISTO_GENERAR")
  })

  it("prioriza un candidato de imagen pendiente sin alterar el modelo", () => {
    const modelo: ModeloUMLCanonico = { id: "m", nombre: "Imagen", version: "1", clases: [clases[0]], relaciones: [] }
    const antes = structuredClone(modelo)
    const actual = contexto(modelo, true)
    expect(actual.candidatoImagenPendiente).toBe(true)
    expect(actual.accionesDisponibles).toContain("MOSTRAR_IMAGEN_CANDIDATA")
    expect(obtenerOrientacionDeterminista(actual)).toBe("IMAGEN_PENDIENTE")
    expect(modelo).toEqual(antes)
  })

  it("no ofrece mostrar un candidato de imagen inexistente", () => {
    const modelo: ModeloUMLCanonico = { id: "m", nombre: "Sin candidato", version: "1", clases: [clases[0]], relaciones: [] }
    expect(contexto(modelo, false).accionesDisponibles).not.toContain("MOSTRAR_IMAGEN_CANDIDATA")
  })

  it("incluye la clase o relación seleccionada con sus detalles semánticos", () => {
    const modelo: ModeloUMLCanonico = { id: "m", nombre: "Accesos", version: "1", clases, relaciones: [{ id: "rel", nombre: "asigna", tipo: "asociacion", claseOrigenId: "usuario", claseDestinoId: "rol", multiplicidadOrigen: "1", multiplicidadDestino: "0..*" }] }
    const conClase = contexto(modelo, false, ["usuario"])
    expect(conClase.elementoSeleccionado).toEqual(expect.objectContaining({ tipo: "clase", nombre: "Usuario", atributos: [expect.objectContaining({ nombre: "id" })] }))
    expect(obtenerGrupoPreguntasRapidas(conClase)).toBe("CLASE_SELECCIONADA")
    const conRelacion = contexto(modelo, false, ["rel"])
    expect(conRelacion.elementoSeleccionado).toEqual(expect.objectContaining({ tipo: "relacion", nombre: "asigna", origen: expect.objectContaining({ nombre: "Usuario" }), destino: expect.objectContaining({ nombre: "Rol" }) }))
    expect(obtenerGrupoPreguntasRapidas(conRelacion)).toBe("RELACION_SELECCIONADA")
  })
})
