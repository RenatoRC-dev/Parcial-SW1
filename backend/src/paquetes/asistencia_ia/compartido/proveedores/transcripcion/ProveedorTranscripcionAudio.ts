export interface AudioParaTranscribir {
  datos: Buffer
  mimeType: string
  nombreArchivo: string
}

export interface ResultadoTranscripcion {
  transcripcion: string
  modelo: string
}

export interface ProveedorTranscripcionAudio {
  transcribir(audio: AudioParaTranscribir): Promise<ResultadoTranscripcion>
}

export class ErrorProveedorTranscripcion extends Error {
  constructor(public readonly tipo: "limite" | "no_disponible" | "respuesta_invalida", mensaje: string) {
    super(mensaje)
  }
}
