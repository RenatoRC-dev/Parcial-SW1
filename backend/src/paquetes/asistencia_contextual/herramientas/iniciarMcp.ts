import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { crearServidorMcp } from "./ServidorMcp.js"

// Fixed trusted-host configuration, never model-supplied URLs, identities or credentials.
const { NEXOCASE_BACKEND_URL: base, NEXOCASE_PROJECT_ID: projectId, NEXOCASE_CREDENTIAL: credential } = process.env
if (!base || !projectId || !credential) throw new Error("Configure backend, project and participant credential in the MCP host environment.")
const url = new URL(base)
if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error("HTTPS required except local loopback.")
if (!/^[a-zA-Z0-9_-]{1,160}$/.test(projectId) || !/^[A-Za-z0-9_-]{43}$/.test(credential)) throw new Error("Invalid host identity.")
const endpoint = new URL(`/api/proyectos/${encodeURIComponent(projectId)}/herramientas/invocar`, url)
const server = crearServidorMcp(async (nombre, argumentos) => {
  const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(120_000), headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, body: JSON.stringify({ nombre, argumentos }) })
  if (!response.ok) throw Object.assign(new Error("Tool rejected"), { status: response.status })
  return response.json()
})
await server.connect(new StdioServerTransport())
