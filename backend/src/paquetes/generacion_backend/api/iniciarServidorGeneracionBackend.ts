import { crearAplicacionGeneracionBackend } from "./ServidorGeneracionBackend.js"

const puerto = Number(process.env.PORT ?? 3001)
crearAplicacionGeneracionBackend().listen(puerto, "127.0.0.1", () => {
  console.log(`Servicio de generación disponible en http://127.0.0.1:${puerto}`)
})
