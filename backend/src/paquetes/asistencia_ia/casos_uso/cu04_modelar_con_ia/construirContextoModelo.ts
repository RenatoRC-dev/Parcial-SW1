import type { ModeloUMLCanonicoIA } from "../../compartido/contrato/ComandoModeloUML.js"

export function construirContextoModelo(modelo: ModeloUMLCanonicoIA) {
  const nombres = new Map(modelo.clases.map((clase) => [clase.id, clase.nombre]))
  return {
    id: modelo.id,
    clases: modelo.clases.map((clase) => ({
      id: clase.id,
      nombre: clase.nombre,
      abstracta: clase.abstracta,
      tipoClase: clase.tipoClase === "asociativa" ? "asociativa" : "normal",
      atributos: clase.atributos.map((atributo) => ({
        id: atributo.id,
        nombre: atributo.nombre,
        tipo: atributo.tipo,
        visibilidad: atributo.visibilidad ?? null,
      })),
      metodos: (clase.metodos ?? []).map((metodo) => ({
        id: metodo.id,
        nombre: metodo.nombre,
        visibilidad: metodo.visibilidad,
        tipoRetorno: metodo.tipoRetorno,
        parametros: metodo.parametros.map((parametro) => ({
          id: parametro.id,
          nombre: parametro.nombre,
          tipo: parametro.tipo,
        })),
      })),
    })),
    relaciones: modelo.relaciones.map((relacion) => ({
      id: relacion.id,
      tipo: relacion.tipo,
      origen: { id: relacion.claseOrigenId, nombre: nombres.get(relacion.claseOrigenId) ?? null },
      destino: { id: relacion.claseDestinoId, nombre: nombres.get(relacion.claseDestinoId) ?? null },
      multiplicidadOrigen: relacion.multiplicidadOrigen,
      multiplicidadDestino: relacion.multiplicidadDestino,
      rolOrigen: relacion.rolOrigen ?? null,
      rolDestino: relacion.rolDestino ?? null,
    })),
  }
}
