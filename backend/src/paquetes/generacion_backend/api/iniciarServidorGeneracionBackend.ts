import { crearServidorCase } from "../../../ServidorCase.js"

const puerto = Number(process.env.PORT ?? 3001)
const { servidor } = crearServidorCase()
servidor.listen(puerto, "127.0.0.1", () => {
  console.log(`Servidor CASE disponible en http://127.0.0.1:${puerto}`)
})
