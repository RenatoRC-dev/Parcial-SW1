import { useEffect, useState } from "react"
import type { ModeloUMLCanonico } from "./nucleo/modelo_uml/ModeloUMLCanonico"
import { PaginaModeladoClases } from "./paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases"
import type { AccesoProyectoActivo, Proyecto } from "./paquetes/gestion_proyectos/compartido/Proyecto"
import { PanelProyectos } from "./paquetes/gestion_proyectos/casos_uso/cu01_crear_abrir_proyecto/PanelProyectos"
import { BarraProyectoActivo } from "./paquetes/gestion_proyectos/casos_uso/cu11_guardar_recuperar_trabajo/BarraProyectoActivo"
import { abrirProyecto, ErrorApiProyecto, guardarModeloProyecto } from "./paquetes/gestion_proyectos/compartido/clienteProyectos"
import { ProveedorPreferenciasUI, usarPreferenciasUI } from "./configuracion/PreferenciasUI"
import { PanelConflictoRevision } from "./paquetes/gestion_proyectos/casos_uso/cu11_guardar_recuperar_trabajo/PanelConflictoRevision"
import { convertirAModeloCanonicoConAdvertencias, convertirDesdeModeloCanonico } from "./paquetes/modelado_uml/compartido/integracion_apollon/AdaptadorApollon"

type EstadoConflicto = "visible" | "diferido" | null

function normalizarSnapshotParaEditor(modelo: ModeloUMLCanonico): ModeloUMLCanonico {
  const normalizado = convertirAModeloCanonicoConAdvertencias(convertirDesdeModeloCanonico(modelo)).modelo
  return { ...normalizado, id: modelo.id, nombre: modelo.nombre, version: modelo.version }
}

function Aplicacion() {
  const { t } = usarPreferenciasUI()
  const [proyecto, establecerProyecto] = useState<Proyecto | null>(null)
  const [acceso, establecerAcceso] = useState<AccesoProyectoActivo | null>(null)
  const [modeloActual, establecerModeloActual] = useState<ModeloUMLCanonico | null>(null)
  const [snapshot, establecerSnapshot] = useState("")
  const [guardando, establecerGuardando] = useState(false)
  const [recargando, establecerRecargando] = useState(false)
  const [mensaje, establecerMensaje] = useState<string | null>(null)
  const [conflicto, establecerConflicto] = useState<EstadoConflicto>(null)
  const [generacionEditor, establecerGeneracionEditor] = useState(0)
  const sucio = modeloActual !== null && JSON.stringify(modeloActual) !== snapshot

  useEffect(() => {
    const prevenir = (evento: BeforeUnloadEvent) => {
      if (!sucio) return
      evento.preventDefault()
      evento.returnValue = true
    }
    window.addEventListener("beforeunload", prevenir)
    return () => window.removeEventListener("beforeunload", prevenir)
  }, [sucio])

  const abrir = (nuevo: Proyecto, nuevoAcceso: AccesoProyectoActivo) => {
    const modelo = normalizarSnapshotParaEditor(nuevo.modelo)
    establecerProyecto({ ...nuevo, modelo }); establecerAcceso(nuevoAcceso); establecerModeloActual(modelo); establecerSnapshot(JSON.stringify(modelo)); establecerMensaje(null); establecerConflicto(null); establecerGeneracionEditor(0)
  }
  const volver = () => {
    if (sucio && !window.confirm(t("proyectos.confirmarSalida"))) return
    establecerProyecto(null); establecerAcceso(null); establecerModeloActual(null); establecerSnapshot(""); establecerMensaje(null); establecerConflicto(null)
  }
  const guardar = async () => {
    if (!proyecto || !modeloActual || !acceso) return
    establecerGuardando(true); establecerMensaje(null)
    try {
      const resumen = await guardarModeloProyecto(proyecto.id, acceso.credential, modeloActual, proyecto.revisionModelo)
      establecerProyecto({ ...proyecto, ...resumen, modelo: modeloActual })
      establecerSnapshot(JSON.stringify(modeloActual)); establecerMensaje(t("proyectos.guardadoCorrecto")); establecerConflicto(null)
    } catch (error) {
      if (error instanceof ErrorApiProyecto && error.codigo === "REVISION_CONFLICTIVA") establecerConflicto("visible")
      establecerMensaje((error as Error).message)
    } finally { establecerGuardando(false) }
  }
  const cargarVersionGuardada = async () => {
    if (!proyecto || !acceso) return
    if (sucio && !window.confirm(t("proyectos.conflictoConfirmarCarga"))) return
    establecerRecargando(true); establecerMensaje(null)
    try {
      const actualizado = await abrirProyecto(proyecto.id, acceso.credential)
      const modelo = normalizarSnapshotParaEditor(actualizado.modelo)
      establecerProyecto({ ...actualizado, modelo })
      establecerModeloActual(modelo)
      establecerSnapshot(JSON.stringify(modelo))
      establecerGeneracionEditor((actual) => actual + 1)
      establecerConflicto(null)
      establecerMensaje(t("proyectos.versionGuardadaCargada"))
    } catch (error) {
      establecerMensaje((error as Error).message)
    } finally { establecerRecargando(false) }
  }

  if (!proyecto || !acceso) return <PanelProyectos alAcceder={abrir} />
  return <div className="case-application">
    <BarraProyectoActivo nombre={proyecto.nombre} nombreParticipante={acceso.displayName} sucio={sucio} guardando={guardando} mensaje={mensaje} conflictoPendiente={conflicto !== null} alGuardar={guardar} alVolver={volver} alMostrarConflicto={() => establecerConflicto("visible")} />
    {conflicto === "visible" ? <PanelConflictoRevision recargando={recargando} alCargarVersionGuardada={cargarVersionGuardada} alSeguirRevisando={() => establecerConflicto("diferido")} /> : null}
    <PaginaModeladoClases key={`${proyecto.id}:${generacionEditor}`} proyectoId={proyecto.id} proyectoNombre={proyecto.nombre} modeloInicial={proyecto.modelo} cambiosSinGuardar={sucio} alCambiarModeloCanonico={establecerModeloActual} />
  </div>
}

function App() { return <ProveedorPreferenciasUI><Aplicacion /></ProveedorPreferenciasUI> }

export default App
