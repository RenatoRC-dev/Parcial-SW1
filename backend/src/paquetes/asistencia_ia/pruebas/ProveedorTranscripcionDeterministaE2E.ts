import type {
  AudioParaTranscribir,
  ProveedorTranscripcionAudio,
  ResultadoTranscripcion,
} from "../compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"

export class ProveedorTranscripcionDeterministaE2E implements ProveedorTranscripcionAudio {
  async transcribir(_audio: AudioParaTranscribir): Promise<ResultadoTranscripcion> {
    return { transcripcion: "Crea una clase factura", modelo: "determinista-e2e" }
  }
}
