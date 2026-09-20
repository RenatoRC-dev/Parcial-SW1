import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"

export class ErrorClaseAsociativa extends Error {}

export interface SolicitudClaseAsociativa {
  nombre: string
  claseAId: string
  claseBId: string
  relacionReemplazadaId?: string
  ids: {
    clase: string
    relacionA: string
    relacionB: string
  }
}

const NOMBRE_CLASE = /^[A-Z][A-Za-z0-9]*$/

export function crearEstructuraClaseAsociativa(
  modelo: ModeloUMLCanonico,
  solicitud: SolicitudClaseAsociativa
): ModeloUMLCanonico {
  const nombre = solicitud.nombre.trim()
  if (!NOMBRE_CLASE.test(nombre)) {
    throw new ErrorClaseAsociativa("El nombre de la clase asociativa debe ser un identificador de clase válido.")
  }
  if (modelo.clases.some((clase) => clase.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
    throw new ErrorClaseAsociativa(`Ya existe una clase llamada ${nombre}.`)
  }
  const claseA = modelo.clases.find((clase) => clase.id === solicitud.claseAId)
  const claseB = modelo.clases.find((clase) => clase.id === solicitud.claseBId)
  if (!claseA || !claseB || claseA.id === claseB.id) {
    throw new ErrorClaseAsociativa("La estructura asociativa requiere dos clases existentes distintas.")
  }

  if (solicitud.relacionReemplazadaId) {
    const relacion = modelo.relaciones.find((item) => item.id === solicitud.relacionReemplazadaId)
    if (!relacion || relacion.tipo !== "asociacion"
      || relacion.multiplicidadOrigen !== "0..*" || relacion.multiplicidadDestino !== "0..*"
      || new Set([relacion.claseOrigenId, relacion.claseDestinoId]).size !== 2
      || ![relacion.claseOrigenId, relacion.claseDestinoId].every((id) => id === claseA.id || id === claseB.id)) {
      throw new ErrorClaseAsociativa("La relación N:M seleccionada ya no está disponible para convertirla.")
    }
  }

  const idsExistentes = new Set([
    ...modelo.clases.flatMap((clase) => [clase.id, ...clase.atributos.map((atributo) => atributo.id), ...(clase.metodos ?? []).flatMap((metodo) => [metodo.id, ...metodo.parametros.map((parametro) => parametro.id)])]),
    ...modelo.relaciones.map((relacion) => relacion.id),
  ])
  const idsNuevos = Object.values(solicitud.ids)
  if (new Set(idsNuevos).size !== idsNuevos.length || idsNuevos.some((id) => id.trim() === "" || idsExistentes.has(id))) {
    throw new ErrorClaseAsociativa("No se pudo asignar una identidad canónica única a la estructura asociativa.")
  }

  const claseAsociativa = {
    id: solicitud.ids.clase,
    nombre,
    tipoClase: "asociativa" as const,
    atributos: [],
    metodos: [],
    posicion: {
      x: (claseA.posicion.x + claseB.posicion.x) / 2,
      y: (claseA.posicion.y + claseB.posicion.y) / 2 + 140,
    },
    abstracta: false,
  }
  const relacionesConservadas = solicitud.relacionReemplazadaId
    ? modelo.relaciones.filter((relacion) => relacion.id !== solicitud.relacionReemplazadaId)
    : modelo.relaciones

  return {
    ...modelo,
    clases: [...modelo.clases, claseAsociativa],
    relaciones: [
      ...relacionesConservadas,
      {
        id: solicitud.ids.relacionA,
        tipo: "asociacion",
        claseOrigenId: claseA.id,
        claseDestinoId: claseAsociativa.id,
        multiplicidadOrigen: "1",
        multiplicidadDestino: "0..*",
      },
      {
        id: solicitud.ids.relacionB,
        tipo: "asociacion",
        claseOrigenId: claseAsociativa.id,
        claseDestinoId: claseB.id,
        multiplicidadOrigen: "0..*",
        multiplicidadDestino: "1",
      },
    ],
  }
}
