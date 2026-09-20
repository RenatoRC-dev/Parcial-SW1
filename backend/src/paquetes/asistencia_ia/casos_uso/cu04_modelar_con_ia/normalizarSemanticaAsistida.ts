import {
  TIPOS_UML_SOPORTADOS_IA,
  type ComandoModeloUML,
  type ModeloUMLCanonicoIA,
} from "../../compartido/contrato/ComandoModeloUML.js"
import { ErrorPlanCambiosUML } from "./EjecutorComandosUML.js"

const tiposPreferidos = new Map<string, string>([
  ...TIPOS_UML_SOPORTADOS_IA.map((tipo) => [tipo.toLowerCase(), tipo] as const),
  ["string", "String"], ["integer", "Integer"], ["long", "Long"],
  ["double", "Double"], ["float", "Float"], ["boolean", "Boolean"],
  ["bigdecimal", "BigDecimal"], ["localdate", "LocalDate"],
  ["datetime", "DateTime"], ["localdatetime", "LocalDateTime"], ["uuid", "UUID"],
])

function capitalizar(palabra: string): string {
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
}

export function normalizarNombreClaseAsistido(valor: string): string {
  const limpio = valor.trim()
  if (limpio === "") return ""
  const separadas = limpio.split(/[\s_-]+/).filter(Boolean)
  if (separadas.length > 1) return separadas.map(capitalizar).join("")

  const segmentosCamel = limpio.match(/[A-Z]+(?=[A-Z][a-z0-9]|$)|[A-Z]?[a-z0-9]+/g) ?? []
  const camelConvencional = segmentosCamel.join("") === limpio && segmentosCamel.every((segmento) => segmento.length >= 2)
  return camelConvencional ? segmentosCamel.map(capitalizar).join("") : capitalizar(limpio)
}

export function normalizarTipoAsistido(valor: string): string {
  const limpio = valor.trim()
  if (limpio.toLowerCase() === "void") return "void"
  return tiposPreferidos.get(limpio.toLowerCase()) ?? limpio
}

function resolverClase(modelo: ModeloUMLCanonicoIA, referencia: string): string {
  if (referencia.startsWith("tmp_") || modelo.clases.some((clase) => clase.id === referencia)) return referencia
  const nombre = normalizarNombreClaseAsistido(referencia)
  const coincidencias = modelo.clases.filter((clase) => normalizarNombreClaseAsistido(clase.nombre) === nombre)
  if (coincidencias.length > 1) throw new ErrorPlanCambiosUML(`La referencia de clase ${referencia} es ambigua.`)
  return coincidencias[0]?.id ?? referencia
}

export function normalizarComandosAsistidos(
  modelo: ModeloUMLCanonicoIA,
  comandos: ComandoModeloUML[],
): ComandoModeloUML[] {
  return comandos.map((comando): ComandoModeloUML => {
    switch (comando.tipo) {
      case "crear_clase":
        return { ...comando, nombre: normalizarNombreClaseAsistido(comando.nombre) }
      case "crear_clase_asociativa":
        return {
          ...comando,
          nombre: normalizarNombreClaseAsistido(comando.nombre),
          claseARef: resolverClase(modelo, comando.claseARef),
          claseBRef: resolverClase(modelo, comando.claseBRef),
        }
      case "convertir_relacion_en_clase_asociativa":
        return { ...comando, nombre: normalizarNombreClaseAsistido(comando.nombre) }
      case "renombrar_clase":
        return { ...comando, claseId: resolverClase(modelo, comando.claseId), nuevoNombre: normalizarNombreClaseAsistido(comando.nuevoNombre) }
      case "eliminar_clase":
        return { ...comando, claseId: resolverClase(modelo, comando.claseId) }
      case "agregar_atributo":
        return { ...comando, claseRef: resolverClase(modelo, comando.claseRef), tipoDato: normalizarTipoAsistido(comando.tipoDato), visibilidad: comando.visibilidad ?? "privada" }
      case "modificar_atributo":
        return { ...comando, nuevoTipo: comando.nuevoTipo === null ? null : normalizarTipoAsistido(comando.nuevoTipo) }
      case "crear_metodo":
        return {
          ...comando,
          claseRef: resolverClase(modelo, comando.claseRef),
          tipoRetorno: normalizarTipoAsistido(comando.tipoRetorno),
          parametros: comando.parametros.map((parametro) => ({ ...parametro, tipo: normalizarTipoAsistido(parametro.tipo) })),
        }
      case "modificar_metodo":
        return { ...comando, nuevoTipoRetorno: comando.nuevoTipoRetorno === null ? null : normalizarTipoAsistido(comando.nuevoTipoRetorno) }
      case "agregar_parametro":
        return { ...comando, tipoDato: normalizarTipoAsistido(comando.tipoDato) }
      case "modificar_parametro":
        return { ...comando, nuevoTipo: comando.nuevoTipo === null ? null : normalizarTipoAsistido(comando.nuevoTipo) }
      case "crear_relacion":
        if ("claseOrigenRef" in comando) {
          return { ...comando, claseOrigenRef: resolverClase(modelo, comando.claseOrigenRef), claseDestinoRef: resolverClase(modelo, comando.claseDestinoRef) }
        }
        if ("parteRef" in comando) {
          return { ...comando, parteRef: resolverClase(modelo, comando.parteRef), todoRef: resolverClase(modelo, comando.todoRef) }
        }
        return { ...comando, subclaseRef: resolverClase(modelo, comando.subclaseRef), superclaseRef: resolverClase(modelo, comando.superclaseRef) }
      default:
        return comando
    }
  })
}
