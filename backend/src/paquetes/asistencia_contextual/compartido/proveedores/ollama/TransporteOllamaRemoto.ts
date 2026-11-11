import { lookup } from "node:dns"
import { request } from "node:https"
import { BlockList, isIP } from "node:net"
import { ErrorAsistenteContextual } from "../../ProveedorAsistenteContextual.js"

// Validate the address used by the actual socket, not a separate DNS preflight.
// Cloudflare public hostnames support IPv4; private/mapped IPv6 is never selected.
const bloqueadas = new BlockList()
for (const [red, prefijo] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]] as const) bloqueadas.addSubnet(red, prefijo)

export function direccionRemotaPublica(direccion: string): boolean {
  return isIP(direccion) === 4 && !bloqueadas.check(direccion, "ipv4")
}

/** Fixed HTTPS transport: normal TLS verification, no proxy env or redirect handling.
 * Buffers at most 32 KiB and honors AbortSignal during DNS, TLS and body reads. */
export const solicitarOllamaRemoto: typeof fetch = async (entrada, opciones) => {
  const url = new URL(String(entrada))
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash
    || !["/api/chat", "/api/tags"].includes(url.pathname)) throw new Error("REMOTE_ENDPOINT_REJECTED")
  return new Promise<Response>((resolve, reject) => {
    const req = request(url, {
      method: opciones?.method ?? "GET", headers: Object.fromEntries(new Headers(opciones?.headers).entries()),
      signal: opciones?.signal ?? undefined, agent: false, family: 4,
      lookup(host, _options, callback) {
        lookup(host, { family: 4 }, (error, address, family) => {
          if (error || !direccionRemotaPublica(address)) { callback(new Error("REMOTE_DNS_REJECTED"), "", 4); return }
          callback(null, address, family)
        })
      },
    }, (res) => {
      const status = res.statusCode ?? 502
      if (status < 200 || status >= 300) {
        resolve(new Response(null, { status })); res.destroy(); return
      }
      const partes: Buffer[] = []; let bytes = 0
      res.on("data", (parte: Buffer) => {
        bytes += parte.length
        if (bytes > 32_768) { req.destroy(new ErrorAsistenteContextual("respuesta_invalida", "La respuesta Ollama excede el limite.")); return }
        partes.push(parte)
      })
      res.on("error", reject)
      res.on("end", () => resolve(new Response(Buffer.concat(partes), { status })))
    })
    req.on("error", reject)
    req.end(typeof opciones?.body === "string" ? opciones.body : undefined)
  })
}
