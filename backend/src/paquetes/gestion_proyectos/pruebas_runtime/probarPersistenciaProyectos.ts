import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { RepositorioProyectosArchivos } from "../infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../pruebas/RepositorioParticipantesMemoria.js"
import { ProtegerAccesoProyecto } from "../acceso/ProtegerAccesoProyecto.js"

const directorio = await mkdtemp(join(tmpdir(), "sw1-prueba-proyectos-"))
try {
  const repositorioInicial = new RepositorioProyectosArchivos(directorio)
  const participantes = new RepositorioParticipantesMemoria()
  const protector = new ProtegerAccesoProyecto("pepper-determinista-prueba-runtime")
  const aplicacion = crearAplicacionGeneracionBackend({ accesoProyectos: { proyectos: repositorioInicial, participantes, protector } })
  const creado = await request(aplicacion).post("/api/proyectos").send({ nombre: "Prueba persistente", nombreParticipante: "Renato" })
  const modelo = { ...creado.body.proyecto.modelo, clases: [{ id: "cliente", nombre: "Cliente", atributos: [{ id: "nombre", nombre: "nombre", tipo: null }], posicion: { x: 10, y: 20 }, abstracta: false }] }
  const guardado = await request(aplicacion).put(`/api/proyectos/${creado.body.proyecto.id}/modelo`).set("Authorization", `Bearer ${creado.body.credencial}`).send({ modelo, revisionBase: 0 })
  const aislado = await request(aplicacion).post("/api/proyectos").send({ nombre: "Proyecto aislado", nombreParticipante: "Carlos" })
  const modeloAislado = { ...aislado.body.proyecto.modelo, clases: [{ id: "factura", nombre: "Factura", atributos: [], posicion: { x: 50, y: 60 }, abstracta: false }] }
  await request(aplicacion).put(`/api/proyectos/${aislado.body.proyecto.id}/modelo`).set("Authorization", `Bearer ${aislado.body.credencial}`).send({ modelo: modeloAislado, revisionBase: 0 })
  const repositorioNuevo = new RepositorioProyectosArchivos(directorio)
  const reiniciada = crearAplicacionGeneracionBackend({ accesoProyectos: { proyectos: repositorioNuevo, participantes, protector } })
  const recuperado = await request(reiniciada).get(`/api/proyectos/${creado.body.proyecto.id}`).set("Authorization", `Bearer ${creado.body.credencial}`)
  const recuperadoAislado = await request(reiniciada).get(`/api/proyectos/${aislado.body.proyecto.id}`).set("Authorization", `Bearer ${aislado.body.credencial}`)
  console.log(JSON.stringify({
    projectCreated: creado.status === 201,
    modelSaved: guardado.status === 200,
    draftWithNullTypeSaved: guardado.status === 200,
    newRepositoryUsed: repositorioNuevo !== repositorioInicial,
    projectRecovered: recuperado.status === 200,
    recoveredAfterRepositoryRestart: recuperado.body?.modelo?.clases?.[0]?.atributos?.[0]?.tipo === null,
    classPreserved: recuperado.body?.modelo?.clases?.[0]?.nombre === "Cliente",
    positionPreserved: recuperado.body?.modelo?.clases?.[0]?.posicion?.x === 10 && recuperado.body?.modelo?.clases?.[0]?.posicion?.y === 20,
    createdAtPreserved: recuperado.body?.creadoEn === creado.body?.proyecto?.creadoEn,
    updatedAtUpdated: Date.parse(recuperado.body?.actualizadoEn) >= Date.parse(creado.body?.proyecto?.actualizadoEn),
    projectIsolation: recuperado.body?.modelo?.clases?.some((clase: { nombre: string }) => clase.nombre === "Factura") === false
      && recuperadoAislado.body?.modelo?.clases?.some((clase: { nombre: string }) => clase.nombre === "Cliente") === false,
    uuidWithoutCredentialRejected: (await request(reiniciada).get(`/api/proyectos/${creado.body.proyecto.id}`)).status === 401,
  }, null, 2))
} finally {
  await rm(directorio, { recursive: true, force: true })
}
