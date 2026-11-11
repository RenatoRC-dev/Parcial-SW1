import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { fixtureInteroperabilidad } from "../../interoperabilidad/compartido/crunch_uml/fixtureInteroperabilidad.js"
import { RepositorioProyectosArchivos } from "../../gestion_proyectos/infraestructura/RepositorioProyectosArchivos.js"
import { RepositorioParticipantesMemoria } from "../../gestion_proyectos/pruebas/RepositorioParticipantesMemoria.js"
import { ProtegerAccesoProyecto } from "../../gestion_proyectos/acceso/ProtegerAccesoProyecto.js"
import { RepositorioEventosMemoria, RepositorioMensajesMemoria } from "../../trazabilidad/pruebas/RepositoriosMemoriaProyecto.js"
import type { ModeloUMLCanonicoIntercambio } from "../../interoperabilidad/compartido/crunch_uml/ContratoInteroperabilidadXmi.js"

function semantica(modelo: ModeloUMLCanonicoIntercambio) {
  const ordenar = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  return { ...modelo,
    clases: modelo.clases.map((c) => ({ ...c, tipoClase: c.tipoClase ?? "normal", atributos: [...c.atributos].sort(ordenar) })).sort(ordenar),
    relaciones: [...modelo.relaciones].sort(ordenar) }
}

// CU07/Crunch/Python -> descarga HTTP -> adjunto CU06 real. Sin mocks XMI, sin Groq ni Mongo de usuario.
const temporal = await mkdtemp(join(tmpdir(), "chat-xmi-real-"))
try {
  const app = crearAplicacionGeneracionBackend({
    planificadorLocal: { planificar: async (s) => ({ operacion: s.pregunta.includes("Adjunto:") ? "importar_xmi" : "exportar_xmi", argumentos: {}, respuesta: "Prueba determinista" }) },
    proveedorIA: { interpretarCambiosUML: async () => { throw new Error("Groq no permitido en esta prueba") } },
    proveedorVision: { analizarImagen: async () => { throw new Error("Vision no permitida en esta prueba") } },
    proveedorAsistenteContextual: { responder: async () => { throw new Error("CU12 no permitido en esta prueba") } },
    accesoProyectos: { proyectos: new RepositorioProyectosArchivos(temporal), participantes: new RepositorioParticipantesMemoria(), protector: new ProtegerAccesoProyecto("roundtrip-local"), eventos: new RepositorioEventosMemoria(), mensajes: new RepositorioMensajesMemoria() },
  })
  const creado = await request(app).post("/api/proyectos").send({ nombre: "Roundtrip XMI", nombreParticipante: "Diseñador" })
  assert.equal(creado.status, 201)
  const ruta = `/api/proyectos/${creado.body.proyecto.id}/asistente-colaborativo`
  const auth = { Authorization: `Bearer ${creado.body.credencial}` }
  const turno = { requestId: crypto.randomUUID(), contenido: "Exporta mi modelo a XMI", modeloEjecucion: fixtureInteroperabilidad, revisionEditor: 1 }
  const exportado = await request(app).post(`${ruta}/interactuar`).set(auth).send(turno)
  if (exportado.status !== 200) {
    console.log(JSON.stringify({ estado: "bloqueado", etapa: "CU07/Crunch/Python real", http: exportado.status, motivo: exportado.body.error }))
    process.exitCode = 2
  } else {
    const archivo = await request(app).get(`${ruta}/turnos/${turno.requestId}/archivo`).set(auth)
    assert.equal(archivo.status, 200)
    assert.match(archivo.headers["content-disposition"], /modelo\.xmi/)
    assert.match(archivo.headers["content-type"], /application\/xml/)
    assert.equal((await request(app).get(`${ruta}/turnos/${turno.requestId}/archivo`)).status, 401)
    const contenido = archivo.text
    assert.ok(contenido.includes("XMI"))
    const importado = await request(app).post(`${ruta}/interactuar`).set(auth).field("turno", JSON.stringify({ ...turno, requestId: crypto.randomUUID(), contenido: "Importa este archivo XMI" })).attach("archivo", Buffer.from(contenido), { filename: "modelo.xmi", contentType: "application/xml" })
    assert.equal(importado.status, 200, JSON.stringify(importado.body))
    assert.equal(importado.body.flujo.estado, "review")
    assert.equal(importado.body.flujo.clases.length, fixtureInteroperabilidad.clases.length)
    const obsoleto = await request(app).post(`${ruta}/turnos/${importado.body.flujo.requestId}/confirmar`).set(auth).send({ decision: "confirmar", modeloEjecucion: fixtureInteroperabilidad, revisionEditor: 2 })
    assert.equal(obsoleto.status, 409)
    const propuesta = await request(app).post(`${ruta}/turnos/${importado.body.flujo.requestId}/confirmar`).set(auth).send({ decision: "confirmar", modeloEjecucion: fixtureInteroperabilidad, revisionEditor: 1 })
    assert.equal(propuesta.status, 200)
    assert.equal(propuesta.body.modeloResultado.relaciones.length, fixtureInteroperabilidad.relaciones.length)
    assert.deepEqual(semantica(propuesta.body.modeloResultado), semantica(fixtureInteroperabilidad))
    assert.equal(importado.body.flujo.advertencias.length, 0)
    const conMetodo = contenido.replace("</packagedElement>", '<ownedOperation xmi:type="uml:Operation" xmi:id="OP_S21" name="fueraDelPerfil"/></packagedElement>')
    const advertido = await request(app).post(`${ruta}/interactuar`).set(auth).field("turno", JSON.stringify({ ...turno, requestId: crypto.randomUUID(), contenido: "Importa este archivo XMI" })).attach("archivo", Buffer.from(conMetodo), { filename: "metodo.xmi", contentType: "application/xml" })
    assert.equal(advertido.status, 200)
    assert.ok(advertido.body.flujo.advertencias.some((texto: string) => /métodos UML.*omitidos/.test(texto)))
    const descartado = await request(app).post(`${ruta}/turnos/${advertido.body.flujo.requestId}/confirmar`).set(auth).send({ decision: "rechazar", modeloEjecucion: fixtureInteroperabilidad, revisionEditor: 1 })
    assert.equal(descartado.status, 200)
    assert.equal(descartado.body.flujo.estado, "cancelled")
    console.log(JSON.stringify({ estado: "verificado", exportacionCU07Real: true, descargaHttpReal: true, importacionCU06Real: true, semanticaCompletaPreservada: true, advertenciaMetodosOmitidos: true, rechazoConfirmacion: true, revisionObsoletaRechazada: true, descargaAnonimaRechazada: true, bytes: Buffer.byteLength(contenido), clases: importado.body.flujo.clases.length, eaSincronizado: false, navegadorVerificado: false }))
  }
} finally { await rm(temporal, { recursive: true, force: true }) }
