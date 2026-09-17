import type {
  AudioParaTranscribir,
  ProveedorTranscripcionAudio,
  ResultadoTranscripcion,
} from "../../../compartido/proveedores/transcripcion/ProveedorTranscripcionAudio.js"

export async function transcribirInstruccionVoz(
  audio: AudioParaTranscribir,
  proveedor: ProveedorTranscripcionAudio,
): Promise<ResultadoTranscripcion> {
  const resultado = await proveedor.transcribir(audio)
  return { ...resultado, transcripcion: resultado.transcripcion.trim() }
}
