import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { RepositorioProyectosArchivos } from "../infraestructura/RepositorioProyectosArchivos.js"

const directorio = await mkdtemp(join(tmpdir(), "sw1-prueba-proyectos-"))
try {
  const repositorioInicial = new RepositorioProyectosArchivos(directorio)
  const aplicacion = crearAplicacionGeneracionBackend({ repositorioProyectos: repositorioInicial })
  const creado = await request(aplicacion).post("/api/proyectos").send({ nombre: "Prueba persistente" })
  const modelo = { ...creado.body.modelo, clases: [{ id: "cliente", nombre: "Cliente", atributos: [{ id: "nombre", nombre: "nombre", tipo: null }], posicion: { x: 10, y: 20 }, abstracta: false }] }
  const guardado = await request(aplicacion).put(`/api/proyectos/${creado.body.id}/modelo`).send({ modelo })
  const aislado = await request(aplicacion).post("/api/proyectos").send({ nombre: "Proyecto aislado" })
  const modeloAislado = { ...aislado.body.modelo, clases: [{ id: "factura", nombre: "Factura", atributos: [], posicion: { x: 50, y: 60 }, abstracta: false }] }
  await request(aplicacion).put(`/api/proyectos/${aislado.body.id}/modelo`).send({ modelo: modeloAislado })
  const repositorioNuevo = new RepositorioProyectosArchivos(directorio)
  const reiniciada = crearAplicacionGeneracionBackend({ repositorioProyectos: repositorioNuevo })
  const recuperado = await request(reiniciada).get(`/api/proyectos/${creado.body.id}`)
  const recuperadoAislado = await request(reiniciada).get(`/api/proyectos/${aislado.body.id}`)
  const listado = await request(reiniciada).get("/api/proyectos")
  console.log(JSON.stringify({
    projectCreated: creado.status === 201,
    modelSaved: guardado.status === 200,
    draftWithNullTypeSaved: guardado.status === 200,
    newRepositoryUsed: repositorioNuevo !== repositorioInicial,
    projectRecovered: recuperado.status === 200,
    recoveredAfterRepositoryRestart: recuperado.body?.modelo?.clases?.[0]?.atributos?.[0]?.tipo === null,
    classPreserved: recuperado.body?.modelo?.clases?.[0]?.nombre === "Cliente",
    positionPreserved: recuperado.body?.modelo?.clases?.[0]?.posicion?.x === 10 && recuperado.body?.modelo?.clases?.[0]?.posicion?.y === 20,
    createdAtPreserved: recuperado.body?.creadoEn === creado.body?.creadoEn,
    updatedAtUpdated: Date.parse(recuperado.body?.actualizadoEn) >= Date.parse(creado.body?.actualizadoEn),
    projectIsolation: recuperado.body?.modelo?.clases?.some((clase: { nombre: string }) => clase.nombre === "Factura") === false
      && recuperadoAislado.body?.modelo?.clases?.some((clase: { nombre: string }) => clase.nombre === "Cliente") === false,
    listedWithoutModel: listado.status === 200 && listado.body[0]?.modelo === undefined,
  }, null, 2))
} finally {
  await rm(directorio, { recursive: true, force: true })
}
