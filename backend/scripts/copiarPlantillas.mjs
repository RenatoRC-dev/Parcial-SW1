import { cp } from "node:fs/promises"

const origen = new URL(
  "../src/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/plantillas",
  import.meta.url
)
const destino = new URL(
  "../dist/paquetes/generacion_backend/casos_uso/cu09_generar_backend_spring_boot/plantillas",
  import.meta.url
)

await cp(origen, destino, { recursive: true })

const puenteXmi = new URL(
  "../src/paquetes/interoperabilidad/compartido/crunch_uml/bridge_crunch_uml.py",
  import.meta.url
)
const destinoPuenteXmi = new URL(
  "../dist/paquetes/interoperabilidad/compartido/crunch_uml/bridge_crunch_uml.py",
  import.meta.url
)

await cp(puenteXmi, destinoPuenteXmi)
