import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { createServer } from "node:http"
import { MongoClient } from "mongodb"
import request from "supertest"
import WebSocket from "ws"
import { describe, expect, it } from "vitest"
import { crearIndicesMongo } from "../../../infraestructura/mongodb/crearIndicesMongo.js"
import { crearAplicacionGeneracionBackend } from "../../generacion_backend/api/ServidorGeneracionBackend.js"
import { ProtegerAccesoProyecto } from "../acceso/ProtegerAccesoProyecto.js"
import { RepositorioParticipantesMongo } from "./RepositorioParticipantesMongo.js"
import { RepositorioProyectosMongo } from "./RepositorioProyectosMongo.js"
import { adjuntarRelayColaboracion } from "../../colaboracion/casos_uso/cu03_colaborar_modelo/ServidorRelayColaboracion.js"
import { ServidorCanalAplicacionProyecto } from "../../colaboracion/casos_uso/cu03_colaborar_modelo/ServidorCanalAplicacionProyecto.js"
import { RepositorioEventosMongo } from "../../trazabilidad/infraestructura/RepositorioEventosMongo.js"
import { RepositorioMensajesMongo } from "../../mensajeria_colaborativa/infraestructura/RepositorioMensajesMongo.js"
import { ProveedorAsistenteContextualDeterministaE2E } from "../../asistencia_contextual/pruebas/ProveedorAsistenteContextualDeterministaE2E.js"

const uri = process.env.MONGODB_TEST_URI?.trim()
const describeIntegracion = uri ? describe : describe.skip

describeIntegracion("continuidad CU11/CU12 tras nueva composición backend", () => {
  it("recupera modelo, conversación, credencial y canal de aplicación tras reiniciar", async () => {
    const nombreBase = `nexocase_continuidad_${randomUUID().replaceAll("-", "")}`
    const pepper = "pepper-continuidad-f4-d"
    let proyectoId = ""
    let credencial = ""
    const modeloGuardado = {
      id: "modelo-continuidad", nombre: "Continuidad", version: "4.2.0",
      clases: [{ id: "venta", nombre: "Venta", abstracta: false, posicion: { x: 10, y: 20 }, atributos: [] }],
      relaciones: [],
    }

    const clientePrimero = new MongoClient(uri!, { serverSelectionTimeoutMS: 5_000 })
    try {
      await clientePrimero.connect()
      const base = clientePrimero.db(nombreBase)
      await crearIndicesMongo(base)
      const aplicacion = crearAplicacionGeneracionBackend({ accesoProyectos: {
        proyectos: new RepositorioProyectosMongo(base),
        participantes: new RepositorioParticipantesMongo(base),
        protector: new ProtegerAccesoProyecto(pepper),
        eventos: new RepositorioEventosMongo(base), mensajes: new RepositorioMensajesMongo(base),
      }, proveedorAsistenteContextual: new ProveedorAsistenteContextualDeterministaE2E() })
      const creado = await request(aplicacion).post("/api/proyectos")
        .send({ nombre: "Continuidad", nombreParticipante: "Renato" }).expect(201)
      proyectoId = creado.body.proyecto.id
      credencial = creado.body.credencial
      const guardado = await request(aplicacion).put(`/api/proyectos/${proyectoId}/modelo`)
        .set("Authorization", `Bearer ${credencial}`)
        .send({ modelo: modeloGuardado, revisionBase: 0 }).expect(200)
      expect(guardado.body.revisionModelo).toBe(1)
      await request(aplicacion).post(`/api/proyectos/${proyectoId}/asistente-colaborativo/interactuar`)
        .set("Authorization", `Bearer ${credencial}`)
        .send({ requestId: randomUUID(), contenido: "Analiza el proyecto después del guardado" }).expect(200)
    } finally {
      await clientePrimero.close()
    }

    const clienteReiniciado = new MongoClient(uri!, { serverSelectionTimeoutMS: 5_000 })
    try {
      await clienteReiniciado.connect()
      const base = clienteReiniciado.db(nombreBase)
      const dependenciasAcceso = {
        proyectos: new RepositorioProyectosMongo(base),
        participantes: new RepositorioParticipantesMongo(base),
        protector: new ProtegerAccesoProyecto(pepper),
        eventos: new RepositorioEventosMongo(base), mensajes: new RepositorioMensajesMongo(base),
      }
      const aplicacionReiniciada = crearAplicacionGeneracionBackend({ accesoProyectos: dependenciasAcceso, proveedorAsistenteContextual: new ProveedorAsistenteContextualDeterministaE2E() })
      const recuperado = await request(aplicacionReiniciada).get(`/api/proyectos/${proyectoId}`)
        .set("Authorization", `Bearer ${credencial}`).expect(200)
      expect(recuperado.body.modelo).toEqual(modeloGuardado)
      expect(recuperado.body.revisionModelo).toBe(1)
      const conversacion = await request(aplicacionReiniciada).get(`/api/proyectos/${proyectoId}/mensajes`)
        .set("Authorization", `Bearer ${credencial}`).expect(200)
      expect(conversacion.body.items).toHaveLength(2)

      const servidorReiniciado = createServer()
      const relay = adjuntarRelayColaboracion(servidorReiniciado, dependenciasAcceso)
      const canalAplicacion = new ServidorCanalAplicacionProyecto(dependenciasAcceso)
      canalAplicacion.adjuntar(servidorReiniciado)
      servidorReiniciado.listen(0, "127.0.0.1")
      await once(servidorReiniciado, "listening")
      const direccion = servidorReiniciado.address()
      if (!direccion || typeof direccion === "string") throw new Error("Puerto de integración no disponible")
      const socket = new WebSocket(`ws://127.0.0.1:${direccion.port}/api/colaboracion-aplicacion`)
      try {
        await once(socket, "open")
        const mensaje = once(socket, "message")
        socket.send(JSON.stringify({ type: "authenticate", projectId: proyectoId, credential: credencial }))
        const [ack] = await mensaje
        expect(JSON.parse(ack.toString())).toMatchObject({
          type: "authenticated", projectId: proyectoId,
          participant: { nombreVisible: "Renato" },
        })
      } finally {
        socket.terminate()
        await canalAplicacion.cerrar()
        await relay.cerrar()
        await new Promise<void>((resolver) => servidorReiniciado.close(() => resolver()))
      }
    } finally {
      await clienteReiniciado.db(nombreBase).dropDatabase().catch(() => undefined)
      await clienteReiniciado.close()
    }
  })
})
