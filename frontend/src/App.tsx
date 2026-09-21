import { useEffect, useState } from "react"
import type { ModeloUMLCanonico } from "./nucleo/modelo_uml/ModeloUMLCanonico"
import { PaginaModeladoClases } from "./paquetes/modelado_uml/casos_uso/cu02_modelar_diagrama_clases/PaginaModeladoClases"
import type { Proyecto } from "./paquetes/gestion_proyectos/compartido/Proyecto"
import { PanelProyectos } from "./paquetes/gestion_proyectos/casos_uso/cu01_crear_abrir_proyecto/PanelProyectos"
import { BarraProyectoActivo } from "./paquetes/gestion_proyectos/casos_uso/cu11_guardar_recuperar_trabajo/BarraProyectoActivo"
import { guardarModeloProyecto } from "./paquetes/gestion_proyectos/compartido/clienteProyectos"
import { ProveedorPreferenciasUI, usarPreferenciasUI } from "./configuracion/PreferenciasUI"

function Aplicacion() {
  const { t } = usarPreferenciasUI()
  const [proyecto, establecerProyecto] = useState<Proyecto | null>(null)
  const [modeloActual, establecerModeloActual] = useState<ModeloUMLCanonico | null>(null)
  const [snapshot, establecerSnapshot] = useState("")
  const [guardando, establecerGuardando] = useState(false)
  const [mensaje, establecerMensaje] = useState<string | null>(null)
  const sucio = modeloActual !== null && JSON.stringify(modeloActual) !== snapshot

  useEffect(() => {
    const prevenir = (evento: BeforeUnloadEvent) => { if (sucio) evento.preventDefault() }
    window.addEventListener("beforeunload", prevenir)
    return () => window.removeEventListener("beforeunload", prevenir)
  }, [sucio])

  const abrir = (nuevo: Proyecto) => {
    establecerProyecto(nuevo); establecerModeloActual(nuevo.modelo); establecerSnapshot(JSON.stringify(nuevo.modelo)); establecerMensaje(null)
  }
  const volver = () => {
    if (sucio && !window.confirm(t("proyectos.confirmarSalida"))) return
    establecerProyecto(null); establecerModeloActual(null); establecerSnapshot(""); establecerMensaje(null)
  }
  const guardar = async () => {
    if (!proyecto || !modeloActual) return
    establecerGuardando(true); establecerMensaje(null)
    try {
      const resumen = await guardarModeloProyecto(proyecto.id, modeloActual)
      establecerProyecto({ ...proyecto, ...resumen, modelo: modeloActual })
      establecerSnapshot(JSON.stringify(modeloActual)); establecerMensaje(t("proyectos.guardadoCorrecto"))
    } catch (error) { establecerMensaje((error as Error).message) } finally { establecerGuardando(false) }
  }

  if (!proyecto) return <PanelProyectos alAbrir={abrir} />
  return <div className="case-application">
    <BarraProyectoActivo nombre={proyecto.nombre} sucio={sucio} guardando={guardando} mensaje={mensaje} alGuardar={guardar} alVolver={volver} />
    <PaginaModeladoClases key={proyecto.id} proyectoId={proyecto.id} proyectoNombre={proyecto.nombre} modeloInicial={proyecto.modelo} cambiosSinGuardar={sucio} alCambiarModeloCanonico={establecerModeloActual} />
  </div>
}

function App() { return <ProveedorPreferenciasUI><Aplicacion /></ProveedorPreferenciasUI> }

export default App
