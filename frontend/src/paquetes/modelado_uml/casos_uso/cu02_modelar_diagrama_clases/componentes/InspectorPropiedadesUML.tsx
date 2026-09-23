import { useEffect, useState, type KeyboardEvent } from "react"
import type { ApollonEditor } from "@tumaet/apollon"
import {
  MULTIPLICIDADES_UML,
  TIPOS_RELACION_UML,
  VISIBILIDADES_UML,
  VISIBILIDADES_METODO_UML,
  type AtributoUML,
  type ClaseUML,
  type MetodoUML,
  type ModeloUMLCanonico,
  type Multiplicidad,
  type ParametroUML,
  type RelacionUML,
  type TipoRelacionUML,
  type TipoClaseUML,
  type VisibilidadUML,
  type VisibilidadMetodoUML,
} from "../../../../../nucleo/modelo_uml/ModeloUMLCanonico"
import { TIPOS_GENERACION_SOPORTADOS, TIPOS_RETORNO_METODO, validarModelo } from "../../../../validacion/casos_uso/cu08_validar_modelo_uml/ValidadorModeloUML"
import { usarPreferenciasUI } from "../../../../../configuracion/PreferenciasUI"
import { crearEstructuraClaseAsociativa } from "../../../compartido/clases_asociativas/crearEstructuraClaseAsociativa"

interface Props {
  editor: ApollonEditor | null
  modelo: ModeloUMLCanonico
  alAplicar: (modelo: ModeloUMLCanonico) => void
  alCambiarSeleccion?: (ids: string[]) => void
}

const CODIGOS_NOMBRE_ATRIBUTO = new Set([
  "ATRIBUTO_NOMBRE_REQUERIDO",
  "ATRIBUTO_IDENTIFICADOR_INVALIDO",
  "ATRIBUTO_ID_TIPO_INVALIDO",
  "ATRIBUTO_NOMBRE_DUPLICADO",
])

function idNuevo(prefijo: string): string {
  return `${prefijo}-${crypto.randomUUID()}`
}

function confirmarConEnter(evento: KeyboardEvent<HTMLInputElement>) {
  if (evento.key !== "Enter") return
  evento.preventDefault()
  evento.currentTarget.blur()
}

