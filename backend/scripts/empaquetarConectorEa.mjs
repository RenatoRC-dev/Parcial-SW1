import { readFile, mkdir, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'

// Explicit allowlist: no runtime state, credentials, test repositories or environment files.
const zip = new JSZip()
for (const name of ['Setup.cmd', 'Setup.ps1', 'Connect.ps1', 'Automation.ps1', 'README.md']) {
  zip.file(name, await readFile(new URL(`../../desktop/ea/${name === "README.md" ? "CONNECTOR.md" : name}`, import.meta.url)), { date: new Date(2026, 0, 1, 0, 0, 0), createFolders: false })
}
const destination = new URL('../recursos/ea/', import.meta.url)
await mkdir(destination, { recursive: true })
await writeFile(new URL('NexoCASE-Connector.zip', destination), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'DOS' }))
console.log('EA connector ZIP generated (5 public source files; no credentials).')
