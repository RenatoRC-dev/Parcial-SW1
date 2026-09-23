import type { ModeloUMLCanonico } from "../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { TIPOS_GENERACION_SOPORTADOS, type ResultadoValidacion } from "../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"

export interface ResultadoAptitudGeneracion {
  apto: boolean
  motivos: string[]
  advertencias: Array<{
    codigo: "CARDINALIDAD_MINIMA_COLECCION"
    relacion: string
  }>
}

const nombresEnConflicto = new Set([
  "String", "Integer", "Long", "Double", "Float", "Boolean",
  "BigDecimal", "LocalDate", "LocalDateTime", "UUID",
])
const identificadorCampo = /^[a-z][A-Za-z0-9]*$/
const palabrasReservadasJava = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch",
  "char", "class", "const", "continue", "default", "do", "double",
  "else", "enum", "extends", "final", "finally", "float", "for",
  "goto", "if", "implements", "import", "instanceof", "int", "interface",
  "long", "native", "new", "package", "private", "protected", "public",
  "return", "short", "static", "strictfp", "super", "switch",
  "synchronized", "this", "throw", "throws", "transient", "try", "void",
  "volatile", "while",
])
const tiposSoportados = new Set<string>(TIPOS_GENERACION_SOPORTADOS)

function resumir(referencias: string[]): string {
  const visibles = referencias.slice(0, 5).join(", ")
  return referencias.length > 5 ? `${visibles} y ${referencias.length - 5} más` : visibles
}

function convertirAVariable(nombreClase: string): string {
  return nombreClase.charAt(0).toLowerCase() + nombreClase.slice(1)
}

function describirRelacion(
  relacion: ModeloUMLCanonico["relaciones"][number],
  clasesPorId: ReadonlyMap<string, ModeloUMLCanonico["clases"][number]>,
): string {
  const origen = clasesPorId.get(relacion.claseOrigenId)?.nombre ?? "clase origen inexistente"
  const destino = clasesPorId.get(relacion.claseDestinoId)?.nombre ?? "clase destino inexistente"
  const extremos = `${origen} (${relacion.multiplicidadOrigen ?? "sin multiplicidad"}) ↔ ${destino} (${relacion.multiplicidadDestino ?? "sin multiplicidad"})`
  return relacion.nombre?.trim() ? `«${relacion.nombre.trim()}» — ${extremos}` : extremos
}

