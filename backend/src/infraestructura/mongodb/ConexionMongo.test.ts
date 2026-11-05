import { describe, expect, it } from "vitest"
import {
  ConexionMongo,
  ErrorConfiguracionMongo,
  ErrorConexionMongo,
  obtenerConfiguracionMongo,
} from "./ConexionMongo.js"

describe("configuración y ciclo de conexión MongoDB", () => {
  it("exige URI y usa el nombre de base predeterminado", () => {
    expect(() => obtenerConfiguracionMongo({})).toThrow(ErrorConfiguracionMongo)
    expect(obtenerConfiguracionMongo({ MONGODB_URI: "mongodb://127.0.0.1:27017" })).toEqual({
      uri: "mongodb://127.0.0.1:27017",
      nombreBaseDatos: "nexocase",
    })
  })

  it("rechaza nombres de base inválidos", () => {
    expect(() => obtenerConfiguracionMongo({
      MONGODB_URI: "mongodb://127.0.0.1:27017",
      MONGODB_DB_NAME: "nombre/invalido",
    })).toThrow(ErrorConfiguracionMongo)
  })

  it("traduce una base no disponible a un error controlado", async () => {
    const conexion = new ConexionMongo(
      { uri: "mongodb://127.0.0.1:1", nombreBaseDatos: "nexocase_test" },
      { serverSelectionTimeoutMS: 50 },
    )
    await expect(conexion.conectar()).rejects.toBeInstanceOf(ErrorConexionMongo)
    await conexion.cerrar()
  })
})
