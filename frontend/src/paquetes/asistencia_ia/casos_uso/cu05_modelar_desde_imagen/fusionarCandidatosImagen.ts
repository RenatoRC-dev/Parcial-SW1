import type {
  AtributoCandidatoImagen,
  CandidatoModeloUMLImagen,
  ClaseCandidataImagen,
  RelacionCandidataImagen,
} from "./CandidatoModeloUMLImagen"

const normalizar = (valor: string) => valor.trim().toLowerCase()

function referenciaUnica(preferida: string, ocupadas: Set<string>): string {
  const base = preferida.trim() || "tmp_elemento"
  let resultado = base
  let indice = 2
  while (ocupadas.has(resultado)) resultado = `${base}_${indice++}`
  ocupadas.add(resultado)
  return resultado
}

function agregarAdvertencia(advertencias: string[], advertencia: string): void {
  if (!advertencias.includes(advertencia)) advertencias.push(advertencia)
}

function fusionarAtributos(
  clase: ClaseCandidataImagen,
  entrantes: AtributoCandidatoImagen[],
  referencias: Set<string>,
  advertencias: string[],
): void {
  for (const entrante of entrantes) {
    const existente = clase.atributos.find((atributo) => normalizar(atributo.nombre) === normalizar(entrante.nombre))
    if (!existente) {
      clase.atributos.push({ ...entrante, refTemporal: referenciaUnica(entrante.refTemporal, referencias) })
      continue
    }

    const tipoExistente = existente.tipoDato?.trim() || null
    const tipoEntrante = entrante.tipoDato?.trim() || null
    if (!tipoExistente && tipoEntrante) {
      existente.tipoDato = tipoEntrante
    } else if (tipoExistente && tipoEntrante && normalizar(tipoExistente) !== normalizar(tipoEntrante)) {
      agregarAdvertencia(
        advertencias,
        `${clase.nombre}.${existente.nombre} fue detectado con tipos diferentes: ${tipoExistente} / ${tipoEntrante}.`,
      )
    }
    if (!existente.visibilidad && entrante.visibilidad) {
      existente.visibilidad = entrante.visibilidad
    } else if (existente.visibilidad && entrante.visibilidad && existente.visibilidad !== entrante.visibilidad) {
      agregarAdvertencia(advertencias, `${clase.nombre}.${existente.nombre} fue detectado con visibilidades diferentes.`)
    }
  }
}

interface CoincidenciaRelacion {
  relacion: RelacionCandidataImagen
  invertida: boolean
}

function encontrarRelacion(
  relaciones: RelacionCandidataImagen[],
  origenRef: string,
  destinoRef: string,
  tipo: RelacionCandidataImagen["tipo"],
): CoincidenciaRelacion | undefined {
  const directa = relaciones.find((relacion) => relacion.tipo === tipo
    && relacion.origenRef === origenRef && relacion.destinoRef === destinoRef)
  if (directa) return { relacion: directa, invertida: false }
  const inversa = relaciones.find((relacion) => relacion.tipo === tipo
    && relacion.origenRef === destinoRef && relacion.destinoRef === origenRef)
  return inversa ? { relacion: inversa, invertida: true } : undefined
}

function fusionarTextoOpcional(actual: string | null, entrante: string | null): string | null {
  return actual?.trim() || entrante?.trim() || null
}

/** Fusiona hallazgos visuales sin mutar ninguno de los candidatos de entrada. */
export function fusionarCandidatosImagen(
  acumulado: CandidatoModeloUMLImagen,
  entrante: CandidatoModeloUMLImagen,
): CandidatoModeloUMLImagen {
  const resultado = structuredClone(acumulado)
  const referencias = new Set([
    ...resultado.clases.flatMap((clase) => [clase.refTemporal, ...clase.atributos.map((atributo) => atributo.refTemporal)]),
    ...resultado.relaciones.map((relacion) => relacion.refTemporal),
  ])
  const equivalencias = new Map<string, string>()

  for (const claseEntrante of entrante.clases) {
    let clase = resultado.clases.find((actual) => normalizar(actual.nombre) === normalizar(claseEntrante.nombre))
    if (!clase) {
      clase = {
        ...claseEntrante,
        nombre: claseEntrante.nombre.trim(),
        refTemporal: referenciaUnica(claseEntrante.refTemporal, referencias),
        atributos: [],
      }
      resultado.clases.push(clase)
    }
    equivalencias.set(claseEntrante.refTemporal, clase.refTemporal)
    fusionarAtributos(clase, claseEntrante.atributos, referencias, resultado.advertencias)
  }

  for (const advertencia of entrante.advertencias) agregarAdvertencia(resultado.advertencias, advertencia)

  for (const relacionEntrante of entrante.relaciones) {
    const origenRef = equivalencias.get(relacionEntrante.origenRef)
    const destinoRef = equivalencias.get(relacionEntrante.destinoRef)
    if (!origenRef || !destinoRef) {
      agregarAdvertencia(resultado.advertencias, "Una relación detectada no pudo fusionarse porque sus clases no están presentes.")
      continue
    }
    const coincidencia = encontrarRelacion(resultado.relaciones, origenRef, destinoRef, relacionEntrante.tipo)
    if (!coincidencia) {
      resultado.relaciones.push({
        ...relacionEntrante,
        refTemporal: referenciaUnica(relacionEntrante.refTemporal, referencias),
        origenRef,
        destinoRef,
      })
      continue
    }

    const { relacion, invertida } = coincidencia
    const multiplicidadOrigenEntrante = invertida ? relacionEntrante.multiplicidadDestino : relacionEntrante.multiplicidadOrigen
    const multiplicidadDestinoEntrante = invertida ? relacionEntrante.multiplicidadOrigen : relacionEntrante.multiplicidadDestino
    const rolOrigenEntrante = invertida ? relacionEntrante.rolDestino : relacionEntrante.rolOrigen
    const rolDestinoEntrante = invertida ? relacionEntrante.rolOrigen : relacionEntrante.rolDestino
    const claseOrigen = resultado.clases.find((clase) => clase.refTemporal === relacion.origenRef)?.nombre ?? relacion.origenRef
    const claseDestino = resultado.clases.find((clase) => clase.refTemporal === relacion.destinoRef)?.nombre ?? relacion.destinoRef

    if (relacion.multiplicidadOrigen !== multiplicidadOrigenEntrante
      || relacion.multiplicidadDestino !== multiplicidadDestinoEntrante) {
      agregarAdvertencia(
        resultado.advertencias,
        `La relación ${claseOrigen} / ${claseDestino} fue detectada con multiplicidades diferentes: ${relacion.multiplicidadOrigen}-${relacion.multiplicidadDestino} / ${multiplicidadOrigenEntrante}-${multiplicidadDestinoEntrante}.`,
      )
    }
    relacion.rolOrigen = fusionarTextoOpcional(relacion.rolOrigen, rolOrigenEntrante)
    relacion.rolDestino = fusionarTextoOpcional(relacion.rolDestino, rolDestinoEntrante)
  }

  return resultado
}
