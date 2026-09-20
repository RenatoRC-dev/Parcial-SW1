import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import ejs from "ejs"
import type { ModeloUMLCanonicoEntrada } from "./ContratoModeloUMLCanonico.js"
import { prepararProyectoSpring } from "./PrepararProyectoSpring.js"

const directorioPlantillas = fileURLToPath(new URL("plantillas", import.meta.url))

interface ArchivoPlantilla {
  plantilla: string
  ruta: string
  datos?: Record<string, unknown>
}

async function renderizarArchivo(
  salida: string,
  archivo: ArchivoPlantilla,
  datosBase: Record<string, unknown>
) {
  const contenidoPlantilla = await readFile(
    join(directorioPlantillas, archivo.plantilla),
    "utf8"
  )
  const contenido = ejs.render(contenidoPlantilla, {
    ...datosBase,
    ...archivo.datos,
  })
  const destino = join(salida, archivo.ruta)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, contenido, "utf8")
}

export async function generarProyectoSpring(
  modeloCanonico: ModeloUMLCanonicoEntrada,
  directorioSalida: string
): Promise<string[]> {
  const proyecto = prepararProyectoSpring(modeloCanonico)
  const rutaPaquete = proyecto.packageName.replaceAll(".", "/")
  const raizJava = `src/main/java/${rutaPaquete}`
  const archivos: ArchivoPlantilla[] = [
    { plantilla: "pom.xml.ejs", ruta: "pom.xml" },
    {
      plantilla: "Aplicacion.java.ejs",
      ruta: `${raizJava}/BackendGeneradoApplication.java`,
    },
    {
      plantilla: "application.properties.ejs",
      ruta: "src/main/resources/application.properties",
    },
    {
      plantilla: "maven-wrapper.properties.ejs",
      ruta: ".mvn/wrapper/maven-wrapper.properties",
    },
    { plantilla: "mvnw.cmd.ejs", ruta: "mvnw.cmd" },
    { plantilla: "mvnw.ejs", ruta: "mvnw" },
  ]

  for (const entidad of proyecto.entidades) {
    const datos = { entidad }
    if (entidad.claveCompuesta) {
      archivos.push({
        plantilla: "ClaveCompuesta.java.ejs",
        ruta: `${raizJava}/modelo/${entidad.claveCompuesta.nombreClase}.java`,
        datos,
      })
    }
    archivos.push(
      {
        plantilla: "Entidad.java.ejs",
        ruta: `${raizJava}/modelo/${entidad.nombreClase}.java`,
        datos,
      },
      {
        plantilla: "Repository.java.ejs",
        ruta: `${raizJava}/repositorio/${entidad.nombreClase}Repository.java`,
        datos,
      },
      {
        plantilla: "Service.java.ejs",
        ruta: `${raizJava}/servicio/${entidad.nombreClase}Service.java`,
        datos,
      },
      {
        plantilla: "ServiceImpl.java.ejs",
        ruta: `${raizJava}/servicio/impl/${entidad.nombreClase}ServiceImpl.java`,
        datos,
      },
      {
        plantilla: "Controller.java.ejs",
        ruta: `${raizJava}/controlador/${entidad.nombreClase}Controller.java`,
        datos,
      }
    )
  }

  const datosBase = { proyecto }
  for (const archivo of archivos) {
    await renderizarArchivo(directorioSalida, archivo, datosBase)
  }

  await chmod(join(directorioSalida, "mvnw"), 0o755)
  return archivos.map((archivo) => archivo.ruta)
}
