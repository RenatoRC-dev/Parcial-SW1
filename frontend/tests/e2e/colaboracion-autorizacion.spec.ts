import { expect, test, type APIRequestContext } from "@playwright/test"

interface AccesoCreado {
  proyecto: { id: string }
  participante: { id: string; nombreVisible: string }
  codigoAcceso: string
  credencial: string
}

async function crearAcceso(request: APIRequestContext, nombre: string, participante: string): Promise<AccesoCreado> {
  const respuesta = await request.post("/api/proyectos", { data: { nombre, nombreParticipante: participante } })
  expect(respuesta.status()).toBe(201)
  return respuesta.json() as Promise<AccesoCreado>
}

test("E3/E4: rechaza credencial de otro proyecto y tráfico previo a autenticación", async ({ page, request }) => {
  await page.goto("/")
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const accesoA = await crearAcceso(request, `Directo A ${sufijo}`, "Renato")
  const accesoB = await crearAcceso(request, `Directo B ${sufijo}`, "Ana")

  const codigoCruzado = await page.evaluate(({ projectId, credential }) => new Promise<number>((resolver, rechazar) => {
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(`${protocolo}//${location.host}/api/colaboracion`)
    socket.onopen = () => socket.send(JSON.stringify({ type: "authenticate", projectId, credential }))
    socket.onclose = (evento) => resolver(evento.code)
    socket.onerror = () => rechazar(new Error("Falló el socket directo"))
  }), { projectId: accesoB.proyecto.id, credential: accesoA.credencial })
  expect(codigoCruzado).toBe(1008)

  const codigoSinCredencial = await page.evaluate(() => new Promise<number>((resolver, rechazar) => {
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(`${protocolo}//${location.host}/api/colaboracion`)
    socket.onopen = () => socket.send("AQIDBA==")
    socket.onclose = (evento) => resolver(evento.code)
    socket.onerror = () => rechazar(new Error("Falló el socket directo"))
  }))
  expect(codigoSinCredencial).toBe(1008)
})

test("E5: el relay directo conserva aislamiento entre proyectos autorizados", async ({ page, request }) => {
  await page.goto("/")
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const accesoA1 = await crearAcceso(request, `Aislamiento A ${sufijo}`, "Renato")
  const unionA2 = await request.post("/api/proyectos/unirse", {
    data: { codigoAcceso: accesoA1.codigoAcceso, nombreParticipante: "Carlos" },
  })
  expect(unionA2.status()).toBe(200)
  const accesoA2 = await unionA2.json() as AccesoCreado
  const accesoB = await crearAcceso(request, `Aislamiento B ${sufijo}`, "Ana")

  const resultado = await page.evaluate(async ({ a1, a2, b1 }) => {
    const abrir = (projectId: string, credential: string) => new Promise<WebSocket>((resolver, rechazar) => {
      const protocolo = location.protocol === "https:" ? "wss:" : "ws:"
      const socket = new WebSocket(`${protocolo}//${location.host}/api/colaboracion`)
      socket.onopen = () => socket.send(JSON.stringify({ type: "authenticate", projectId, credential }))
      socket.onmessage = (evento) => {
        const ack = JSON.parse(String(evento.data)) as { type?: string }
        if (ack.type === "authenticated") resolver(socket)
      }
      socket.onerror = () => rechazar(new Error("Falló autenticación directa"))
      socket.onclose = (evento) => rechazar(new Error(`Socket cerrado ${evento.code}`))
    })
    const [socketA1, socketA2, socketB1] = await Promise.all([
      abrir(a1.projectId, a1.credential), abrir(a2.projectId, a2.credential), abrir(b1.projectId, b1.credential),
    ])
    const recibidosA2: string[] = []
    const recibidosB1: string[] = []
    socketA2.onmessage = (evento) => recibidosA2.push(String(evento.data))
    socketB1.onmessage = (evento) => recibidosB1.push(String(evento.data))
    socketA1.send("FRAME-PROYECTO-A")
    await new Promise((resolver) => setTimeout(resolver, 250))
    socketA1.close(); socketA2.close(); socketB1.close()
    return { recibidosA2, recibidosB1 }
  }, {
    a1: { projectId: accesoA1.proyecto.id, credential: accesoA1.credencial },
    a2: { projectId: accesoA2.proyecto.id, credential: accesoA2.credencial },
    b1: { projectId: accesoB.proyecto.id, credential: accesoB.credencial },
  })

  expect(resultado.recibidosA2).toEqual(["FRAME-PROYECTO-A"])
  expect(resultado.recibidosB1).toEqual([])
})