export function InspectorPropiedadesUML({ editor, modelo, alAplicar, alCambiarSeleccion }: Props) {
  const { t } = usarPreferenciasUI()
  const [seleccion, establecerSeleccion] = useState<string[]>([])
  const [nombreNuevaClase, establecerNombreNuevaClase] = useState("")
  const [tipoNuevaClase, establecerTipoNuevaClase] = useState<TipoClaseUML>("normal")
  const [nombreClase, establecerNombreClase] = useState("")
  const [creandoAtributo, establecerCreandoAtributo] = useState(false)
  const [nombreAtributo, establecerNombreAtributo] = useState("")
  const [tipoAtributo, establecerTipoAtributo] = useState<string>(TIPOS_GENERACION_SOPORTADOS[0])
  const [visibilidad, establecerVisibilidad] = useState<VisibilidadUML>("privada")
  const [error, establecerError] = useState<string | null>(null)
  const clase = modelo.clases.find((item) => seleccion.includes(item.id))

  useEffect(() => {
    if (!editor) {
      establecerSeleccion([])
      alCambiarSeleccion?.([])
      return
    }
    const recibirSeleccion = (ids: string[]) => {
      establecerSeleccion(ids)
      alCambiarSeleccion?.(ids)
    }
    const suscripcion = editor.subscribeToSelectionChange(recibirSeleccion)
    return () => editor.unsubscribe(suscripcion)
  }, [editor, alCambiarSeleccion])

  useEffect(() => {
    establecerNombreClase(clase?.nombre ?? "")
    establecerCreandoAtributo(false)
  }, [clase?.id, clase?.nombre])

  const aplicar = (
    siguiente: ModeloUMLCanonico,
    elementoId?: string,
    aceptarDiagnostico: (codigo: string) => boolean = () => true
  ): boolean => {
    const diagnostico = elementoId
      ? validarModelo(siguiente).diagnosticos.find(
          (item) => item.elementoId === elementoId && item.severidad === "error" && aceptarDiagnostico(item.codigo)
        )
      : undefined
    if (diagnostico) {
      establecerError(diagnostico.mensaje)
      return false
    }
    establecerError(null)
    alAplicar(siguiente)
    return true
  }

  const reemplazarAtributo = (actualizado: AtributoUML): ModeloUMLCanonico => ({
    ...modelo,
    clases: modelo.clases.map((item) => item.id === clase?.id
      ? { ...item, atributos: item.atributos.map((atributo) => atributo.id === actualizado.id ? actualizado : atributo) }
      : item),
  })

  const renombrarClase = () => {
    if (!clase) return
    const nombre = nombreClase.trim()
    if (nombre === clase.nombre) return
    const siguiente = { ...modelo, clases: modelo.clases.map((item) => item.id === clase.id ? { ...item, nombre } : item) }
    if (!aplicar(siguiente, clase.id)) establecerNombreClase(clase.nombre)
  }

  const crearClase = () => {
    const nuevaClase = {
      id: idNuevo("clase"),
      nombre: nombreNuevaClase.trim(),
      atributos: [],
      metodos: [],
      posicion: { x: 80 + modelo.clases.length * 40, y: 80 + modelo.clases.length * 40 },
      abstracta: false,
      tipoClase: tipoNuevaClase,
    }
    if (aplicar({ ...modelo, clases: [...modelo.clases, nuevaClase] }, nuevaClase.id)) {
      establecerNombreNuevaClase("")
      establecerTipoNuevaClase("normal")
    }
  }

  const confirmarAtributo = () => {
    if (!clase) return
    const atributo: AtributoUML = {
      id: idNuevo("atributo"),
      nombre: nombreAtributo.trim(),
      tipo: tipoAtributo,
      visibilidad,
    }
    const siguiente = {
      ...modelo,
      clases: modelo.clases.map((item) => item.id === clase.id
        ? { ...item, atributos: [...item.atributos, atributo] }
        : item),
    }
    if (aplicar(siguiente, atributo.id)) {
      establecerNombreAtributo("")
      establecerTipoAtributo(TIPOS_GENERACION_SOPORTADOS[0])
      establecerVisibilidad("privada")
      establecerCreandoAtributo(false)
    }
  }

  const cancelarAtributo = () => {
    establecerNombreAtributo("")
    establecerTipoAtributo(TIPOS_GENERACION_SOPORTADOS[0])
    establecerVisibilidad("privada")
    establecerCreandoAtributo(false)
    establecerError(null)
  }

  return (
    <section className="property-inspector" data-testid="inspector-propiedades">
      <h2>{t("propiedades.titulo")}</h2>
      {error ? <p className="property-error" role="alert">{error}</p> : null}

      <fieldset className="compact-create-class">
        <legend>{t("propiedades.nuevaClase")}</legend>
        <label>{t("propiedades.nombreClase")}<input value={nombreNuevaClase} onChange={(evento) => establecerNombreNuevaClase(evento.target.value)} /></label>
        <label>{t("propiedades.tipoClase")}<select value={tipoNuevaClase} onChange={(evento) => establecerTipoNuevaClase(evento.target.value as TipoClaseUML)}><option value="normal">{t("propiedades.normal")}</option><option value="asociativa">{t("propiedades.asociativa")}</option></select></label>
        <button type="button" onClick={crearClase}>{t("propiedades.crearClase")}</button>
      </fieldset>

      {clase ? <>
        <section className="compact-class-editor" aria-label={t("propiedades.clase")}>
          <h3>{t("propiedades.clase")}</h3>
          <label>{t("propiedades.nombreClaseActual")}<input value={nombreClase} onChange={(evento) => establecerNombreClase(evento.target.value)} onBlur={renombrarClase} onKeyDown={confirmarConEnter} /></label>
          <label>{t("propiedades.tipoClase")}<select value={clase.tipoClase === "asociativa" ? "asociativa" : "normal"} onChange={(evento) => aplicar({ ...modelo, clases: modelo.clases.map((item) => item.id === clase.id ? { ...item, tipoClase: evento.target.value as TipoClaseUML } : item) })}><option value="normal">{t("propiedades.normal")}</option><option value="asociativa">{t("propiedades.asociativa")}</option></select></label>
        </section>

        <section className="compact-attributes">
          <h3>{t("propiedades.atributos")}</h3>
          {clase.atributos.length > 0 ? <div className="compact-row-head" aria-hidden="true"><span>{t("propiedades.nombre")}</span><span>{t("propiedades.tipo")}</span><span>{t("propiedades.visibilidad")}</span><span /></div> : null}
          {clase.atributos.map((atributo) => (
            <EditorAtributo
              key={atributo.id}
              atributo={atributo}
              alRenombrar={(actualizado) => aplicar(reemplazarAtributo(actualizado), actualizado.id, (codigo) => CODIGOS_NOMBRE_ATRIBUTO.has(codigo))}
              alActualizar={(actualizado) => aplicar(reemplazarAtributo(actualizado))}
              alEliminar={() => aplicar({ ...modelo, clases: modelo.clases.map((item) => item.id === clase.id ? { ...item, atributos: item.atributos.filter((itemAtributo) => itemAtributo.id !== atributo.id) } : item) })}
            />
          ))}

          {creandoAtributo ? (
            <div className="compact-attribute-row compact-new-row" role="group" aria-label={t("propiedades.nuevoAtributo")}>
              <input aria-label={t("propiedades.nombre")} value={nombreAtributo} autoFocus onChange={(evento) => establecerNombreAtributo(evento.target.value)} />
              <select aria-label={t("propiedades.tipo")} value={tipoAtributo} onChange={(evento) => establecerTipoAtributo(evento.target.value)}>{TIPOS_GENERACION_SOPORTADOS.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
              <select aria-label={t("propiedades.visibilidad")} value={visibilidad} onChange={(evento) => establecerVisibilidad(evento.target.value as VisibilidadUML)}>{VISIBILIDADES_UML.map((valor) => <option key={valor} value={valor}>{t(`propiedades.${valor}`)}</option>)}</select>
              <div className="compact-row-actions">
                <button type="button" className="compact-icon-button" aria-label={t("propiedades.confirmarAtributo")} title={t("propiedades.confirmarAtributo")} onClick={confirmarAtributo}>✓</button>
                <button type="button" className="compact-icon-button secondary" aria-label={t("propiedades.cancelar")} title={t("propiedades.cancelar")} onClick={cancelarAtributo}>×</button>
              </div>
            </div>
          ) : <button type="button" className="compact-add-button" onClick={() => establecerCreandoAtributo(true)}>{t("propiedades.mostrarNuevoAtributo")}</button>}
        </section>

        <EditorMetodos
          clase={clase}
          modelo={modelo}
          alAplicar={(siguiente, elementoId) => aplicar(siguiente, elementoId)}
        />
      </> : <p className="property-empty-state">{t("propiedades.seleccioneElemento")}</p>}

      <EditorRelaciones modelo={modelo} seleccion={seleccion} alAplicar={(siguiente) => aplicar(siguiente)} />
    </section>
  )
}

function EditorAtributo({ atributo, alRenombrar, alActualizar, alEliminar }: {
  atributo: AtributoUML
  alRenombrar: (atributo: AtributoUML) => boolean
  alActualizar: (atributo: AtributoUML) => boolean
  alEliminar: () => void
}) {
  const { t } = usarPreferenciasUI()
  const [nombre, establecerNombre] = useState(atributo.nombre)
  const [tipo, establecerTipo] = useState(atributo.tipo ?? "")
  const [visibilidad, establecerVisibilidad] = useState(atributo.visibilidad ?? "")
  const soportado = atributo.tipo === null || TIPOS_GENERACION_SOPORTADOS.includes(atributo.tipo as (typeof TIPOS_GENERACION_SOPORTADOS)[number])

  useEffect(() => establecerNombre(atributo.nombre), [atributo.nombre])
  useEffect(() => establecerTipo(atributo.tipo ?? ""), [atributo.tipo])
  useEffect(() => establecerVisibilidad(atributo.visibilidad ?? ""), [atributo.visibilidad])

  const confirmarNombre = () => {
    const normalizado = nombre.trim()
    if (normalizado === atributo.nombre) return
    if (!alRenombrar({ ...atributo, nombre: normalizado })) establecerNombre(atributo.nombre)
  }

  const cambiarTipo = (nuevoTipo: string) => {
    const actualizado = { ...atributo, tipo: nuevoTipo || null }
    if (alActualizar(actualizado)) establecerTipo(nuevoTipo)
  }

  const cambiarVisibilidad = (nuevaVisibilidad: string) => {
    const actualizado = nuevaVisibilidad
      ? { ...atributo, visibilidad: nuevaVisibilidad as VisibilidadUML }
      : { ...atributo, visibilidad: undefined }
    if (alActualizar(actualizado)) establecerVisibilidad(nuevaVisibilidad)
  }

  return (
    <div className="compact-attribute-row" role="group" aria-label={`${t("propiedades.atributo")} ${atributo.nombre}`}>
      <input aria-label={`${t("propiedades.nombre")} ${atributo.nombre}`} value={nombre} onChange={(evento) => establecerNombre(evento.target.value)} onBlur={confirmarNombre} onKeyDown={confirmarConEnter} />
      <select aria-label={`${t("propiedades.tipo")} ${atributo.nombre}`} value={tipo} onChange={(evento) => cambiarTipo(evento.target.value)}>
        {atributo.tipo === null ? <option value="">—</option> : null}
        {!soportado && atributo.tipo ? <option value={atributo.tipo}>{atributo.tipo} — {t("propiedades.noSoportado")}</option> : null}
        {TIPOS_GENERACION_SOPORTADOS.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select aria-label={`${t("propiedades.visibilidad")} ${atributo.nombre}`} value={visibilidad} onChange={(evento) => cambiarVisibilidad(evento.target.value)}>
        <option value="">{t("propiedades.sinVisibilidad")}</option>
        {VISIBILIDADES_UML.map((valor) => <option key={valor} value={valor}>{t(`propiedades.${valor}`)}</option>)}
      </select>
      <button type="button" className="compact-icon-button danger" aria-label={`${t("propiedades.eliminarAtributo")} ${atributo.nombre}`} title={t("propiedades.eliminarAtributo")} onClick={alEliminar}>×</button>
    </div>
  )
}

function EditorMetodos({ clase, modelo, alAplicar }: {
  clase: ClaseUML
  modelo: ModeloUMLCanonico
  alAplicar: (modelo: ModeloUMLCanonico, elementoId?: string) => boolean
}) {
  const { t } = usarPreferenciasUI()
  const [creando, establecerCreando] = useState(false)
  const [nombre, establecerNombre] = useState("")
  const [tipoRetorno, establecerTipoRetorno] = useState<string>("void")
  const [visibilidad, establecerVisibilidad] = useState<VisibilidadMetodoUML>("publica")
  const metodos = clase.metodos ?? []

  const reemplazar = (metodo: MetodoUML, elementoId = metodo.id) => alAplicar({
    ...modelo,
    clases: modelo.clases.map((item) => item.id === clase.id
      ? { ...item, metodos: metodos.map((actual) => actual.id === metodo.id ? metodo : actual) }
      : item),
  }, elementoId)

  const cancelar = () => {
    establecerCreando(false)
    establecerNombre("")
    establecerTipoRetorno("void")
    establecerVisibilidad("publica")
  }

  const confirmar = () => {
    const metodo: MetodoUML = {
      id: idNuevo("metodo"),
      nombre: nombre.trim(),
      tipoRetorno,
      visibilidad,
      parametros: [],
    }
    if (alAplicar({
      ...modelo,
      clases: modelo.clases.map((item) => item.id === clase.id
        ? { ...item, metodos: [...metodos, metodo] }
        : item),
    }, metodo.id)) cancelar()
  }

  return <section className="compact-methods">
    <h3>{t("metodos.titulo")}</h3>
    {metodos.map((metodo) => <EditorMetodo
      key={metodo.id}
      metodo={metodo}
      alActualizar={reemplazar}
      alEliminar={() => alAplicar({
        ...modelo,
        clases: modelo.clases.map((item) => item.id === clase.id
          ? { ...item, metodos: metodos.filter((actual) => actual.id !== metodo.id) }
          : item),
      })}
    />)}
    {creando ? <div className="compact-method-row compact-new-row" role="group" aria-label={t("metodos.nuevo")}>
      <input aria-label={t("propiedades.nombre")} value={nombre} autoFocus onChange={(evento) => establecerNombre(evento.target.value)} />
      <select aria-label={t("metodos.retorno")} value={tipoRetorno} onChange={(evento) => establecerTipoRetorno(evento.target.value)}>{TIPOS_RETORNO_METODO.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
      <select aria-label={t("propiedades.visibilidad")} value={visibilidad} onChange={(evento) => establecerVisibilidad(evento.target.value as VisibilidadMetodoUML)}>{VISIBILIDADES_METODO_UML.map((valor) => <option key={valor} value={valor}>{t(`propiedades.${valor}`)}</option>)}</select>
      <div className="compact-row-actions"><button type="button" className="compact-icon-button" aria-label={t("metodos.confirmar")} onClick={confirmar}>✓</button><button type="button" className="compact-icon-button secondary" aria-label={t("propiedades.cancelar")} onClick={cancelar}>×</button></div>
    </div> : <button type="button" className="compact-add-button" onClick={() => establecerCreando(true)}>{t("metodos.agregar")}</button>}
  </section>
}

function EditorMetodo({ metodo, alActualizar, alEliminar }: {
  metodo: MetodoUML
  alActualizar: (metodo: MetodoUML, elementoId?: string) => boolean
  alEliminar: () => void
}) {
  const { t } = usarPreferenciasUI()
  const [nombre, establecerNombre] = useState(metodo.nombre)
  const [parametrosAbiertos, establecerParametrosAbiertos] = useState(false)
  const [creandoParametro, establecerCreandoParametro] = useState(false)
  const [nombreParametro, establecerNombreParametro] = useState("")
  const [tipoParametro, establecerTipoParametro] = useState<string>(TIPOS_GENERACION_SOPORTADOS[0])

  useEffect(() => establecerNombre(metodo.nombre), [metodo.nombre])
  const confirmarNombre = () => {
    const actualizado = { ...metodo, nombre: nombre.trim() }
    if (!alActualizar(actualizado)) establecerNombre(metodo.nombre)
  }
  const agregarParametro = () => {
    const parametro = { id: idNuevo("parametro"), nombre: nombreParametro.trim(), tipo: tipoParametro }
    if (alActualizar({ ...metodo, parametros: [...metodo.parametros, parametro] }, parametro.id)) {
      establecerNombreParametro("")
      establecerTipoParametro(TIPOS_GENERACION_SOPORTADOS[0])
      establecerCreandoParametro(false)
    }
  }

  return <div className="compact-method-block" role="group" aria-label={`${t("metodos.metodo")} ${metodo.nombre}`}>
    <div className="compact-method-row compact-existing-method-row">
      <input className="compact-method-name" aria-label={`${t("propiedades.nombre")} ${metodo.nombre}`} value={nombre} onChange={(evento) => establecerNombre(evento.target.value)} onBlur={confirmarNombre} onKeyDown={confirmarConEnter} />
      <select className="compact-method-return" aria-label={`${t("metodos.retorno")} ${metodo.nombre}`} value={metodo.tipoRetorno} onChange={(evento) => alActualizar({ ...metodo, tipoRetorno: evento.target.value })}>{TIPOS_RETORNO_METODO.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
      <select className="compact-method-visibility" aria-label={`${t("propiedades.visibilidad")} ${metodo.nombre}`} value={metodo.visibilidad} onChange={(evento) => alActualizar({ ...metodo, visibilidad: evento.target.value as VisibilidadMetodoUML })}>{VISIBILIDADES_METODO_UML.map((valor) => <option key={valor} value={valor}>{t(`propiedades.${valor}`)}</option>)}</select>
      <button type="button" className="compact-parameters-button" onClick={() => establecerParametrosAbiertos(!parametrosAbiertos)}>{t("metodos.parametros")}</button>
      <button type="button" className="compact-icon-button compact-method-delete danger" aria-label={`${t("metodos.eliminar")} ${metodo.nombre}`} title={t("metodos.eliminar")} onClick={alEliminar}>×</button>
    </div>
    {parametrosAbiertos ? <div className="compact-parameters">
      {metodo.parametros.map((parametro) => <EditorParametro
        key={parametro.id}
        parametro={parametro}
        alActualizar={(actualizado) => alActualizar({
          ...metodo,
          parametros: metodo.parametros.map((actual) => actual.id === actualizado.id ? actualizado : actual),
        }, parametro.id)}
        alEliminar={() => alActualizar({ ...metodo, parametros: metodo.parametros.filter((actual) => actual.id !== parametro.id) })}
      />)}
      {creandoParametro ? <div className="compact-parameter-row compact-new-row" role="group" aria-label={t("metodos.nuevoParametro")}>
        <input aria-label={t("propiedades.nombre")} value={nombreParametro} onChange={(evento) => establecerNombreParametro(evento.target.value)} />
        <select aria-label={t("propiedades.tipo")} value={tipoParametro} onChange={(evento) => establecerTipoParametro(evento.target.value)}>{TIPOS_GENERACION_SOPORTADOS.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
        <div className="compact-row-actions"><button type="button" className="compact-icon-button" aria-label={t("metodos.confirmarParametro")} onClick={agregarParametro}>✓</button><button type="button" className="compact-icon-button secondary" aria-label={t("propiedades.cancelar")} onClick={() => establecerCreandoParametro(false)}>×</button></div>
      </div> : <button type="button" className="compact-add-button" onClick={() => establecerCreandoParametro(true)}>{t("metodos.agregarParametro")}</button>}
    </div> : null}
  </div>
}

function EditorParametro({ parametro, alActualizar, alEliminar }: {
  parametro: ParametroUML
  alActualizar: (parametro: ParametroUML) => boolean
  alEliminar: () => void
}) {
  const { t } = usarPreferenciasUI()
  const [nombre, establecerNombre] = useState(parametro.nombre)

  useEffect(() => establecerNombre(parametro.nombre), [parametro.nombre])

  const confirmarNombre = () => {
    const normalizado = nombre.trim()
    if (normalizado === parametro.nombre) return
    if (!alActualizar({ ...parametro, nombre: normalizado })) establecerNombre(parametro.nombre)
  }

  return <div className="compact-parameter-row" role="group" aria-label={`${t("metodos.parametro")} ${parametro.nombre}`}>
    <input
      aria-label={`${t("propiedades.nombre")} ${parametro.nombre}`}
      value={nombre}
      onChange={(evento) => establecerNombre(evento.target.value)}
      onBlur={confirmarNombre}
      onKeyDown={confirmarConEnter}
    />
    <select aria-label={`${t("propiedades.tipo")} ${parametro.nombre}`} value={parametro.tipo} onChange={(evento) => alActualizar({ ...parametro, tipo: evento.target.value })}>{TIPOS_GENERACION_SOPORTADOS.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
    <button type="button" className="compact-icon-button danger" aria-label={`${t("metodos.eliminarParametro")} ${parametro.nombre}`} onClick={alEliminar}>×</button>
  </div>
}

function EditorRelaciones({ modelo, seleccion, alAplicar }: { modelo: ModeloUMLCanonico; seleccion: string[]; alAplicar: (modelo: ModeloUMLCanonico) => void }) {
  const { t } = usarPreferenciasUI()
  const [creando, establecerCreando] = useState(false)
  const [tipo, establecerTipo] = useState<TipoRelacionUML>("asociacion")
  const [origen, establecerOrigen] = useState("")
  const [destino, establecerDestino] = useState("")
  const [cantidadDestinoPorOrigen, establecerCantidadDestinoPorOrigen] = useState("")
  const [cantidadOrigenPorDestino, establecerCantidadOrigenPorDestino] = useState("")
  const [rolOrigen, establecerRolOrigen] = useState("")
  const [rolDestino, establecerRolDestino] = useState("")
  const [nombreRelacion, establecerNombreRelacion] = useState("")
  const [relacionEditadaId, establecerRelacionEditadaId] = useState<string | null>(null)
  const [nombreClaseAsociativa, establecerNombreClaseAsociativa] = useState("")
  const [errorClaseAsociativa, establecerErrorClaseAsociativa] = useState<string | null>(null)
  const relacionSeleccionada = modelo.relaciones.find((relacion) => seleccion.includes(relacion.id))
  const relacionEditada = modelo.relaciones.find((relacion) => relacion.id === relacionEditadaId) ?? relacionSeleccionada
  const relacionMuchosAMuchos = relacionEditada?.tipo === "asociacion"
    && relacionEditada.multiplicidadOrigen === "0..*"
    && relacionEditada.multiplicidadDestino === "0..*"
  const esGeneralizacion = tipo === "generalizacion"
  const esTodoParte = tipo === "agregacion" || tipo === "composicion"

  useEffect(() => {
    if (relacionSeleccionada) establecerRelacionEditadaId(relacionSeleccionada.id)
  }, [relacionSeleccionada])

  useEffect(() => {
    if (relacionEditadaId && !modelo.relaciones.some((relacion) => relacion.id === relacionEditadaId)) {
      establecerRelacionEditadaId(null)
    }
  }, [modelo.relaciones, relacionEditadaId])

  const cancelar = () => {
    establecerCreando(false)
    establecerTipo("asociacion")
    establecerOrigen("")
    establecerDestino("")
    establecerCantidadDestinoPorOrigen("")
    establecerCantidadOrigenPorDestino("")
    establecerRolOrigen("")
    establecerRolDestino("")
    establecerNombreRelacion("")
  }

  const agregar = () => {
    if (!origen || !destino || origen === destino || (!esGeneralizacion && (!cantidadDestinoPorOrigen || !cantidadOrigenPorDestino))) return
    const relacion: RelacionUML = {
      id: idNuevo("relacion"),
      tipo,
      claseOrigenId: origen,
      claseDestinoId: destino,
      multiplicidadOrigen: esGeneralizacion ? null : cantidadOrigenPorDestino as Multiplicidad,
      multiplicidadDestino: esGeneralizacion ? null : cantidadDestinoPorOrigen as Multiplicidad,
      ...(nombreRelacion.trim() ? { nombre: nombreRelacion.trim() } : {}),
      ...(!esGeneralizacion && rolOrigen.trim() ? { rolOrigen: rolOrigen.trim() } : {}),
      ...(!esGeneralizacion && rolDestino.trim() ? { rolDestino: rolDestino.trim() } : {}),
    }
    alAplicar({ ...modelo, relaciones: [...modelo.relaciones, relacion] })
    cancelar()
  }

  const convertirEnClaseAsociativa = () => {
    if (!relacionEditada || !relacionMuchosAMuchos) return
    try {
      const siguiente = crearEstructuraClaseAsociativa(modelo, {
        nombre: nombreClaseAsociativa,
        claseAId: relacionEditada.claseOrigenId,
        claseBId: relacionEditada.claseDestinoId,
        relacionReemplazadaId: relacionEditada.id,
        ids: { clase: idNuevo("clase"), relacionA: idNuevo("relacion"), relacionB: idNuevo("relacion") },
      })
      alAplicar(siguiente)
      establecerRelacionEditadaId(null)
      establecerNombreClaseAsociativa("")
      establecerErrorClaseAsociativa(null)
    } catch (error) {
      establecerErrorClaseAsociativa(error instanceof Error ? error.message : "No se pudo convertir la relación.")
    }
  }

  return (
    <section className="relationship-editor">
      <h3>{t("propiedades.relaciones")}</h3>
      {modelo.relaciones.length > 0 ? (
        <div className="compact-relationship-list" aria-label={t("propiedades.listaRelaciones")}>
          <span>{modelo.relaciones.length} {t("propiedades.relacionesRegistradas")}</span>
          {modelo.relaciones.map((relacion) => (
            <button
              type="button"
              className={relacionEditada?.id === relacion.id ? "active" : ""}
              key={relacion.id}
              onClick={() => establecerRelacionEditadaId(relacion.id)}
            >
              {nombreClase(modelo, relacion.claseOrigenId)} → {nombreClase(modelo, relacion.claseDestinoId)}
            </button>
          ))}
        </div>
      ) : null}
      {relacionSeleccionada?.id === relacionEditada?.id ? <p className="property-selection-note">{t("propiedades.relacionSeleccionada")}</p> : null}
      {relacionEditada ? (
        <RelacionExistente
          key={relacionEditada.id}
          relacion={relacionEditada}
          modelo={modelo}
          alActualizar={(actualizada) => alAplicar({ ...modelo, relaciones: modelo.relaciones.map((item) => item.id === actualizada.id ? actualizada : item) })}
          alEliminar={() => {
            alAplicar({ ...modelo, relaciones: modelo.relaciones.filter((item) => item.id !== relacionEditada.id) })
            establecerRelacionEditadaId(null)
          }}
        />
      ) : null}
      {relacionEditada && relacionMuchosAMuchos ? (
        <div className="compact-new-relation" role="group" aria-label={t("propiedades.convertirAsociativa")}>
          <strong>{t("propiedades.convertirAsociativa")}</strong>
          {errorClaseAsociativa ? <p className="property-error" role="alert">{errorClaseAsociativa}</p> : null}
          <label>{t("propiedades.nombreClaseAsociativa")}<input value={nombreClaseAsociativa} onChange={(evento) => establecerNombreClaseAsociativa(evento.target.value)} /></label>
          <button type="button" onClick={convertirEnClaseAsociativa}>{t("propiedades.confirmarConversionAsociativa")}</button>
        </div>
      ) : null}
      {modelo.clases.length >= 2 && !creando ? <button type="button" className="compact-add-button" onClick={() => establecerCreando(true)}>{t("propiedades.mostrarNuevaRelacion")}</button> : null}
      {creando ? (
        <div className="compact-new-relation" role="group" aria-label={t("propiedades.nuevaRelacion")}>
          <label>{t("propiedades.tipoRelacion")}<select value={tipo} onChange={(evento) => establecerTipo(evento.target.value as TipoRelacionUML)}>{TIPOS_RELACION_UML.map((valor) => <option key={valor} value={valor}>{t(`relacion.${valor}`)}</option>)}</select></label>
          <label>{t("propiedades.nombreRelacion")}<input value={nombreRelacion} onChange={(evento) => establecerNombreRelacion(evento.target.value)} /></label>
          {esGeneralizacion ? <>
            <SelectorClaseRelacion titulo={t("propiedades.subclase")} clases={modelo.clases} claseId={origen} setClase={establecerOrigen} />
            <SelectorClaseRelacion titulo={t("propiedades.superclase")} clases={modelo.clases} claseId={destino} setClase={establecerDestino} />
          </> : esTodoParte ? <>
            <ExtremoRelacion titulo={t("propiedades.todo")} clases={modelo.clases} claseId={destino} setClase={establecerDestino} rol={rolDestino} setRol={establecerRolDestino} />
            <ExtremoRelacion titulo={t("propiedades.parte")} clases={modelo.clases} claseId={origen} setClase={establecerOrigen} rol={rolOrigen} setRol={establecerRolOrigen} />
          </> : <>
            <ExtremoRelacion titulo={t("propiedades.claseA")} clases={modelo.clases} claseId={origen} setClase={establecerOrigen} rol={rolOrigen} setRol={establecerRolOrigen} />
            <ExtremoRelacion titulo={t("propiedades.claseB")} clases={modelo.clases} claseId={destino} setClase={establecerDestino} rol={rolDestino} setRol={establecerRolDestino} />
          </>}
          {!esGeneralizacion && origen && destino && origen !== destino ? <div className="relationship-business-cardinalities">
            <SelectorCantidadRelacion pregunta={preguntaCantidad(t("propiedades.cantidadDestinoPorOrigen"), nombreClase(modelo, origen), nombreClase(modelo, destino))} valor={cantidadDestinoPorOrigen} alCambiar={establecerCantidadDestinoPorOrigen} />
            <SelectorCantidadRelacion pregunta={preguntaCantidad(t("propiedades.cantidadOrigenPorDestino"), nombreClase(modelo, origen), nombreClase(modelo, destino))} valor={cantidadOrigenPorDestino} alCambiar={establecerCantidadOrigenPorDestino} />
          </div> : null}
          <div className="compact-form-actions">
            <button type="button" disabled={!origen || !destino || origen === destino || (!esGeneralizacion && (!cantidadDestinoPorOrigen || !cantidadOrigenPorDestino))} onClick={agregar}>{t("propiedades.crearRelacion")}</button>
            <button type="button" className="secondary" onClick={cancelar}>{t("propiedades.cancelar")}</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function nombreClase(modelo: ModeloUMLCanonico, id: string): string {
  return modelo.clases.find((clase) => clase.id === id)?.nombre ?? id
}

function preguntaCantidad(plantilla: string, origen: string, destino: string): string {
  return plantilla.replace("{origen}", origen).replace("{destino}", destino)
}

function SelectorCantidadRelacion({ pregunta, valor, alCambiar }: { pregunta: string; valor: string; alCambiar: (valor: string) => void }) {
  const { t } = usarPreferenciasUI()
  return <label>{pregunta}<select aria-label={pregunta} value={valor} onChange={(evento) => alCambiar(evento.target.value)}><option value="">{t("propiedades.seleccionar")}</option>{MULTIPLICIDADES_UML.map((multiplicidad) => <option key={multiplicidad} value={multiplicidad}>{t(`multiplicidad.${multiplicidad}`)}</option>)}</select></label>
}

function ExtremoRelacion({ titulo, clases, claseId, setClase, rol, setRol }: {
  titulo: string
  clases: ModeloUMLCanonico["clases"]
  claseId: string
  setClase: (valor: string) => void
  rol: string
  setRol: (valor: string) => void
}) {
  const { t } = usarPreferenciasUI()
  return (
    <div className="relationship-end">
      <strong>{titulo}</strong>
      <select aria-label={titulo} value={claseId} onChange={(evento) => setClase(evento.target.value)}><option value="">{t("propiedades.seleccionar")}</option>{clases.map((clase) => <option key={clase.id} value={clase.id}>{clase.nombre}</option>)}</select>
      <label>{t("propiedades.rolOpcional")}<input aria-label={`${t("propiedades.rolOpcional")} ${titulo}`} value={rol} onChange={(evento) => setRol(evento.target.value)} /></label>
    </div>
  )
}

function SelectorClaseRelacion({ titulo, clases, claseId, setClase }: {
  titulo: string
  clases: ModeloUMLCanonico["clases"]
  claseId: string
  setClase: (valor: string) => void
}) {
  const { t } = usarPreferenciasUI()
  return <label>{titulo}<select aria-label={titulo} value={claseId} onChange={(evento) => setClase(evento.target.value)}><option value="">{t("propiedades.seleccionar")}</option>{clases.map((clase) => <option key={clase.id} value={clase.id}>{clase.nombre}</option>)}</select></label>
}

function RelacionExistente({ relacion, modelo, alActualizar, alEliminar }: {
  relacion: RelacionUML
  modelo: ModeloUMLCanonico
  alActualizar: (relacion: RelacionUML) => void
  alEliminar: () => void
}) {
  const { t } = usarPreferenciasUI()
  const [actual, establecerActual] = useState(relacion)
  const [nombreRelacion, establecerNombreRelacion] = useState(relacion.nombre ?? "")
  const [rolOrigen, establecerRolOrigen] = useState(relacion.rolOrigen ?? "")
  const [rolDestino, establecerRolDestino] = useState(relacion.rolDestino ?? "")
  const nombre = (id: string) => nombreClase(modelo, id)

  useEffect(() => {
    establecerActual(relacion)
    establecerNombreRelacion(relacion.nombre ?? "")
    establecerRolOrigen(relacion.rolOrigen ?? "")
    establecerRolDestino(relacion.rolDestino ?? "")
  }, [relacion])

  const actualizar = (cambios: Partial<RelacionUML>) => {
    const siguiente = { ...actual, ...cambios }
    establecerActual(siguiente)
    alActualizar(siguiente)
  }

  const confirmarRol = (lado: "origen" | "destino") => {
    const valor = (lado === "origen" ? rolOrigen : rolDestino).trim()
    actualizar(lado === "origen" ? { rolOrigen: valor || undefined } : { rolDestino: valor || undefined })
  }

  const confirmarNombre = () => {
    const valor = nombreRelacion.trim()
    actualizar({ nombre: valor || undefined })
  }
  const cambiarTipo = (tipo: TipoRelacionUML) => {
    actualizar(tipo === "generalizacion"
      ? { tipo, multiplicidadOrigen: null, multiplicidadDestino: null, rolOrigen: undefined, rolDestino: undefined }
      : { tipo })
  }
  const esGeneralizacion = actual.tipo === "generalizacion"
  const esTodoParte = actual.tipo === "agregacion" || actual.tipo === "composicion"

  return (
    <div className="compact-existing-relation" role="group" aria-label={`${t("propiedades.relacion")} ${nombre(relacion.claseOrigenId)} → ${nombre(relacion.claseDestinoId)}`}>
      <div className="compact-relation-heading"><strong>{nombre(relacion.claseOrigenId)} → {nombre(relacion.claseDestinoId)}</strong><button type="button" className="compact-delete-text" onClick={alEliminar}>{t("propiedades.eliminarRelacion")}</button></div>
      <label>{t("propiedades.tipoRelacion")}<select value={actual.tipo} onChange={(evento) => cambiarTipo(evento.target.value as TipoRelacionUML)}>{TIPOS_RELACION_UML.map((valor) => <option key={valor} value={valor}>{t(`relacion.${valor}`)}</option>)}</select></label>
      <label>{t("propiedades.nombreRelacion")}<input value={nombreRelacion} onChange={(evento) => establecerNombreRelacion(evento.target.value)} onBlur={confirmarNombre} onKeyDown={confirmarConEnter} /></label>
      {esGeneralizacion ? <div className="compact-relation-endpoints">
        <SelectorClaseRelacion titulo={t("propiedades.subclase")} clases={modelo.clases} claseId={actual.claseOrigenId} setClase={(claseOrigenId) => actualizar({ claseOrigenId })} />
        <SelectorClaseRelacion titulo={t("propiedades.superclase")} clases={modelo.clases} claseId={actual.claseDestinoId} setClase={(claseDestinoId) => actualizar({ claseDestinoId })} />
      </div> : <>
      {esTodoParte ? <div className="compact-relation-endpoints">
        <SelectorClaseRelacion titulo={t("propiedades.todo")} clases={modelo.clases} claseId={actual.claseDestinoId} setClase={(claseDestinoId) => actualizar({ claseDestinoId })} />
        <SelectorClaseRelacion titulo={t("propiedades.parte")} clases={modelo.clases} claseId={actual.claseOrigenId} setClase={(claseOrigenId) => actualizar({ claseOrigenId })} />
      </div> : null}
      <div className="compact-relation-endpoints">
        <div><strong>{nombre(actual.claseOrigenId)}</strong><label>{t("propiedades.multiplicidadExtremo")}<select aria-label={`${t("propiedades.multiplicidadExtremo")} ${nombre(actual.claseOrigenId)}`} value={actual.multiplicidadOrigen ?? ""} onChange={(evento) => actualizar({ multiplicidadOrigen: (evento.target.value || null) as Multiplicidad | null })}><option value="">{t("propiedades.seleccionar")}</option>{MULTIPLICIDADES_UML.map((valor) => <option key={valor} value={valor}>{t(`multiplicidad.${valor}`)}</option>)}</select></label><small>{preguntaCantidad(t("propiedades.explicacionExtremoOrigen"), nombre(actual.claseOrigenId), nombre(actual.claseDestinoId))}</small><input aria-label={`${t("propiedades.rolOpcional")} ${nombre(actual.claseOrigenId)}`} value={rolOrigen} onChange={(evento) => establecerRolOrigen(evento.target.value)} onBlur={() => confirmarRol("origen")} onKeyDown={confirmarConEnter} /></div>
        <div><strong>{nombre(actual.claseDestinoId)}</strong><label>{t("propiedades.multiplicidadExtremo")}<select aria-label={`${t("propiedades.multiplicidadExtremo")} ${nombre(actual.claseDestinoId)}`} value={actual.multiplicidadDestino ?? ""} onChange={(evento) => actualizar({ multiplicidadDestino: (evento.target.value || null) as Multiplicidad | null })}><option value="">{t("propiedades.seleccionar")}</option>{MULTIPLICIDADES_UML.map((valor) => <option key={valor} value={valor}>{t(`multiplicidad.${valor}`)}</option>)}</select></label><small>{preguntaCantidad(t("propiedades.explicacionExtremoDestino"), nombre(actual.claseOrigenId), nombre(actual.claseDestinoId))}</small><input aria-label={`${t("propiedades.rolOpcional")} ${nombre(actual.claseDestinoId)}`} value={rolDestino} onChange={(evento) => establecerRolDestino(evento.target.value)} onBlur={() => confirmarRol("destino")} onKeyDown={confirmarConEnter} /></div>
      </div>
      </>}
    </div>
  )
}
