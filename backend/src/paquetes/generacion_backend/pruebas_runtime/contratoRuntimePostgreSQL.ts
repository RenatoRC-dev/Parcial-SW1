/** CREATE sin DROP: una base existente debe provocar error, nunca reutilizarse. */
export function sqlCrearBasePrueba(database: string): string {
  if (!/^sw1_[a-z0-9_]+$/.test(database) || database.length > 63) {
    throw new Error("SW1_PG_TEST_DB debe ser un identificador sw1_ de hasta 63 caracteres.")
  }
  return `CREATE DATABASE "${database}";`
}

export const nombreUsuarioActualizado = "Usuario Runtime Actualizado"

export async function verificarActualizacionUsuario(baseUrl: string, id: number): Promise<void> {
  const url = `${baseUrl}/api/usuario/${id}`
  for (const method of ["PUT", "GET"]) {
    const response = await fetch(url, method === "PUT" ? {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreUsuarioActualizado }),
    } : { method })
    if (response.status !== 200) throw new Error(`${method} Usuario actualizado respondió ${response.status}.`)
    const usuario = await response.json() as { id: number; nombre: string }
    if (usuario.id !== id || usuario.nombre !== nombreUsuarioActualizado) {
      throw new Error(`${method} Usuario no conservó la identidad y el nombre actualizado.`)
    }
  }
}