export function evaluarAptitudGeneracionSpring(
  modelo: ModeloUMLCanonico,
  validacion: ResultadoValidacion
): ResultadoAptitudGeneracion {
  const motivos: string[] = []
  const advertencias: ResultadoAptitudGeneracion["advertencias"] = []

  for (const clase of modelo.clases) {
    if (clase.abstracta) motivos.push(`La clase abstracta ${clase.nombre} no puede generarse todavía.`)
    if (nombresEnConflicto.has(clase.nombre.trim())) {
      motivos.push(`El nombre de entidad ${clase.nombre} entra en conflicto con un tipo Java.`)
    }
  }

  const atributosSinTipo: string[] = []
  const atributosTipoNoSoportado: string[] = []
  const identificadoresExplicitosInvalidos: string[] = []
  for (const clase of modelo.clases) {
    for (const atributo of clase.atributos) {
      const referencia = `${clase.nombre}.${atributo.nombre}`
      const tipo = atributo.tipo?.trim()
      if (!tipo) atributosSinTipo.push(referencia)
      else if (!tiposSoportados.has(tipo)) atributosTipoNoSoportado.push(`${referencia} (${tipo})`)
      if (atributo.nombre.trim() === "id" && tipo !== "Long") identificadoresExplicitosInvalidos.push(referencia)
    }
  }
  if (atributosSinTipo.length > 0) motivos.push(`${atributosSinTipo.length} atributos no tienen tipo para generar: ${resumir(atributosSinTipo)}.`)
  if (atributosTipoNoSoportado.length > 0) motivos.push(`${atributosTipoNoSoportado.length} atributos usan tipos no soportados para generar: ${resumir(atributosTipoNoSoportado)}.`)
  if (identificadoresExplicitosInvalidos.length > 0) motivos.push(`El identificador explícito id debe usar Long: ${resumir(identificadoresExplicitosInvalidos)}.`)

  const clasesPorId = new Map(modelo.clases.map((clase) => [clase.id, clase]))
  for (const asociativa of modelo.clases.filter((clase) => clase.tipoClase === "asociativa")) {
    const incidentes = modelo.relaciones.filter((relacion) => relacion.claseOrigenId === asociativa.id || relacion.claseDestinoId === asociativa.id)
    if (incidentes.length !== 2) {
      motivos.push(`La clase asociativa ${asociativa.nombre} debe conectar exactamente dos clases principales.`)
      continue
    }
    const principales = incidentes.map((relacion) => {
      const asociativaEsOrigen = relacion.claseOrigenId === asociativa.id
      const multiplicidadAsociativa = asociativaEsOrigen ? relacion.multiplicidadOrigen : relacion.multiplicidadDestino
      const multiplicidadPrincipal = asociativaEsOrigen ? relacion.multiplicidadDestino : relacion.multiplicidadOrigen
      if (relacion.tipo !== "asociacion" || multiplicidadAsociativa !== "0..*" || multiplicidadPrincipal !== "1") {
        motivos.push(`La relación ${describirRelacion(relacion, clasesPorId)} debe ubicar a ${asociativa.nombre} en el extremo 0..* y a su clase principal en el extremo 1.`)
      }
      const principalId = asociativaEsOrigen ? relacion.claseDestinoId : relacion.claseOrigenId
      return clasesPorId.get(principalId)
    }).filter((clase) => clase !== undefined)
    if (principales.length === 2 && principales[0].id === principales[1].id) {
      motivos.push(`La clase asociativa ${asociativa.nombre} debe referenciar dos clases principales distintas.`)
    }
    if (principales.some((clase) => clase.tipoClase === "asociativa")) {
      motivos.push(`Las clases principales de ${asociativa.nombre} deben ser clases normales.`)
    }
    if (asociativa.atributos.some((atributo) => atributo.nombre === "id")) {
      motivos.push(`La clase asociativa ${asociativa.nombre} no debe declarar un id simple; su identidad se deriva de sus dos relaciones.`)
    }
  }
  const camposPorClase = new Map(
    modelo.clases.map((clase) => [
      clase.id,
      new Set(["id", ...clase.atributos.map((atributo) => atributo.nombre.toLowerCase())]),
    ])
  )
  for (const relacion of modelo.relaciones) {
    const descripcion = describirRelacion(relacion, clasesPorId)
    if (relacion.tipo !== "asociacion") {
      motivos.push(`La relación ${descripcion} usa el tipo ${relacion.tipo}, que todavía no pertenece al perfil de generación Spring.`)
      continue
    }
    if (relacion.claseOrigenId === relacion.claseDestinoId) {
      motivos.push(`La relación ${descripcion} es autorreferente y todavía no pertenece al perfil de generación Spring.`)
      continue
    }
    const origen = clasesPorId.get(relacion.claseOrigenId)
    const destino = clasesPorId.get(relacion.claseDestinoId)
    if (!origen || !destino) continue

    const origenEsUno = relacion.multiplicidadOrigen === "1" && (relacion.multiplicidadDestino === "0..*" || relacion.multiplicidadDestino === "1..*")
    const destinoEsUno = (relacion.multiplicidadOrigen === "0..*" || relacion.multiplicidadOrigen === "1..*") && relacion.multiplicidadDestino === "1"
    if (!origenEsUno && !destinoEsUno) {
      if (relacion.multiplicidadOrigen === "0..*" && relacion.multiplicidadDestino === "0..*") {
        motivos.push(`La relación ${descripcion} representa un N:M directo. El generador Spring de NexoCASE requiere convertirla explícitamente en una clase asociativa antes de generar.`)
      } else {
        motivos.push(`La relación ${descripcion} es UML válida, pero todavía no pertenece al perfil de generación Spring. Actualmente se soportan 1 ↔ 0..* y 1 ↔ 1..*.`)
      }
      continue
    }

    const multiplicidadMuchos = origenEsUno ? relacion.multiplicidadDestino : relacion.multiplicidadOrigen
    if (multiplicidadMuchos === "1..*") {
      advertencias.push({ codigo: "CARDINALIDAD_MINIMA_COLECCION", relacion: descripcion })
    }

    const claseUno = origenEsUno ? origen : destino
    const claseMuchos = origenEsUno ? destino : origen
    const rolUno = origenEsUno ? relacion.rolOrigen : relacion.rolDestino
    const rolMuchos = origenEsUno ? relacion.rolDestino : relacion.rolOrigen
    const campoMuchosAUno = rolUno === undefined ? convertirAVariable(claseUno.nombre) : rolUno.trim()
    const campoUnoAMuchos = rolMuchos === undefined ? `${convertirAVariable(claseMuchos.nombre)}s` : rolMuchos.trim()
    const campos = [
      { nombre: campoMuchosAUno, clase: claseMuchos },
      { nombre: campoUnoAMuchos, clase: claseUno },
    ]
    let camposValidos = true
    for (const campo of campos) {
      if (!identificadorCampo.test(campo.nombre) || palabrasReservadasJava.has(campo.nombre) || campo.nombre === "id") {
        motivos.push(`El campo de relación "${campo.nombre}" no es un identificador Java soportado.`)
        camposValidos = false
      } else if (camposPorClase.get(campo.clase.id)!.has(campo.nombre.toLowerCase())) {
        motivos.push(`El campo de relación ${campo.nombre} colisiona en ${campo.clase.nombre}.`)
        camposValidos = false
      }
    }
    if (claseMuchos.tipoClase === "asociativa") {
      const campoClave = `${campoMuchosAUno}Id`
      if (camposPorClase.get(claseMuchos.id)!.has(campoClave.toLowerCase())) {
        motivos.push(`El campo de clave derivado ${campoClave} colisiona en ${claseMuchos.nombre}.`)
        camposValidos = false
      }
    }
    if (camposValidos) {
      camposPorClase.get(claseMuchos.id)!.add(campoMuchosAUno.toLowerCase())
      camposPorClase.get(claseUno.id)!.add(campoUnoAMuchos.toLowerCase())
    }
  }

  if (!validacion.valido) motivos.push("El modelo contiene errores de validación UML.")
  return { apto: motivos.length === 0, motivos, advertencias }
}
