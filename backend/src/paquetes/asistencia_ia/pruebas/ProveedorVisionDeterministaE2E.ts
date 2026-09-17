import type { ResultadoVisionUML } from "../compartido/contrato/CandidatoModeloUMLImagen.js"
import type { ImagenParaAnalizar, ProveedorVisionUML } from "../compartido/proveedores/vision/ProveedorVisionUML.js"

export class ProveedorVisionDeterministaE2E implements ProveedorVisionUML {
  async analizarImagen(_imagen: ImagenParaAnalizar): Promise<ResultadoVisionUML> {
    return {
      resultado: "candidato",
      mensaje: "Se detectaron dos clases y una asociación.",
      modelo: "determinista-e2e",
      candidato: {
        clases: [
          { refTemporal: "tmp_factura", nombre: "Factura", atributos: [
            { refTemporal: "tmp_numero", nombre: "numero", tipoDato: "String" },
            { refTemporal: "tmp_total", nombre: "total", tipoDato: "Double" },
          ] },
          { refTemporal: "tmp_cliente", nombre: "ClienteImagen", atributos: [
            { refTemporal: "tmp_nombre", nombre: "nombre", tipoDato: "String" },
          ] },
        ],
        relaciones: [{
          refTemporal: "tmp_relacion",
          tipo: "asociacion",
          origenRef: "tmp_cliente",
          destinoRef: "tmp_factura",
          multiplicidadOrigen: "1",
          multiplicidadDestino: "0..*",
          rolOrigen: "cliente",
          rolDestino: "facturas",
        }],
        advertencias: [],
      },
    }
  }
}
