import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { herramientas } from "./RegistroHerramientas.js"

/** Official SDK protocol adapter. Authentication is provided by the trusted host/backend. */
export function crearServidorMcp(invocar: (nombre: string, args: unknown) => Promise<unknown>) {
  const server = new McpServer({ name: "nexocase", version: "0.1.0" })
  for (const [name, tool] of Object.entries(herramientas)) {
    server.registerTool(name, { description: tool.description, inputSchema: tool.schema }, async (args: unknown): Promise<CallToolResult> => {
      try {
        const result = await invocar(name, args)
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> }
      } catch (error) {
        const code = error && typeof error === "object" && "status" in error ? error.status : 503
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "failed", code, message: "No se completó la herramienta. Verifica autorización, revisión y disponibilidad." }) }] }
      }
    })
  }
  return server
}
